# Getting started

This guide sets up a local Homi development environment. For a production
installation, use the Docker instructions in the main README and review the
security checklist before exposing the application to the internet.

## Prerequisites

- Git
- Node.js 22.13 or newer
- Bun 1.2 or newer
- Docker Engine with Docker Compose

## Set up the repository

```bash
git clone https://github.com/OWNER/homi.git
cd homi
cp .env.example .env
```

Replace `OWNER` with the GitHub account or organization that hosts your fork.
Generate new values for `BETTER_AUTH_SECRET` and `CRON_SECRET` instead of using
the example placeholders:

```bash
openssl rand -hex 32
```

Keep `POSTGRES_PASSWORD`, the password in `DATABASE_URL`, and the password in
`SEED_DATABASE_URL` synchronized.

## Start development services

```bash
docker compose -f docker-compose.dev.yml up -d
bun install --frozen-lockfile
bun run db:migrate
bun run db:seed
bun run dev
```

Open <http://localhost:3000>. Mail sent by the development environment can be
inspected at <http://localhost:8025>.

## Create a change

Never work directly on `main`. Start from an up-to-date branch:

```bash
git switch main
git pull --ff-only
git switch -c feat/short-description
```

Keep the branch focused and write commits in Conventional Commit format:

```text
feat(reminders): add weekly email digest
fix(auth): preserve the requested redirect
docs: clarify Docker setup
```

The pull request title must use the same format because squash-merge titles
become the commits on `main` and drive automated release notes.

## Validate the change

```bash
bun run typecheck
bun run lint
bun run test
bun run test:integration
bun run build
bun run test:e2e
```

UI changes should also be checked with a keyboard, at mobile and desktop sizes,
in dark mode, and with reduced motion enabled.

## Open a pull request

Push the branch, open a pull request against `main`, complete the template, and
wait for required checks. Use **Squash and merge** after approval. Do not include
real addresses, documents, credentials, session cookies, or production logs in
issues, fixtures, screenshots, or pull requests.
