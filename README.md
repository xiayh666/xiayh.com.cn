# CM311 Knowledge Site

Lightweight dynamic personal knowledge site for a CM311 box running Armbian Ubuntu.

The private GitHub notes repository is only the raw content source. Publication metadata, render cache, sessions, share tokens, sync logs, and FTS5 search live in SQLite.

## Layout

```text
backend/fastify/  Current TypeScript/Fastify API service
backend/src/      Reserved C++/Boost.Beast migration implementation
frontend/  React + Vite static site
deploy/    Caddy and systemd templates
data/      local SQLite and notes checkout, ignored by Git
doc/       goal-driven design notes
```

## Backend setup

```bash
pnpm --dir backend/fastify install
cp deploy/blog.env .env
# Edit .env and replace every secret/example value.
pnpm --dir backend/fastify dev
```

Initialize the local C++ example note once before the first run:

```bash
pnpm --dir backend/fastify seed:examples
```

Generate a password hash for `ADMIN_PASSWORD`:

```bash
pnpm --dir backend/fastify hash-password 'your-password'
```

Generate independent JWT and sync secrets, for example:

```bash
openssl rand -hex 32
```

The API listens on `127.0.0.1:8080`. The Vite development server proxies `/api`
to that address.

## Build

```bash
pnpm --dir backend/fastify build
pnpm --dir frontend install
pnpm --dir frontend build
```

Or stage a deployable package:

```bash
xmake package
```

## Unit Tests

```bash
pnpm --dir backend/fastify typecheck
pnpm --dir backend/fastify test
pnpm --dir frontend test
```

Or run both suites through the top-level task:

```bash
xmake test
```

## Backend architecture

- `src/app.ts`: Fastify composition root and security plugins.
- `src/routes`: stable HTTP contract consumed by the frontend.
- `src/services`: framework-independent note synchronization and queries.
- `src/database.ts`: SQLite schema and connection lifecycle.
- `src/config.ts`: environment configuration and startup validation.

Fastify uses an explicit CORS allow-list, Helmet headers, request/rate limits,
JSON Schema validation, JWT authentication in an HttpOnly SameSite cookie, and
Origin checks on admin mutations. The timer uses a separate `SYNC_TOKEN`; it
does not store or transmit the administrator password.

## Initial Content Sync

Clone the private notes repository with a read-only SSH deploy key:

```bash
git clone git@github.com:OWNER/PRIVATE-NOTES.git data/notes
```

Run an admin sync from the UI or call:

```bash
curl -X POST http://127.0.0.1:8080/api/admin/sync \
  -H "x-sync-token: $SYNC_TOKEN" \
  -H 'content-type: application/json' \
  --data '{}'
```

New Markdown files are indexed as `visibility = private` and `published = false`.

Images uploaded from the owner editor are stored under `MEDIA_ROOT` and served from
`/api/media/`. The default per-image limit is 5 MiB and can be changed with
`IMAGE_UPLOAD_LIMIT`.

## Deployment Notes

- Put packaged files under `/opt/cm311-knowledge`.
- Copy `deploy/blog.env` to `/opt/cm311-knowledge/blog.env`, restrict it to the service user, and replace all secrets.
- Install production dependencies with `pnpm --dir /opt/cm311-knowledge/backend install --prod --frozen-lockfile`.
- Install `deploy/blog-api.service`, `deploy/blog-sync.service`, and `deploy/blog-sync.timer`.
- Point `deploy/Caddyfile` at your real domain.
- Do not expose `data/notes`, `.git`, or `.excalidraw` sources directly.

## Current limits

- Search currently uses indexed SQLite tables with bounded `LIKE` queries; FTS5 can replace the repository function without changing routes.
- JWT logout clears the browser cookie but does not maintain a server-side revocation list; tokens are intentionally short-lived.
- Sync scans Markdown only; Excalidraw preview mapping remains reserved in the API model.
