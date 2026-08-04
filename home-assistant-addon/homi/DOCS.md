# Home Assistant App: Homi

Homi keeps equipment, maintenance, repairs, warranties and private documents in
one self-hosted home journal.

## Installation

1. In Home Assistant, open **Settings → Apps → App store**.
2. Open the repository menu and add `https://github.com/Yuss9/homi`.
3. Select **Homi**, install it, then review the configuration.
4. Set `app_url` to the URL devices will use to reach Homi.
5. Start the App and use **Open Web UI**.

The first startup initializes an embedded PostgreSQL database, generated secrets,
private local uploads and ClamAV signatures. It can take longer than later starts.

## Persistent data and backups

All mutable state lives below `/data`:

- `/data/postgres` — PostgreSQL database;
- `/data/uploads` — private files;
- `/data/clamav` — antivirus signatures;
- `/data/secrets` — generated application and database secrets.

Stop Homi before creating a backup so PostgreSQL and uploaded files are captured
at the same point. Restoring the App backup restores all four directories.

## Configuration

### `app_url`

Canonical URL used for authentication, links, calendar feeds and notifications.
Use HTTPS when Homi is reachable outside the local Home Assistant host.

### `timezone`

IANA timezone used inside the container, for example `Europe/Zurich`.

### SMTP options

Configure `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password` and `smtp_from`
when email verification and reminders should leave the Home Assistant host. Empty
credentials are allowed for SMTP relays that do not require authentication.

### `log_level`

Controls Homi application logging. Keep `info` in normal operation and use
`debug` only temporarily.

## Home Assistant integration

The App hosts Homi, while the HACS integration exposes Homi data as Home Assistant
entities and services. Install `custom_components/homi` through HACS, create a
scoped API key in Homi Settings and complete the integration's config flow.
