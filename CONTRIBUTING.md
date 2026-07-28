# Contributing

Thank you for helping make home care calmer and safer.

1. Create a focused branch and keep changes within one domain where practical.
2. Never commit `.env`, credentials, private home data, real addresses, uploaded documents, or production logs.
3. Add a migration for schema changes and explain data/backfill implications.
4. Validate all external input, enforce authorization in server code, and include a test for cross-home or role boundaries.
5. Run `bun run typecheck`, `bun run lint`, `bun run test`, and `bun run build`.
6. Use semantic, accessible HTML and verify touch, keyboard, mobile, dark mode, and reduced motion for UI work.
7. Open a pull request with intent, risk, migration/rollback notes, and screenshots only when they contain fake data.

Use Conventional Commit-style subjects when helpful, such as `feat(maintenance): support yearly schedules`.
