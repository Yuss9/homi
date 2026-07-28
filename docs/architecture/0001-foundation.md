# ADR 0001: Node-hosted Next.js with PostgreSQL and private object storage

Status: accepted · 2026-07-24

## Context

Homi stores relational, authorization-sensitive home records and private binary documents. Authentication, retries, scheduled work, self-hosting, and transactional integrity are core requirements.

## Decision

- Use Next.js App Router with Server Components by default and Node-compatible production output.
- Use Better Auth with database sessions and the Drizzle PostgreSQL adapter.
- Keep normalized application data in PostgreSQL and binary content in a storage adapter backed by private local files or S3.
- Put validation, authorization, and business rules in server services rather than React components.
- Use a delivery ledger with a unique idempotency key before external notification effects.
- Use UUID primary keys and database constraints as the last line of integrity.
- Keep the future plan/quota boundary outside domain entities until billing exists.

## Consequences

The app can be self-hosted and horizontally scaled with shared PostgreSQL, S3, and Redis. Local development remains complete through Compose. Deployments require stateful external services and cannot be treated as a purely static site.

