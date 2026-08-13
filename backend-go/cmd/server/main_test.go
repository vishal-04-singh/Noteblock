package main

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newTestServer() *server {
	return &server{
		cfg: config{sessionSecret: "01234567890123456789012345678901", frontendURL: "http://localhost:5173"},
		lim: newRateLimiter(),
	}
}

func TestSignedCookiesRejectTampering(t *testing.T) {
	s := newTestServer()
	set := httptest.NewRecorder()
	s.setSignedCookie(set, "guest_group", "guest-id", time.Hour)
	cookie := set.Result().Cookies()[0]

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(cookie)
	if got, ok := s.signedCookie(req, "guest_group"); !ok || got != "guest-id" {
		t.Fatalf("valid signed cookie was rejected: %q, %v", got, ok)
	}
	cookie.Value += "tampered"
	bad := httptest.NewRequest(http.MethodGet, "/", nil)
	bad.AddCookie(cookie)
	if _, ok := s.signedCookie(bad, "guest_group"); ok {
		t.Fatal("tampered cookie was accepted")
	}
}

func TestMutationOriginIsEnforced(t *testing.T) {
	s := newTestServer()
	h := s.security(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	blocked := httptest.NewRequest(http.MethodPost, "/group/create", nil)
	blocked.Header.Set("Origin", "https://attacker.example")
	blockedResult := httptest.NewRecorder()
	h.ServeHTTP(blockedResult, blocked)
	if blockedResult.Code != http.StatusForbidden {
		t.Fatalf("got %d, want %d", blockedResult.Code, http.StatusForbidden)
	}

	allowed := httptest.NewRequest(http.MethodPost, "/group/create", nil)
	allowed.Header.Set("Origin", "http://localhost:5173")
	allowedResult := httptest.NewRecorder()
	h.ServeHTTP(allowedResult, allowed)
	if allowedResult.Code != http.StatusNoContent {
		t.Fatalf("got %d, want %d", allowedResult.Code, http.StatusNoContent)
	}
}

func TestRateLimiter(t *testing.T) {
	l := newRateLimiter()
	if !l.allow("client", 1, time.Minute) || l.allow("client", 1, time.Minute) {
		t.Fatal("rate limiter did not enforce its limit")
	}
}

func TestLegacyExpressSessionIsAccepted(t *testing.T) {
	s := newTestServer()
	payload, err := json.Marshal(map[string]any{"passport": map[string]string{"user": "existing-user"}})
	if err != nil {
		t.Fatal(err)
	}
	value := base64.StdEncoding.EncodeToString(payload)
	h := hmac.New(sha1.New, []byte(s.cfg.sessionSecret))
	_, _ = h.Write([]byte("session=" + value))
	signature := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: value})
	req.AddCookie(&http.Cookie{Name: "session.sig", Value: signature})
	if got := s.userID(req); got != "existing-user" {
		t.Fatalf("legacy session user = %q, want existing-user", got)
	}

	req.Header.Set("Cookie", "session="+value+"; session.sig=invalid")
	if got := s.userID(req); got != "" {
		t.Fatalf("invalid legacy signature authenticated %q", got)
	}
}
