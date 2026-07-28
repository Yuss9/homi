# Backup and restore

## PostgreSQL

Create an encrypted custom-format dump:

```bash
pg_dump --format=custom --no-owner --file=homi-$(date +%F).dump "$DATABASE_URL"
```

Verify it:

```bash
pg_restore --list homi-YYYY-MM-DD.dump >/dev/null
```

Restore into an empty database:

```bash
createdb homi_restore
pg_restore --no-owner --dbname=homi_restore homi-YYYY-MM-DD.dump
```

Stop writes or use a consistent operational snapshot when coordinating database and object backups. Run Homi’s readiness checks and sample authorized downloads after restore.

## MinIO / S3

Use object versioning, server-side encryption, lifecycle retention, and provider replication where available. With MinIO Client:

```bash
mc mirror --watch homi/homi-private backup/homi-private
```

Never make the backup bucket public. Encrypt off-site copies with a separately managed key. Record the object-version or snapshot point alongside the PostgreSQL backup so file metadata and bytes can be restored consistently.

## Policy

Recommended baseline: daily database and object backups, 30 daily copies, 12 monthly copies, one off-site copy, and a quarterly restore drill. Match actual retention to the privacy policy and legal obligations.

