# Homi

<p align="center">
  <strong>A private, self-hosted journal for everything your home needs.</strong>
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white">
  <img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-596F80">
</p>

![Homi — your home, remembered](public/og.png)

Homi keeps rooms, appliances, warranties, invoices, manuals, repairs, recurring
maintenance, reminders, and household access in one calm place. It is designed
for people who want to own their home data and self-host the complete product.

## Why Homi?

Home information usually ends up split between drawers, inboxes, notes, and
different family members. Homi gives it a durable structure:

- multiple homes and rooms;
- appliances, systems, furniture, warranties, and serial numbers;
- recurring maintenance with completion history and reminders;
- repairs, providers, notes, and costs;
- private PDF and image storage;
- household roles: owner, admin, member, and viewer;
- email verification, password reset, and session management;
- account and home data export;
- responsive UI with accessible motion and reduced-motion support.

Homi includes no advertising, third-party analytics, payments, subscriptions,
or AI features.

## Quick start with Docker

For a contributor-oriented walkthrough, including local services, branching,
validation, and pull requests, read the
[getting started guide](docs/getting-started.md).

### Requirements

- Docker Desktop or Docker Engine with Compose
- Git
- Bun 1.2+ only if you want to run the seed or development commands locally

### 1. Configure the application

```bash
cp .env.example .env
```

For local use, replace the placeholder secrets in `.env`. Keep these values
synchronized:

- `POSTGRES_PASSWORD`
- the password inside `DATABASE_URL`
- the password inside `SEED_DATABASE_URL`

Once PostgreSQL has created its persistent volume, do not change its password in
`.env` without also changing the database role.

Generate strong local secrets with:

```bash
openssl rand -hex 32
```

### 2. Start the complete stack

```bash
docker compose up -d --build
docker compose ps
```

The web container applies committed database migrations before starting.

| Service       | Local address           | Purpose                       |
| ------------- | ----------------------- | ----------------------------- |
| Homi          | <http://localhost:3000> | Web application               |
| Mailpit       | <http://localhost:8025> | Captured development email    |
| MinIO console | <http://localhost:9001> | Object-storage administration |
| PostgreSQL    | `127.0.0.1:5432`        | Relational data               |

`minio-init` is a one-shot setup container. `Exited (0)` is expected: it creates
the private bucket, disables anonymous access, and then stops.

### 3. Optional demo data

```bash
bun install --frozen-lockfile
bun run db:seed
```

Development-only account:

```text
Email:    alex@homi.local
Password: HomiDemo!2026
```

The seed runs only when explicitly requested.

### 4. Stop the stack

```bash
docker compose down
```

This preserves persistent volumes. `docker compose down -v` also deletes the
database and stored files.

## Development with hot reload

Start the lightweight development dependencies:

```bash
docker compose down
docker compose -f docker-compose.dev.yml up -d
```

Use these local overrides in `.env`:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://homi:homi-local-only@127.0.0.1:5432/homi
DATABASE_SSL=false
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./data/uploads
REDIS_URL=
```

Then run:

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run db:seed
bun run dev
```

Open <http://localhost:3000>. New-account verification emails appear in Mailpit
at <http://localhost:8025>.

## Architecture

```mermaid
flowchart LR
  Browser["Browser / mobile"] --> Next["Next.js App Router"]
  Next --> Auth["Better Auth"]
  Next --> Services["Domain services"]
  Auth --> PG[("PostgreSQL")]
  Services --> Authorization["Membership + role checks"]
  Authorization --> PG
  Services --> Storage["Private storage adapter"]
  Storage --> Local["Local files"]
  Storage --> S3["S3 / MinIO"]
  Services --> SMTP["SMTP / Mailpit"]
  Worker["Reminder worker"] --> Job["Protected idempotent job"]
  Job --> PG
  Job --> SMTP
  Next --> Redis["Redis rate limiting"]
```

Server Components are the default. Route Handlers validate untrusted input with
Zod and delegate to server-side services. Those services derive identity from
the authenticated session and verify database membership; user IDs and roles
sent by the browser are never trusted.

Relational data lives in PostgreSQL. Binary content lives in private local or
S3-compatible storage, while PostgreSQL stores its metadata and authorization
relationships. Retried side effects use idempotency keys and database
constraints.

Architectural decisions are documented in
[`docs/architecture`](docs/architecture).

## Technology

- Next.js 16 App Router and React 19
- strict TypeScript and Tailwind CSS 4
- Motion, Radix primitives, and Lucide icons
- Better Auth with PostgreSQL sessions
- Drizzle ORM and PostgreSQL 17
- local or S3-compatible private storage
- SMTP, Mailpit, MinIO, and Redis
- Vitest and Playwright
- Docker Compose and a non-root Node.js production image

## Repository layout

| Path              | Responsibility                                             |
| ----------------- | ---------------------------------------------------------- |
| `app/`            | Routes, pages, layouts, and HTTP handlers                  |
| `src/components/` | Interactive product UI                                     |
| `src/features/`   | Pure domain logic                                          |
| `src/server/`     | Authentication, authorization, services, jobs, and storage |
| `db/`             | Drizzle connection and schema                              |
| `drizzle/`        | Versioned SQL migrations                                   |
| `scripts/`        | Migrations, seed, and reminder processing                  |
| `tests/`          | Unit, integration, security, and browser tests             |
| `docs/`           | Architecture and operational documentation                 |
| `deploy/`         | Example production reverse-proxy configuration             |

## Environment variables

Start from [`.env.example`](.env.example). Never commit `.env`.

| Variable                                   | Purpose                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                      | Canonical application URL and trusted auth origin    |
| `DATABASE_URL`, `DATABASE_SSL`             | PostgreSQL connection                                |
| `SEED_DATABASE_URL`                        | Optional host-side connection used by the seed       |
| `BETTER_AUTH_SECRET`                       | Authentication signing secret, minimum 32 characters |
| `SMTP_*`                                   | Transactional email transport                        |
| `STORAGE_PROVIDER`                         | `local` or `s3`                                      |
| `LOCAL_STORAGE_PATH`                       | Private local upload root                            |
| `S3_*`                                     | S3 or MinIO connection and private bucket            |
| `REDIS_URL`                                | Optional shared rate limiter                         |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth pair                           |
| `MAX_UPLOAD_BYTES`                         | Upload limit; defaults to 10 MiB                     |
| `CRON_SECRET`                              | Credential for the protected reminder endpoint       |

Incomplete S3 and Google OAuth configurations are rejected during startup.
Production requires explicit database, authentication, and cron secrets.

## Database commands

```bash
bun run db:generate   # generate a migration after a schema change
bun run db:migrate    # apply committed migrations
bun run db:push       # development only
bun run db:seed       # optional demo data
bun run db:studio
```

Review migrations before applying them to production and back up both
PostgreSQL and the file store together.

## Email and reminders

Docker Compose sends development mail to Mailpit. Production deployments must
provide a real SMTP service.

Process reminders manually with:

```bash
bun run notifications:process
```

The Compose `reminders` service invokes the protected job hourly. The processor
respects notification preferences, records delivery attempts, and safely skips
duplicate retries.

## Testing and quality

```bash
bun run typecheck
bun run lint
bun run test
bun run test:integration
bun run build
bun run test:e2e
```

GitHub Actions runs type checking, linting, unit and integration tests, a
production build, a Docker build, and the desktop Playwright journey.

## Security

Homi treats home records and uploaded documents as sensitive data:

- secure HTTP-only session cookies;
- verified-email gating for private routes;
- server-side role checks for every protected resource;
- private file downloads with authorization and `no-store` responses;
- byte-based upload type detection, size limits, and random storage keys;
- hashed, expiring invitation tokens;
- authentication and upload rate limits;
- security headers and structured log redaction;
- non-root production container.

The included virus-scanner interface uses a no-op development adapter. Connect a
fail-closed antivirus implementation before accepting uploads from untrusted
public users.

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Never
open a public issue containing credentials, tokens, private files, addresses, or
session cookies.

## Production deployment

The complete supported deployment target is Docker Compose or equivalent
self-hosting with externally managed stateful services.

Before production:

- terminate HTTPS with Caddy or another reverse proxy;
- use strong, unique secrets and a real SMTP provider;
- use managed or encrypted PostgreSQL storage;
- keep the S3 bucket private and configure encryption;
- make Redis durable when running multiple replicas;
- configure coordinated database/object backups and restore drills;
- review the privacy and terms templates for your jurisdiction.

An example reverse proxy is available at
[`deploy/Caddyfile`](deploy/Caddyfile). Backup guidance is in
[`docs/backups.md`](docs/backups.md).

Versioned multi-platform container images are published to the repository's
GitHub Packages section after each GitHub Release. Pull a specific version and
use it with the included Compose file:

```bash
docker pull ghcr.io/OWNER/homi:1.2.3
HOMI_IMAGE=ghcr.io/OWNER/homi:1.2.3 docker compose up -d
```

Replace `OWNER` with the repository owner. See
[`docs/releases.md`](docs/releases.md) for the complete automated release flow
and required one-time GitHub settings.

## Known limitations

- The default upload scanner is not a production antivirus implementation.
- Automated reminder delivery currently covers maintenance tasks; warranty and
  document-expiry job handlers are not complete.
- Owner transfer, account deletion, and every archive/edit lifecycle are not
  yet exposed end to end.
- Invitation acceptance and destructive lifecycle flows are not fully covered
  by browser automation.
- Stock local MinIO is not encrypted at rest without additional KMS setup.
- Legal pages are templates and require review by the deployment operator.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request. Please keep test data fictional and avoid screenshots
containing real home information.

Changes are developed on focused branches and squash-merged into `main`.
Conventional Commit pull request titles drive Release Please, the changelog,
semantic version tags, GitHub Releases, and versioned GHCR images.

## License

Homi is licensed under the
[GNU Affero General Public License v3.0](LICENSE).

If you run a modified version as a network service, the AGPL requires you to
offer the corresponding source code to its users.
