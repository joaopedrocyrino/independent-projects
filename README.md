# Projects

A mobile-first portfolio and project-demo manager for **projects.joaocyrino.com**. React and the REST API ship together in a single .NET container.

## What works

- Public gallery at `/`: search, shareable stack/cloud/type filters, pagination, featured projects.
- Project pages at `/p/:slug`: description, original image/video previews, demo, repository, and website links. Any combination of links is supported.
- Optional click-to-load external iframe demo. A remote website can refuse embedding; its direct link remains available.
- Protected admin at `/admin`: create/edit/delete, draft/publish/archive, categorization, upload previews, captions, preview order, and cover selection.
- Account password change, revocable cookie sessions, CSRF protection, login lockout, and request/upload limits.
- GitHub Actions builds, verifies, publishes to GHCR, and deploys to the existing shared Caddy droplet.

## Stack and layout

.NET 10, ASP.NET Core, EF Core/Npgsql, PostgreSQL 17; React 19, TypeScript, Vite, React Router, TanStack Query. Native CSS is split by component/page. Admin and detail routes are loaded lazily, including their CSS.

```text
src/
  Projects.Domain/           Entities and enums; no infrastructure dependencies
  Projects.Application/      Contracts, ports, validation and upload rules
  Projects.Infrastructure/   EF Core, migrations, persistence, admin sessions, media adapter
  Projects.Web/              HTTP endpoints, cookies, CSRF, rate limits and React hosting
frontend/src/
  components/                Shared UI and gallery cards
  pages/                     Public gallery/detail and admin/editor
  lib/                       API client; CSRF token lives in memory
  styles/                    Small global styles and design tokens
scripts/                     Local tooling, tests, deployment and secret generation
tests/Projects.Tests/        Focused .NET rule tests
```

Keep HTTP handling in Web, application contracts/rules in Application, storage/database details in Infrastructure, and plain entities in Domain. The small app uses explicit EF-backed services, without generic repositories or CQRS infrastructure.

## Local setup

Requirements: Docker Compose, Node **22.12+**, .NET SDK **10**, Python 3. The pinned SDK/tool/package lock files are included.

```bash
cd ~/code/projects
python3 scripts/init-env.py
npm ci
npm ci --prefix frontend
dotnet restore Projects.slnx --locked-mode
docker compose up -d --wait postgres
npm run db:migrate
npm run dev
```

`npm run dev` also detects the SDK in `DOTNET_ROOT`, `~/.dotnet`, and the standard macOS/Linux installation directories when `dotnet` is missing from PATH. If you previously started the Docker app, stop that app first with `docker compose --profile app stop app` to free port 5191; keep PostgreSQL running.

The initial migration builds the image once and creates the admin from `.env`. The generated `.env` is mode 0600 and is never overwritten by the generator.

- React with hot reload: **http://localhost:4191**
- API: **http://localhost:5191/api**
- Admin: **http://localhost:4191/admin**
- PostgreSQL: localhost:5545

Read `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your local `.env` to sign in. They are generated locally; no credential is embedded in the frontend or repository. Change the password through Admin → Settings. Bootstrap only creates the first account; editing `ADMIN_PASSWORD` later does **not** reset an existing account.

Optional demo content (clearly example projects, with no invented working URLs):

```bash
npm run db:seed
```

The seed is opt-in and leaves a nonempty catalog unchanged. Native development uses media/keys in ignored `.data/`; Docker uses persistent named volumes. To retain **the same preview files** between these two modes, explicitly copy/mount the media and keys; switching modes shares PostgreSQL but does not automatically copy filesystem data.

To run the complete monolith in Docker:

```bash
docker compose --profile app up -d --build app
# Gallery and admin: http://localhost:5191
```

`make refresh` rebuilds that image, including React/CSS. Native `npm run dev` reloads frontend edits without rebuilding Docker. Vite handles React assets and browser refresh; `dotnet watch` handles backend hot reload. The backend serves the React bundle only when a built `wwwroot/index.html` exists, as it does in Docker.

## Model and media

- `Projects`: slug, title, summary, description, optional HTTPS URLs, embedding, featured/order, status, version, timestamps.
- `Tags` + `ProjectTags`: reusable stack/cloud/type tags. Stack and cloud names are free-form; project types include backend, web/mobile frontends, full-stack web/mobile, desktop, CLI/tooling and games.
- `Media`: project FK, random storage key, original filename, actual byte size, type, caption, order, cover flag.
- `Admins` and `Sessions`: hashed admin password and server-revocable, absolute-expiry sessions.

Within one filter category selected tags are ORed; categories combine with AND. Tags are case-insensitive and facets contain only published projects.

Updates use a version to reject stale edits instead of overwriting another edit. Multi-record project/tag and media mutations use PostgreSQL transactions. Deletion of a project cascades its metadata and removes its files; unused taxonomy entries remain available for reuse.

Preview files are saved **unchanged**, without resizing or recompression, in the `media_data` volume. Draft/archived media is available only to authenticated admins; published previews are intentionally public. The filesystem is never exposed as a static uploads directory. `/api/media/:id` checks visibility and supports byte ranges for video playback. An adapter interface allows moving storage to Garage/S3 later.

Uploads support JPEG, PNG, WebP (20 MiB each) and MP4/WebM (100 MiB each), maximum 20 previews and 1 GiB per project. Content headers and declared types are checked; filenames never select storage paths. This is not antivirus scanning. Authentication restricts uploads to the administrator. The minimal stack starts no Garage or ClamAV container on the small shared droplet.

## Testing

```bash
npm run build
npm test
# Requires the Docker app running with the root .env credentials:
npm run test:integration
npx playwright install chromium
npm run test:browser
```

Integration tests create and delete their own projects. They verify auth/CSRF, CRUD, private draft previews, unchanged original bytes, video-style ranges, filters, stale edits, publishing/archiving and deletion. Browser tests exercise the real mobile admin and public pages, then verify desktop layout. Screenshots are written to ignored `output/`.

EF migrations:

```bash
dotnet tool restore
dotnet ef migrations add DescriptiveName --project src/Projects.Infrastructure --startup-project src/Projects.Web
npm run db:migrate
```

Migrations are checked in. Deployment never creates migrations dynamically. Use changes compatible with the previous release so image rollback remains possible.

## Production

See [docs/deployment.md](docs/deployment.md) for the first push, server setup and DNS. Production secrets live only at **`/opt/projects/.env`**. The workflow does not upload, download, recreate, or modify that file.

Pushes to `main` deploy to the production folder, hostname, database, and volumes. PR events do not deploy; merging into `main` triggers its push workflow. Other branches do not deploy.

Production runs only PostgreSQL and the monolith. The existing Caddy owns ports 80/443. PostgreSQL stays private; only the app joins `proxy`. Memory limits default to 128 MiB for PostgreSQL and 256 MiB for the app; these are caps, not guarantees that every service on a 1 GiB shared host will fit. Check real shared-host headroom before enabling another app.

Cookie sessions use HTTPS-only, HttpOnly, host-only cookies in production. Trusted-device sessions last at most 15 days; untrusted logins use browser-session cookies with a 24-hour server maximum. Browser session restoration can preserve those cookies; logout revokes the server session immediately. Reverse-proxy forwarding trusts only the existing Caddy IP discovered at deployment. Database/media/key backups and disk retention remain server operations; automated deployments make a private database dump before migrating.

## API outline

Public: `GET /api/projects`, `GET /api/projects/:slug`, `GET /api/facets`, `GET /api/project-types`, `GET /api/media/:id`.

Admin: `GET/POST /api/admin/projects`, `GET/PUT/DELETE /api/admin/projects/:id`, `POST /api/admin/projects/:id/media`, `PUT/DELETE /api/admin/projects/:id/media/:mediaId`.

Auth: `GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/password`. Unsafe requests require the `X-CSRF-TOKEN` header, including login. No public signup exists.

Health: `/api/health/live` and `/api/health/ready` (ready requires a migrated, reachable database).

## References

- [ASP.NET Core cookies](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/cookie?view=aspnetcore-10.0), [antiforgery](https://learn.microsoft.com/en-us/aspnet/core/security/anti-request-forgery?view=aspnetcore-10.0), [trusted proxies](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-10.0).
- [caddy-docker-proxy labels](https://github.com/lucaslorentz/caddy-docker-proxy), [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview).
