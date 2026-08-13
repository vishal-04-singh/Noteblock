package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/oauth2"
)

type user struct {
	ID         string    `json:"id"`
	Provider   string    `json:"provider"`
	ProviderID string    `json:"providerId"`
	Name       string    `json:"name"`
	Email      *string   `json:"email"`
	AvatarURL  *string   `json:"avatarUrl"`
	CreatedAt  time.Time `json:"createdAt"`
}
type membership struct {
	GroupID, UserID, GuestID, GuestName, Role string
	DisplayName                               string
}

func (s *server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	id := s.userID(r)
	if id == "" {
		writeJSON(w, 401, map[string]any{"user": nil})
		return
	}
	var u user
	err := s.db.QueryRow(r.Context(), `SELECT "id","provider"::text,"providerId","name","email","avatarUrl","createdAt" FROM "User" WHERE "id"=$1`, id).Scan(&u.ID, &u.Provider, &u.ProviderID, &u.Name, &u.Email, &u.AvatarURL, &u.CreatedAt)
	if err == pgx.ErrNoRows {
		s.clearCookie(w, sessionName)
		writeJSON(w, 401, map[string]any{"user": nil})
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load user.")
		return
	}
	writeJSON(w, 200, map[string]any{"user": u})
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	s.clearCookie(w, sessionName)
	s.clearCookie(w, sessionName+".sig")
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (s *server) profile(w http.ResponseWriter, r *http.Request) {
	id := s.userID(r)
	if id == "" {
		writeError(w, 401, "Not logged in.")
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decode(r, &body); err != nil {
		writeError(w, 400, "Invalid request body.")
		return
	}
	name, ok := cleanText(body.Name, 1, 80)
	if !ok {
		writeError(w, 400, "Name must be between 1 and 80 characters.")
		return
	}
	var u user
	err := s.db.QueryRow(r.Context(), `UPDATE "User" SET "name"=$2 WHERE "id"=$1 RETURNING "id","provider"::text,"providerId","name","email","avatarUrl","createdAt"`, id, name).Scan(&u.ID, &u.Provider, &u.ProviderID, &u.Name, &u.Email, &u.AvatarURL, &u.CreatedAt)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't update profile.")
		return
	}
	writeJSON(w, 200, map[string]any{"user": u})
}

func (s *server) oauthStart(provider string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !s.lim.allow("oauth:"+clientIP(r), 10, time.Minute) {
			writeError(w, 429, "Too many login attempts. Please try again later.")
			return
		}
		cfg := s.provider(provider)
		if cfg.ClientID == "" {
			writeError(w, 503, provider+" login is not configured.")
			return
		}
		state := randomID(32)
		s.setSignedCookie(w, "oauth_state", provider+":"+state, 10*time.Minute)
		http.Redirect(w, r, cfg.AuthCodeURL(state, oauth2.AccessTypeOffline), http.StatusFound)
	}
}
func (s *server) oauthCallback(provider string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg := s.provider(provider)
		state := r.URL.Query().Get("state")
		saved, ok := s.signedCookie(r, "oauth_state")
		s.clearCookie(w, "oauth_state")
		if cfg.ClientID == "" || !ok || saved != provider+":"+state || state == "" {
			writeError(w, 400, "Invalid or expired login request. Please try again.")
			return
		}
		if r.URL.Query().Get("error") != "" {
			http.Redirect(w, r, s.cfg.frontendURL+"/login?error="+url.QueryEscape(provider), http.StatusFound)
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			writeError(w, http.StatusBadRequest, "Invalid login response. Please try again.")
			return
		}
		// Provider calls are bounded independently of the request write timeout.
		// This prevents a slow OAuth provider from tying up a handler indefinitely.
		oauthCtx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		token, err := cfg.Exchange(oauthCtx, code)
		if err != nil {
			s.log.Error("OAuth token exchange failed", "provider", provider, "error", err)
			http.Redirect(w, r, s.cfg.frontendURL+"/login?error="+url.QueryEscape(provider), http.StatusFound)
			return
		}
		profile, err := fetchProfile(oauthCtx, provider, token.AccessToken)
		if err != nil {
			s.log.Error("OAuth profile fetch failed", "provider", provider, "error", err)
			http.Redirect(w, r, s.cfg.frontendURL+"/login?error="+url.QueryEscape(provider), http.StatusFound)
			return
		}
		var id string
		err = s.db.QueryRow(r.Context(), `INSERT INTO "User" ("id","provider","providerId","name","email","avatarUrl") VALUES ($1,$2::"AuthProvider",$3,$4,$5,$6) ON CONFLICT ("provider","providerId") DO UPDATE SET "name"=EXCLUDED."name", "email"=EXCLUDED."email", "avatarUrl"=EXCLUDED."avatarUrl" RETURNING "id"`, randomID(18), provider, profile.ID, profile.Name, profile.Email, profile.Avatar).Scan(&id)
		if err != nil {
			s.dbError(err)
			http.Redirect(w, r, s.cfg.frontendURL+"/login?error="+url.QueryEscape(provider), http.StatusFound)
			return
		}
		s.setSession(w, id)
		http.Redirect(w, r, s.cfg.frontendURL+"/home", http.StatusFound)
	}
}
func (s *server) provider(name string) oauth2.Config {
	if name == "github" {
		return s.cfg.github
	}
	return s.cfg.google
}

type oauthProfile struct {
	ID, Name      string
	Email, Avatar *string
}

func fetchProfile(ctx context.Context, provider, access string) (oauthProfile, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, map[string]string{"github": "https://api.github.com/user", "google": "https://openidconnect.googleapis.com/v1/userinfo"}[provider], nil)
	if err != nil {
		return oauthProfile{}, err
	}
	req.Header.Set("Authorization", "Bearer "+access)
	req.Header.Set("Accept", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return oauthProfile{}, err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		return oauthProfile{}, fmt.Errorf("profile response status %d", res.StatusCode)
	}
	var raw struct {
		ID        any     `json:"id"`
		Sub       string  `json:"sub"`
		Login     string  `json:"login"`
		Name      string  `json:"name"`
		Email     *string `json:"email"`
		AvatarURL *string `json:"avatar_url"`
		Picture   *string `json:"picture"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&raw); err != nil {
		return oauthProfile{}, err
	}
	id := raw.Sub
	if id == "" {
		id = fmt.Sprint(raw.ID)
	}
	if id == "" || id == "<nil>" {
		return oauthProfile{}, fmt.Errorf("missing provider identifier")
	}
	name := strings.TrimSpace(raw.Name)
	if name == "" {
		name = raw.Login
	}
	if name == "" {
		name = "User"
	}
	avatar := raw.AvatarURL
	if avatar == nil {
		avatar = raw.Picture
	}
	return oauthProfile{ID: id, Name: name, Email: raw.Email, Avatar: avatar}, nil
}

func (s *server) requireMembership(w http.ResponseWriter, r *http.Request, groupID string) (membership, bool) {
	uid := s.userID(r)
	gid := ""
	if uid == "" {
		gid = s.guestID(r, groupID)
		if gid == "" {
			writeError(w, 403, "You're not a member of this group.")
			return membership{}, false
		}
	}
	var m membership
	err := s.db.QueryRow(r.Context(), `SELECT gm."groupId",COALESCE(gm."userId",''),COALESCE(gm."guestId",''),COALESCE(gm."guestName",''),gm."role"::text,COALESCE(u."name",gm."guestName",'Guest') FROM "GroupMember" gm LEFT JOIN "User" u ON u."id"=gm."userId" WHERE gm."groupId"=$1 AND (($2<>'' AND gm."userId"=$2) OR ($3<>'' AND gm."guestId"=$3))`, groupID, uid, gid).Scan(&m.GroupID, &m.UserID, &m.GuestID, &m.GuestName, &m.Role, &m.DisplayName)
	if err == pgx.ErrNoRows {
		writeError(w, 403, "You're not a member of this group.")
		return membership{}, false
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't verify group access.")
		return membership{}, false
	}
	return m, true
}
func requireEdit(w http.ResponseWriter, m membership) bool {
	if m.Role == "owner" || m.Role == "editor" {
		return true
	}
	writeError(w, 403, "You have read-only access to this group.")
	return false
}
func requireOwner(w http.ResponseWriter, m membership) bool {
	if m.Role == "owner" {
		return true
	}
	writeError(w, 403, "Only the owner can perform this action.")
	return false
}

func (s *server) myGroups(w http.ResponseWriter, r *http.Request) {
	uid := s.userID(r)
	args := []any{}
	where := ""
	if uid != "" {
		where = `gm."userId"=$1`
		args = append(args, uid)
	} else {
		cookies := r.Cookies()
		guests := make([]string, 0)
		for _, c := range cookies {
			if strings.HasPrefix(c.Name, "guest_") {
				group := strings.TrimPrefix(c.Name, "guest_")
				if v, ok := s.signedCookie(r, c.Name); ok {
					guests = append(guests, group+":"+v)
				}
			}
		}
		if len(guests) == 0 {
			writeJSON(w, 200, map[string]any{"groups": []any{}})
			return
		}
		clauses := make([]string, 0, len(guests))
		for i, p := range guests {
			x := strings.SplitN(p, ":", 2)
			clauses = append(clauses, fmt.Sprintf("(gm.\"groupId\"=$%d AND gm.\"guestId\"=$%d)", i*2+1, i*2+2))
			args = append(args, x[0], x[1])
		}
		where = "(" + strings.Join(clauses, " OR ") + ")"
	}
	q := `SELECT g."id",g."name",g."code",g."createdAt",(SELECT count(*) FROM "Page" p WHERE p."groupId"=g."id"),(SELECT count(*) FROM "GroupMember" mm WHERE mm."groupId"=g."id"),COALESCE((SELECT max(p."updatedAt") FROM "Page" p WHERE p."groupId"=g."id"),g."createdAt") FROM "GroupMember" gm JOIN "Group" g ON g."id"=gm."groupId" WHERE ` + where + ` ORDER BY 7 DESC`
	rows, err := s.db.Query(r.Context(), q, args...)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Something went wrong fetching your groups.")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, code string
		var created, last time.Time
		var pages, members int
		if err := rows.Scan(&id, &name, &code, &created, &pages, &members, &last); err != nil {
			continue
		}
		out = append(out, map[string]any{"id": id, "name": name, "code": code, "createdAt": created, "pageCount": pages, "memberCount": members, "lastActivity": last})
	}
	writeJSON(w, 200, map[string]any{"groups": out})
}

func secureCode() string {
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return strings.ToUpper(hex.EncodeToString(b))
}
func (s *server) createGroup(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, 400, "Invalid request body.")
		return
	}
	name, ok := cleanText(b.Name, 1, 120)
	if !ok {
		writeError(w, 400, "Enter a group name up to 120 characters.")
		return
	}
	uid := s.userID(r)
	guest, guestOK := cleanText(b.DisplayName, 1, 80)
	if uid == "" && !guestOK {
		writeError(w, 400, "Enter a display name to create a group.")
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't create group.")
		return
	}
	defer tx.Rollback(ctx)
	id := randomID(18)
	var code string
	for i := 0; i < 5; i++ {
		code = secureCode()
		_, err = tx.Exec(ctx, `INSERT INTO "Group" ("id","name","code","isAnonymous","ownerId") VALUES ($1,$2,$3,$4,$5)`, id, name, code, uid == "", nullString(uid))
		if err == nil {
			break
		}
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't create group.")
		return
	}
	member := map[string]any{"groupId": id, "role": "owner"}
	if uid != "" {
		_, err = tx.Exec(ctx, `INSERT INTO "GroupMember" ("id","groupId","userId","role") VALUES ($1,$2,$3,'owner')`, randomID(18), id, uid)
		member["userId"] = uid
	} else {
		gid := randomID(18)
		_, err = tx.Exec(ctx, `INSERT INTO "GroupMember" ("id","groupId","guestId","guestName","role") VALUES ($1,$2,$3,$4,'owner')`, randomID(18), id, gid, guest)
		member["guestId"] = gid
		member["guestName"] = guest
		s.setSignedCookie(w, "guest_"+id, gid, 30*24*time.Hour)
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't create group.")
		return
	}
	if err = tx.Commit(ctx); err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't create group.")
		return
	}
	writeJSON(w, 200, map[string]any{"group": map[string]any{"id": id, "name": name, "code": code}, "member": member})
}
func nullString(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func (s *server) joinGroup(w http.ResponseWriter, r *http.Request) {
	var b struct {
		Code        string `json:"code"`
		DisplayName string `json:"displayName"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, 400, "Invalid request body.")
		return
	}
	code, ok := cleanText(strings.ToUpper(b.Code), 6, 32)
	if !ok {
		writeError(w, 400, "Enter a valid group code.")
		return
	}
	uid := s.userID(r)
	name, nameOK := cleanText(b.DisplayName, 1, 80)
	if uid == "" && !nameOK {
		writeError(w, 400, "Enter a display name to join as a guest.")
		return
	}
	var id, gname string
	err := s.db.QueryRow(r.Context(), `SELECT "id","name" FROM "Group" WHERE "code"=$1`, code).Scan(&id, &gname)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "This group code is not valid.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't join group.")
		return
	}
	if uid != "" {
		_, err = s.db.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","userId","role") VALUES ($1,$2,$3,'editor') ON CONFLICT ("groupId","userId") DO NOTHING`, randomID(18), id, uid)
	} else {
		gid := s.guestID(r, id)
		if gid == "" {
			gid = randomID(18)
		}
		_, err = s.db.Exec(r.Context(), `INSERT INTO "GroupMember" ("id","groupId","guestId","guestName","role") VALUES ($1,$2,$3,$4,'editor') ON CONFLICT ("groupId","guestId") DO UPDATE SET "guestName"=EXCLUDED."guestName"`, randomID(18), id, gid, name)
		s.setSignedCookie(w, "guest_"+id, gid, 30*24*time.Hour)
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't join group.")
		return
	}
	writeJSON(w, 200, map[string]any{"group": map[string]any{"id": id, "name": gname, "code": code, "created": false}})
}

func (s *server) members(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("groupId")
	if _, ok := s.requireMembership(w, r, groupID); !ok {
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT gm."id",COALESCE(u."name",gm."guestName",'Guest'),u."avatarUrl",gm."role"::text,(gm."userId" IS NULL) FROM "GroupMember" gm LEFT JOIN "User" u ON u."id"=gm."userId" WHERE gm."groupId"=$1 ORDER BY gm."joinedAt"`, groupID)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load members.")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, role string
		var avatar *string
		var guest bool
		if err := rows.Scan(&id, &name, &avatar, &role, &guest); err == nil {
			out = append(out, map[string]any{"id": id, "name": name, "avatarUrl": avatar, "role": role, "isGuest": guest})
		}
	}
	writeJSON(w, 200, map[string]any{"members": out})
}
func (s *server) renameGroup(w http.ResponseWriter, r *http.Request) {
	groupID := r.PathValue("groupId")
	m, ok := s.requireMembership(w, r, groupID)
	if !ok || !requireOwner(w, m) {
		return
	}
	var b struct {
		Name string `json:"name"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, 400, "Invalid request body.")
		return
	}
	name, valid := cleanText(b.Name, 1, 120)
	if !valid {
		writeError(w, 400, "Name must be between 1 and 120 characters.")
		return
	}
	var id, code string
	err := s.db.QueryRow(r.Context(), `UPDATE "Group" SET "name"=$2 WHERE "id"=$1 RETURNING "id","code"`, groupID, name).Scan(&id, &code)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't rename group.")
		return
	}
	writeJSON(w, 200, map[string]any{"group": map[string]any{"id": id, "name": name, "code": code}})
}
func (s *server) deleteGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("groupId")
	m, ok := s.requireMembership(w, r, id)
	if !ok || !requireOwner(w, m) {
		return
	}
	tag, err := s.db.Exec(r.Context(), `DELETE FROM "Group" WHERE "id"=$1`, id)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't delete group.")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, 404, "Group not found.")
		return
	}
	if m.GuestID != "" {
		s.clearCookie(w, "guest_"+id)
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
func (s *server) leaveGroup(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("groupId")
	m, ok := s.requireMembership(w, r, id)
	if !ok {
		return
	}
	if m.Role == "owner" {
		writeError(w, 400, "The owner cannot leave the group. Delete it or transfer ownership first.")
		return
	}
	_, err := s.db.Exec(r.Context(), `DELETE FROM "GroupMember" WHERE "groupId"=$1 AND (("userId"=$2 AND $2<>'') OR ("guestId"=$3 AND $3<>''))`, id, m.UserID, m.GuestID)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't leave group.")
		return
	}
	if m.GuestID != "" {
		s.clearCookie(w, "guest_"+id)
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *server) listPages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("groupId")
	if _, ok := s.requireMembership(w, r, id); !ok {
		return
	}
	var name, code string
	err := s.db.QueryRow(r.Context(), `SELECT "name","code" FROM "Group" WHERE "id"=$1`, id).Scan(&name, &code)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Group not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load pages.")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT "id","title","icon","updatedAt","createdAt","lastEditedByName","isPublic" FROM "Page" WHERE "groupId"=$1 ORDER BY "updatedAt" DESC`, id)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load pages.")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var pid, title string
		var icon, editor *string
		var updated, created time.Time
		var public bool
		if rows.Scan(&pid, &title, &icon, &updated, &created, &editor, &public) == nil {
			out = append(out, map[string]any{"id": pid, "title": title, "icon": icon, "updatedAt": updated, "createdAt": created, "lastEditedByName": editor, "isPublic": public})
		}
	}
	writeJSON(w, 200, map[string]any{"pages": out, "group": map[string]string{"name": name, "code": code}})
}
func (s *server) createPage(w http.ResponseWriter, r *http.Request) {
	gid := r.PathValue("groupId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok || !requireEdit(w, m) {
		return
	}
	var b struct {
		Title string `json:"title"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, 400, "Invalid request body.")
		return
	}
	title := strings.TrimSpace(b.Title)
	if title == "" {
		title = "Untitled"
	}
	if _, valid := cleanText(title, 1, 200); !valid {
		writeError(w, 400, "Title must be at most 200 characters.")
		return
	}
	id := randomID(18)
	content := json.RawMessage(`{}`)
	page, err := s.insertPage(r.Context(), id, gid, title, content, m)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't create the page.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}

func (s *server) getPage(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	if _, ok := s.requireMembership(w, r, gid); !ok {
		return
	}
	page, err := s.pageInGroup(r.Context(), gid, pid)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load the page.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}
func (s *server) savePage(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok || !requireEdit(w, m) {
		return
	}
	var b struct {
		Content json.RawMessage `json:"content"`
		Title   *string         `json:"title"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, 400, "Invalid page data.")
		return
	}
	if b.Content != nil && !json.Valid(b.Content) {
		writeError(w, 400, "Content must be valid JSON.")
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't save the page.")
		return
	}
	defer tx.Rollback(ctx)
	var old json.RawMessage
	var title, editor string
	err = tx.QueryRow(ctx, `SELECT "content","title",COALESCE("lastEditedByName",'Someone') FROM "Page" WHERE "id"=$1 AND "groupId"=$2 FOR UPDATE`, pid, gid).Scan(&old, &title, &editor)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't save the page.")
		return
	}
	if b.Title != nil {
		var valid bool
		title, valid = cleanText(*b.Title, 1, 200)
		if !valid {
			writeError(w, 400, "Title must be between 1 and 200 characters.")
			return
		}
	}
	content := old
	if b.Content != nil {
		content = b.Content
	}
	_, err = tx.Exec(ctx, `INSERT INTO "Revision" ("id","pageId","memberId","editedByName","snapshot") VALUES ($1,$2,$3,$4,$5)`, randomID(18), pid, nullString(m.UserID), editor, old)
	if err == nil {
		_, err = tx.Exec(ctx, `UPDATE "Page" SET "content"=$2,"title"=$3,"lastEditedByName"=$4,"updatedAt"=NOW() WHERE "id"=$1`, pid, content, title, m.DisplayName)
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't save the page.")
		return
	}
	if err = tx.Commit(ctx); err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't save the page.")
		return
	}
	page, err := s.pageInGroup(ctx, gid, pid)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't save the page.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}
func (s *server) deletePage(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok || !requireEdit(w, m) {
		return
	}
	tag, err := s.db.Exec(r.Context(), `DELETE FROM "Page" WHERE "id"=$1 AND "groupId"=$2`, pid, gid)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't delete the page.")
		return
	}
	if tag.RowsAffected() == 0 {
		writeError(w, 404, "Page not found.")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *server) duplicatePage(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok || !requireEdit(w, m) {
		return
	}
	old, err := s.pageInGroup(r.Context(), gid, pid)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't duplicate the page.")
		return
	}
	title := fmt.Sprintf("%s (copy)", old["title"])
	content := old["content"].(json.RawMessage)
	page, err := s.insertPage(r.Context(), randomID(18), gid, title, content, m)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't duplicate the page.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}
func (s *server) sharePage(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok || !requireEdit(w, m) {
		return
	}
	var b struct {
		IsPublic bool `json:"isPublic"`
	}
	if err := decode(r, &b); err != nil {
		writeError(w, 400, "Invalid request body.")
		return
	}
	var existing string
	err := s.db.QueryRow(r.Context(), `SELECT COALESCE("publicSlug",'') FROM "Page" WHERE "id"=$1 AND "groupId"=$2`, pid, gid).Scan(&existing)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't update sharing.")
		return
	}
	if b.IsPublic && existing == "" {
		existing = randomID(18)
	}
	_, err = s.db.Exec(r.Context(), `UPDATE "Page" SET "isPublic"=$2,"publicSlug"=CASE WHEN $2 THEN $3 ELSE NULL END,"updatedAt"=NOW() WHERE "id"=$1`, pid, b.IsPublic, existing)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't update sharing.")
		return
	}
	page, err := s.pageInGroup(r.Context(), gid, pid)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't update sharing.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}
func (s *server) listRevisions(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	if _, ok := s.requireMembership(w, r, gid); !ok {
		return
	}
	if _, err := s.pageInGroup(r.Context(), gid, pid); err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT "id","pageId","editedByName","snapshot","createdAt" FROM "Revision" WHERE "pageId"=$1 ORDER BY "createdAt" DESC LIMIT 100`, pid)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load history.")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, pageID string
		var by *string
		var snap json.RawMessage
		var created time.Time
		if rows.Scan(&id, &pageID, &by, &snap, &created) == nil {
			out = append(out, map[string]any{"id": id, "pageId": pageID, "editedByName": by, "snapshot": snap, "createdAt": created})
		}
	}
	writeJSON(w, 200, map[string]any{"revisions": out})
}
func (s *server) restoreRevision(w http.ResponseWriter, r *http.Request) {
	gid, pid, rid := r.PathValue("groupId"), r.PathValue("pageId"), r.PathValue("revisionId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok || !requireEdit(w, m) {
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't restore revision.")
		return
	}
	defer tx.Rollback(ctx)
	var old json.RawMessage
	err = tx.QueryRow(ctx, `SELECT "content" FROM "Page" WHERE "id"=$1 AND "groupId"=$2 FOR UPDATE`, pid, gid).Scan(&old)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't restore revision.")
		return
	}
	var snap json.RawMessage
	err = tx.QueryRow(ctx, `SELECT "snapshot" FROM "Revision" WHERE "id"=$1 AND "pageId"=$2`, rid, pid).Scan(&snap)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "Revision not found.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't restore revision.")
		return
	}
	_, err = tx.Exec(ctx, `INSERT INTO "Revision" ("id","pageId","memberId","editedByName","snapshot") VALUES ($1,$2,$3,$4,$5)`, randomID(18), pid, nullString(m.UserID), m.DisplayName, old)
	if err == nil {
		_, err = tx.Exec(ctx, `UPDATE "Page" SET "content"=$2,"lastEditedByName"=$3,"updatedAt"=NOW() WHERE "id"=$1`, pid, snap, m.DisplayName)
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't restore revision.")
		return
	}
	if err = tx.Commit(ctx); err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't restore revision.")
		return
	}
	page, err := s.pageInGroup(ctx, gid, pid)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't restore revision.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}

func (s *server) toggleFavorite(w http.ResponseWriter, r *http.Request) {
	gid, pid := r.PathValue("groupId"), r.PathValue("pageId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok {
		return
	}
	if _, err := s.pageInGroup(r.Context(), gid, pid); err == pgx.ErrNoRows {
		writeError(w, 404, "Page not found.")
		return
	}
	var id string
	err := s.db.QueryRow(r.Context(), `SELECT "id" FROM "Favorite" WHERE "pageId"=$1 AND (("userId"=$2 AND $2<>'') OR ("guestId"=$3 AND $3<>''))`, pid, m.UserID, m.GuestID).Scan(&id)
	if err == nil {
		_, err = s.db.Exec(r.Context(), `DELETE FROM "Favorite" WHERE "id"=$1`, id)
		if err != nil {
			s.dbError(err)
			writeError(w, 500, "Couldn't toggle favorite.")
			return
		}
		writeJSON(w, 200, map[string]bool{"favorited": false})
		return
	}
	if err != pgx.ErrNoRows {
		s.dbError(err)
		writeError(w, 500, "Couldn't toggle favorite.")
		return
	}
	_, err = s.db.Exec(r.Context(), `INSERT INTO "Favorite" ("id","pageId","userId","guestId") VALUES ($1,$2,$3,$4)`, randomID(18), pid, nullString(m.UserID), nullString(m.GuestID))
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't toggle favorite.")
		return
	}
	writeJSON(w, 200, map[string]bool{"favorited": true})
}
func (s *server) listFavorites(w http.ResponseWriter, r *http.Request) {
	gid := r.PathValue("groupId")
	m, ok := s.requireMembership(w, r, gid)
	if !ok {
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT f."pageId" FROM "Favorite" f JOIN "Page" p ON p."id"=f."pageId" WHERE p."groupId"=$1 AND ((f."userId"=$2 AND $2<>'') OR (f."guestId"=$3 AND $3<>''))`, gid, m.UserID, m.GuestID)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load favorites.")
		return
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	writeJSON(w, 200, map[string]any{"favoritePageIds": out})
}

func (s *server) publicPage(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if len(slug) < 6 || len(slug) > 64 {
		writeError(w, 404, "This link isn't valid anymore.")
		return
	}
	page, err := s.pagePublic(r.Context(), slug)
	if err == pgx.ErrNoRows {
		writeError(w, 404, "This link isn't valid anymore.")
		return
	}
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load this page.")
		return
	}
	writeJSON(w, 200, map[string]any{"page": page})
}
func (s *server) search(w http.ResponseWriter, r *http.Request) {
	q, valid := cleanText(r.URL.Query().Get("q"), 1, 100)
	if !valid {
		writeJSON(w, 200, map[string]any{"results": []any{}})
		return
	}
	groups := s.accessibleGroups(r)
	if len(groups) == 0 {
		writeJSON(w, 200, map[string]any{"results": []any{}})
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT p."id",p."title",p."groupId",g."name" FROM "Page" p JOIN "Group" g ON g."id"=p."groupId" WHERE p."groupId"=ANY($1) AND p."title" ILIKE '%' || $2 || '%' ORDER BY p."updatedAt" DESC LIMIT 20`, groups, q)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Search failed.")
		return
	}
	defer rows.Close()
	out := []map[string]string{}
	for rows.Next() {
		var id, title, gid, gname string
		if rows.Scan(&id, &title, &gid, &gname) == nil {
			out = append(out, map[string]string{"id": id, "title": title, "groupId": gid, "groupName": gname})
		}
	}
	writeJSON(w, 200, map[string]any{"results": out})
}
func (s *server) activity(w http.ResponseWriter, r *http.Request) {
	groups := s.accessibleGroups(r)
	if len(groups) == 0 {
		writeJSON(w, 200, map[string]any{"activity": []any{}})
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT r."id",COALESCE(r."editedByName",'Someone'),p."id",p."title",p."groupId",g."name",r."createdAt" FROM "Revision" r JOIN "Page" p ON p."id"=r."pageId" JOIN "Group" g ON g."id"=p."groupId" WHERE p."groupId"=ANY($1) ORDER BY r."createdAt" DESC LIMIT 10`, groups)
	if err != nil {
		s.dbError(err)
		writeError(w, 500, "Couldn't load activity.")
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, by, pid, title, gid, gname string
		var created time.Time
		if rows.Scan(&id, &by, &pid, &title, &gid, &gname, &created) == nil {
			out = append(out, map[string]any{"id": id, "editedByName": by, "pageId": pid, "pageTitle": title, "groupId": gid, "groupName": gname, "createdAt": created})
		}
	}
	writeJSON(w, 200, map[string]any{"activity": out})
}

func (s *server) insertPage(ctx context.Context, id, groupID, title string, content json.RawMessage, m membership) (map[string]any, error) {
	_, err := s.db.Exec(ctx, `INSERT INTO "Page" ("id","groupId","title","content","createdBy","lastEditedByName","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())`, id, groupID, title, content, nullString(m.UserID), m.DisplayName)
	if err != nil {
		return nil, err
	}
	return s.pageInGroup(ctx, groupID, id)
}
func (s *server) pageInGroup(ctx context.Context, groupID, pageID string) (map[string]any, error) {
	var id, gid, title string
	var parent, icon, publicSlug, editor *string
	var content json.RawMessage
	var public bool
	var updated, created time.Time
	err := s.db.QueryRow(ctx, `SELECT "id","groupId","parentId","title","icon","content","isPublic","publicSlug","lastEditedByName","updatedAt","createdAt" FROM "Page" WHERE "id"=$1 AND "groupId"=$2`, pageID, groupID).Scan(&id, &gid, &parent, &title, &icon, &content, &public, &publicSlug, &editor, &updated, &created)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "groupId": gid, "parentId": parent, "title": title, "icon": icon, "content": content, "isPublic": public, "publicSlug": publicSlug, "lastEditedByName": editor, "updatedAt": updated, "createdAt": created}, nil
}
func (s *server) pagePublic(ctx context.Context, slug string) (map[string]any, error) {
	var id, title string
	var icon, editor *string
	var content json.RawMessage
	var updated time.Time
	err := s.db.QueryRow(ctx, `SELECT "id","title","icon","content","updatedAt","lastEditedByName" FROM "Page" WHERE "publicSlug"=$1 AND "isPublic"=true`, slug).Scan(&id, &title, &icon, &content, &updated, &editor)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": id, "title": title, "icon": icon, "content": content, "updatedAt": updated, "lastEditedByName": editor}, nil
}
func (s *server) accessibleGroups(r *http.Request) []string {
	ctx := r.Context()
	uid := s.userID(r)
	if uid != "" {
		rows, err := s.db.Query(ctx, `SELECT "groupId" FROM "GroupMember" WHERE "userId"=$1`, uid)
		if err != nil {
			s.dbError(err)
			return nil
		}
		defer rows.Close()
		out := []string{}
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil {
				out = append(out, id)
			}
		}
		return out
	}
	out := []string{}
	for _, c := range r.Cookies() {
		if !strings.HasPrefix(c.Name, "guest_") {
			continue
		}
		group := strings.TrimPrefix(c.Name, "guest_")
		guest, ok := s.signedCookie(r, c.Name)
		if !ok {
			continue
		}
		var exists bool
		err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM "GroupMember" WHERE "groupId"=$1 AND "guestId"=$2)`, group, guest).Scan(&exists)
		if err == nil && exists {
			out = append(out, group)
		}
	}
	return out
}
func (s *server) dbError(err error) { s.log.Error("database operation failed", "error", err) }
