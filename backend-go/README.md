# Go backend

This is the production replacement for the legacy Express backend. It keeps the
same frontend API routes and PostgreSQL schema, so no data migration is needed.

## Run locally

```sh
cp .env.example .env
# Set DATABASE_URL and a 32+ character SESSION_SECRET.
go run ./cmd/server
```

The service listens on `PORT` (default `4000`). Point the existing frontend's
`BACKEND_URL` to it as before.

## GitHub OAuth

Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and either `BACKEND_URL` or
`GITHUB_CALLBACK_URL`. In
the GitHub OAuth App settings, the **Authorization callback URL must exactly
equal** `GITHUB_CALLBACK_URL`—including protocol, hostname, port, and path.
For local development that is normally:

```
http://localhost:4000/auth/github/callback
```

The old server ignored `GITHUB_CALLBACK_URL`; the Go service uses it. A
mismatch, an incorrect client secret, or credentials for a different OAuth app
is the normal cause of GitHub's “Failed to obtain access token” response.

On Render, set `BACKEND_URL` and `GITHUB_CALLBACK_URL` to the API's public
`https://…onrender.com` URL, set `COOKIE_SECURE=true`, and register that exact
callback in the GitHub OAuth App. Keep the prior `SESSION_SECRET` during the
first Go deployment so existing Express sessions remain valid until users log
in again.

## Throughput

Go's HTTP server serves requests concurrently. PostgreSQL access is bounded and
reused through `pgx`; tune `DB_MAX_CONNS` (default `20`) and `DB_MIN_CONNS`
(default `2`) to fit the database plan's connection limit. Increasing these
above the database limit will make performance worse, not better.

## Security changes

- Requires a strong session secret; there is no development fallback.
- Uses signed, HTTP-only, SameSite cookies and OAuth state validation.
- Enforces owner/editor/viewer permissions on every group and page mutation.
- Requires membership before listing people or content.
- Uses 12-character cryptographically random invite codes for new groups.
  Existing six-character groups remain joinable.
- Rejects unknown join codes rather than silently creating workspaces.
- Enforces one-megabyte request bodies, input limits, same-origin mutation
  requests, basic per-IP rate limiting, safe error responses, and standard
  response hardening headers.
- Uses a bounded PostgreSQL connection pool and Go's concurrent HTTP server.
