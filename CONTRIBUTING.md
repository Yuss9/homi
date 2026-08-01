# Contributing

Thank you for helping make home care calmer and safer.

1. Create a focused branch from `main` and keep changes within one domain where practical. Never commit directly to `main`.
2. Never commit `.env`, credentials, private home data, real addresses, uploaded documents, or production logs.
3. Add a migration for schema changes and explain data/backfill implications.
4. Validate all external input, enforce authorization in server code, and include a test for cross-home or role boundaries.
5. Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build`.
6. Use semantic, accessible HTML and verify touch, keyboard, mobile, dark mode, and reduced motion for UI work.
7. Open a pull request with intent, risk, migration/rollback notes, and screenshots only when they contain fake data. Squash-merge after review and passing checks.

Pull request titles and commits must follow Conventional Commits, such as `feat(maintenance): support yearly schedules`. The allowed types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`. A `feat` produces a minor release, a `fix` produces a patch release, and a breaking change produces a major release.

See the [getting started guide](docs/getting-started.md) for a complete local workflow and [release guide](docs/releases.md) for versioning and container publishing.
