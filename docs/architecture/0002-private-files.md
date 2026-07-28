# ADR 0002: Authorized file proxy

Status: accepted · 2026-07-24

Uploaded objects are private. Homi stores byte-derived MIME type, size, checksum, safe display name, provider, and random key in PostgreSQL. Download requests join the file to a home document, validate the active session and membership, then stream bytes with `Cache-Control: private, no-store` and a safe `Content-Disposition`.

Direct public bucket URLs are forbidden. A future high-volume S3 implementation may issue very short-lived signed URLs only after the same authorization check.

