package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

const (
	maxBodyBytes = 1 << 20 // Documents are JSON; reject oversized requests early.
	sessionName  = "session"
	maxRateKeys  = 10_000
)

type config struct {
	port, frontendURL, databaseURL, sessionSecret string
	cookieSecure                                  bool
	dbMaxConns, dbMinConns                        int32
	github, google                                oauth2.Config
}

type server struct {
	cfg config
	db  *pgxpool.Pool
	log *slog.Logger
	lim *rateLimiter
}

type session struct {
	UserID string `json:"uid"`
	Exp    int64  `json:"exp"`
}

func main() {
	loadDotEnv(".env")
	cfg, err := loadConfig()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	poolCfg, err := pgxpool.ParseConfig(cfg.databaseURL)
	if err != nil {
		slog.Error("invalid DATABASE_URL", "error", err)
		os.Exit(1)
	}
	poolCfg.MaxConns = cfg.dbMaxConns
	poolCfg.MinConns = cfg.dbMinConns
	poolCfg.MaxConnLifetime = 30 * time.Minute
	poolCfg.MaxConnIdleTime = 5 * time.Minute
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	db, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		slog.Error("database ping failed", "error", err)
		os.Exit(1)
	}

	s := &server{cfg: cfg, db: db, log: slog.Default(), lim: newRateLimiter()}
	httpServer := &http.Server{
		Addr:              ":" + cfg.port,
		Handler:           s.routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	go func() {
		slog.Info("Go backend listening", "address", httpServer.Addr)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
	defer done()
	_ = httpServer.Shutdown(shutdown)
}

func loadConfig() (config, error) {
	secret := os.Getenv("SESSION_SECRET")
	if len(secret) < 32 {
		return config{}, errors.New("SESSION_SECRET must be at least 32 characters; refusing to use a default secret")
	}
	frontend := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	frontendParsed, err := url.Parse(frontend)
	if err != nil || frontendParsed.Scheme == "" || frontendParsed.Host == "" {
		return config{}, errors.New("FRONTEND_URL must be an absolute URL")
	}
	cookieSecure := frontendParsed.Scheme == "https"
	if explicit := os.Getenv("COOKIE_SECURE"); explicit != "" {
		cookieSecure = explicit == "true"
	}
	if frontendParsed.Hostname() != "localhost" && !cookieSecure {
		return config{}, errors.New("COOKIE_SECURE must be true outside localhost")
	}
	backendURL := strings.TrimRight(os.Getenv("BACKEND_URL"), "/")
	callback := func(name, path string) string {
		if v := os.Getenv(name); v != "" {
			return v
		}
		if backendURL != "" {
			return backendURL + path
		}
		return ""
	}
	maxConns, err := envInt("DB_MAX_CONNS", 20, 1, 100)
	if err != nil {
		return config{}, err
	}
	minConns, err := envInt("DB_MIN_CONNS", 2, 0, maxConns)
	if err != nil {
		return config{}, err
	}
	c := config{
		port: envOr("PORT", "4000"), frontendURL: frontend, databaseURL: os.Getenv("DATABASE_URL"), sessionSecret: secret,
		cookieSecure: cookieSecure, dbMaxConns: int32(maxConns), dbMinConns: int32(minConns),
		github: oauth2.Config{ClientID: os.Getenv("GITHUB_CLIENT_ID"), ClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"), RedirectURL: callback("GITHUB_CALLBACK_URL", "/auth/github/callback"), Endpoint: oauth2.Endpoint{AuthURL: "https://github.com/login/oauth/authorize", TokenURL: "https://github.com/login/oauth/access_token"}, Scopes: []string{"read:user", "user:email"}},
		google: oauth2.Config{ClientID: os.Getenv("GOOGLE_CLIENT_ID"), ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"), RedirectURL: callback("GOOGLE_CALLBACK_URL", "/auth/google/callback"), Endpoint: oauth2.Endpoint{AuthURL: "https://accounts.google.com/o/oauth2/v2/auth", TokenURL: "https://oauth2.googleapis.com/token"}, Scopes: []string{"openid", "profile", "email"}},
	}
	if c.databaseURL == "" {
		return config{}, errors.New("DATABASE_URL is required")
	}
	for _, p := range []struct{ name, id, secret, callback string }{{"GitHub", c.github.ClientID, c.github.ClientSecret, c.github.RedirectURL}, {"Google", c.google.ClientID, c.google.ClientSecret, c.google.RedirectURL}} {
		if (p.id == "") != (p.secret == "") {
			return config{}, fmt.Errorf("%s OAuth client ID and secret must be configured together", p.name)
		}
		if p.id != "" {
			parsed, err := url.Parse(p.callback)
			if p.callback == "" || err != nil || parsed.Scheme == "" || parsed.Host == "" {
				return config{}, fmt.Errorf("%s OAuth requires an absolute callback URL; set %s_CALLBACK_URL or BACKEND_URL", p.name, strings.ToUpper(p.name))
			}
		}
	}
	return c, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func envInt(key string, fallback, min, max int) (int, error) {
	v := envOr(key, fmt.Sprint(fallback))
	n, err := strconv.Atoi(v)
	if err != nil || n < min || n > max {
		return 0, fmt.Errorf("%s must be between %d and %d", key, min, max)
	}
	return n, nil
}
func loadDotEnv(name string) {
	b, err := os.ReadFile(name)
	if err != nil {
		return
	}
	for _, l := range strings.Split(string(b), "\n") {
		l = strings.TrimSpace(l)
		if l == "" || strings.HasPrefix(l, "#") {
			continue
		}
		p := strings.SplitN(l, "=", 2)
		if len(p) == 2 && os.Getenv(p[0]) == "" {
			os.Setenv(p[0], strings.Trim(strings.TrimSpace(p[1]), "\"'"))
		}
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /auth/me", s.me)
	mux.HandleFunc("POST /auth/logout", s.logout)
	mux.HandleFunc("PUT /auth/profile", s.profile)
	mux.HandleFunc("GET /auth/github", s.oauthStart("github"))
	mux.HandleFunc("GET /auth/github/callback", s.oauthCallback("github"))
	mux.HandleFunc("GET /auth/google", s.oauthStart("google"))
	mux.HandleFunc("GET /auth/google/callback", s.oauthCallback("google"))
	mux.HandleFunc("GET /group/my-groups", s.myGroups)
	mux.HandleFunc("POST /group/create", s.createGroup)
	mux.HandleFunc("POST /group/join", s.joinGroup)
	mux.HandleFunc("GET /group/{groupId}/members", s.members)
	mux.HandleFunc("PUT /group/{groupId}", s.renameGroup)
	mux.HandleFunc("PATCH /group/{groupId}/rename", s.renameGroup)
	mux.HandleFunc("DELETE /group/{groupId}", s.deleteGroup)
	mux.HandleFunc("DELETE /group/{groupId}/members/me", s.leaveGroup)
	mux.HandleFunc("GET /group/{groupId}/pages", s.listPages)
	mux.HandleFunc("POST /group/{groupId}/pages", s.createPage)
	// The frontend has historically used /group/:groupId/favorites. Retain the
	// documented nested variant too, so existing bookmarks and clients work.
	mux.HandleFunc("GET /group/{groupId}/favorites", s.listFavorites)
	mux.HandleFunc("GET /group/{groupId}/pages/favorites", s.listFavorites)
	mux.HandleFunc("POST /group/{groupId}/pages/{pageId}/favorite", s.toggleFavorite)
	mux.HandleFunc("GET /group/{groupId}/pages/{pageId}", s.getPage)
	mux.HandleFunc("PUT /group/{groupId}/pages/{pageId}", s.savePage)
	mux.HandleFunc("DELETE /group/{groupId}/pages/{pageId}", s.deletePage)
	mux.HandleFunc("POST /group/{groupId}/pages/{pageId}/duplicate", s.duplicatePage)
	mux.HandleFunc("POST /group/{groupId}/pages/{pageId}/share", s.sharePage)
	mux.HandleFunc("GET /group/{groupId}/pages/{pageId}/revisions", s.listRevisions)
	mux.HandleFunc("POST /group/{groupId}/pages/{pageId}/restore/{revisionId}", s.restoreRevision)
	mux.HandleFunc("GET /public/pages/{slug}", s.publicPage)
	mux.HandleFunc("GET /search", s.search)
	mux.HandleFunc("GET /activity/recent", s.activity)
	return s.recover(s.cors(s.security(mux)))
}

func (s *server) security(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
			if origin := r.Header.Get("Origin"); origin != "" && origin != s.cfg.frontendURL {
				writeError(w, http.StatusForbidden, "Invalid request origin.")
				return
			}
			if !s.lim.allow(clientIP(r), 100, time.Minute) {
				writeError(w, http.StatusTooManyRequests, "Too many requests. Please try again later.")
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}
func (s *server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Origin") == s.cfg.frontendURL {
			w.Header().Set("Access-Control-Allow-Origin", s.cfg.frontendURL)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
func (s *server) recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				s.log.Error("panic recovered", "error", v)
				writeError(w, 500, "Internal server error.")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
func decode(r *http.Request, dst any) error {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	return d.Decode(dst)
}
func cleanText(v string, min, max int) (string, bool) {
	v = strings.TrimSpace(v)
	return v, len([]rune(v)) >= min && len([]rune(v)) <= max
}
func randomID(bytes int) string {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type rateLimiter struct {
	mu     sync.Mutex
	values map[string]rateEntry
}
type rateEntry struct {
	count int
	reset time.Time
}

func newRateLimiter() *rateLimiter { return &rateLimiter{values: make(map[string]rateEntry)} }
func (l *rateLimiter) allow(key string, max int, period time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.values) >= maxRateKeys {
		// Do not let untrusted IP values make this in-memory limiter grow forever.
		for k, v := range l.values {
			if now.After(v.reset) {
				delete(l.values, k)
			}
		}
		if len(l.values) >= maxRateKeys {
			return false
		}
	}
	e := l.values[key]
	if now.After(e.reset) {
		e = rateEntry{reset: now.Add(period)}
	}
	e.count++
	l.values[key] = e
	return e.count <= max
}

func (s *server) sign(value string) string {
	m := hmac.New(sha256.New, []byte(s.cfg.sessionSecret))
	_, _ = m.Write([]byte(value))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}
func (s *server) setSignedCookie(w http.ResponseWriter, name, value string, age time.Duration) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: value + "." + s.sign(value), Path: "/", MaxAge: int(age.Seconds()), HttpOnly: true, Secure: s.cfg.cookieSecure, SameSite: http.SameSiteLaxMode})
}
func (s *server) signedCookie(r *http.Request, name string) (string, bool) {
	c, err := r.Cookie(name)
	if err != nil {
		return "", false
	}
	p := strings.Split(c.Value, ".")
	if len(p) != 2 || !hmac.Equal([]byte(p[1]), []byte(s.sign(p[0]))) {
		return "", false
	}
	return p[0], true
}
func (s *server) setSession(w http.ResponseWriter, userID string) {
	payload, _ := json.Marshal(session{UserID: userID, Exp: time.Now().Add(7 * 24 * time.Hour).Unix()})
	s.setSignedCookie(w, sessionName, base64.RawURLEncoding.EncodeToString(payload), 7*24*time.Hour)
	// The previous Express service used cookie-session, which has a separate
	// session.sig cookie. It is no longer needed once this signed session is set.
	s.clearCookie(w, sessionName+".sig")
}
func (s *server) userID(r *http.Request) string {
	raw, ok := s.signedCookie(r, sessionName)
	if ok {
		b, err := base64.RawURLEncoding.DecodeString(raw)
		if err == nil {
			var x session
			if json.Unmarshal(b, &x) == nil && x.Exp >= time.Now().Unix() {
				return x.UserID
			}
		}
	}
	return s.legacySessionUserID(r)
}

// legacySessionUserID permits a seamless, one-way migration from the prior
// Express cookie-session format. It accepts only a Keygrip-SHA1 signed cookie
// using the same session secret and reads just Passport's serialized user ID.
func (s *server) legacySessionUserID(r *http.Request) string {
	value, valueErr := r.Cookie(sessionName)
	signature, signatureErr := r.Cookie(sessionName + ".sig")
	if valueErr != nil || signatureErr != nil || value.Value == "" {
		return ""
	}
	h := hmac.New(sha1.New, []byte(s.cfg.sessionSecret))
	_, _ = h.Write([]byte(sessionName + "=" + value.Value))
	want := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	if !hmac.Equal([]byte(signature.Value), []byte(want)) {
		return ""
	}
	b, err := base64.StdEncoding.DecodeString(value.Value)
	if err != nil {
		return ""
	}
	var payload struct {
		Passport struct {
			User string `json:"user"`
		} `json:"passport"`
	}
	if json.Unmarshal(b, &payload) != nil {
		return ""
	}
	return payload.Passport.User
}
func (s *server) guestID(r *http.Request, groupID string) string {
	v, ok := s.signedCookie(r, "guest_"+groupID)
	if !ok {
		return ""
	}
	return v
}
func (s *server) clearCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: s.cfg.cookieSecure, SameSite: http.SameSiteLaxMode})
}

func projectRoot() string { wd, _ := os.Getwd(); return filepath.Base(wd) }
