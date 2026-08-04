# Connected mobile platform

Homi remains a server-connected product. Installing the PWA improves access,
notifications, camera workflows and system shortcuts, but Homi deliberately does
not cache private household records for offline use.

## Install the PWA

Open `/install` from the Homi instance.

- Android: use **Install Homi** or the browser's **Install app** action.
- iPhone/iPad: open Homi in Safari, tap **Share**, then **Add to Home Screen**.

The installed icon exposes shortcuts for scanning equipment, creating a
maintenance task, declaring a repair and opening the calendar.

## Personal API keys

Create a key from **Settings → Personal API keys**. The clear token is displayed
once. Homi stores only its SHA-256 hash.

Scopes:

| Scope | Purpose |
| --- | --- |
| `home:read` | Read Home Health and household summary metrics |
| `assets:read` | Read authorized equipment records |
| `maintenance:write` | Create and complete maintenance tasks |
| `repairs:write` | Declare repairs |
| `calendar:read` | Reserved for calendar clients |
| `widgets:read` | Read mobile widget payloads |
| `webhooks:manage` | Reserved for external webhook administration |

Use a bearer header:

```http
Authorization: Bearer homi_api_...
```

Connected endpoints:

```text
GET  /api/v1/home/summary?homeId=<uuid>
GET  /api/v1/widgets/summary?homeId=<uuid>&kind=HOME_HEALTH
GET  /api/v1/assets/<assetId>
POST /api/v1/maintenance
POST /api/v1/maintenance/<taskId>/complete
POST /api/v1/repairs
```

Keys inherit the account's current household memberships and roles. Revoking a
membership immediately removes access even when the key itself remains active.

## Private calendar subscriptions

Create a private feed from Settings and subscribe to the returned URL from Apple
Calendar, Google Calendar or Outlook. The feed includes:

- upcoming maintenance;
- repairs;
- warranty end dates;
- document expiry dates.

Rotating the URL invalidates the previous token. Revoking the feed stops all
future calendar requests.

## Signed webhooks

Owners and administrators can register HTTPS endpoints from Settings. Homi
rejects localhost and common private-network destinations to reduce SSRF risk.

Every request includes:

```text
X-Homi-Event
X-Homi-Delivery
X-Homi-Timestamp
X-Homi-Signature: sha256=<hex digest>
```

Verify the signature over:

```text
<timestamp>.<raw request body>
```

with HMAC-SHA256 and the one-time webhook secret. Failed deliveries use
exponential backoff and repeatedly failing endpoints are disabled.

## Home Assistant through HACS

The custom integration lives in `custom_components/homi`.

1. Add this repository as a custom integration repository in HACS.
2. Install **Homi** and restart Home Assistant.
3. In Homi, create an API key with `home:read`, `assets:read`,
   `maintenance:write` and `repairs:write`.
4. In Home Assistant, open **Settings → Devices & services → Add integration → Homi**.
5. Enter the Homi URL, API key and Homi home ID.

Sensors:

- Home Health;
- overdue maintenance;
- open repairs;
- warranties expiring soon;
- documents expiring soon;
- monthly costs.

Services:

- `homi.create_maintenance`;
- `homi.complete_maintenance`;
- `homi.declare_repair`;
- `homi.open_asset`.

## Home Assistant Add-on

`home-assistant-addon/homi` packages Homi, PostgreSQL, local private storage and
ClamAV in one Add-on. Persistent data is stored under `/data`, so a cold Add-on
backup contains the database, uploads, ClamAV signatures and generated secrets.

The Add-on is intended for simple single-instance installations. Existing Homi
operators with managed PostgreSQL or S3 should continue using the standard
Docker Compose deployment.

## MQTT bridge

Start the optional bridge with:

```bash
docker compose --profile mqtt up -d mqtt-bridge
```

Create a `maintenance:write` key and configure `HOMI_API_KEY`, `HOMI_HOME_ID`,
`MQTT_*` and `HOMI_MQTT_RULES` in `.env`.

Example:

```dotenv
HOMI_MQTT_RULES=[{"topic":"home/boiler/runtime_hours","mode":"usage","threshold":500,"title":"Service boiler","assetId":"00000000-0000-0000-0000-000000000000","cooldownSeconds":2592000,"priority":"HIGH"}]
```

Rule modes:

- `alert`: create a task for truthy/non-clear payloads;
- `state`: compare the payload to `equals`;
- `counter` or `usage`: compare a numeric payload to `threshold`.

The bridge persists cooldown timestamps in its Docker volume to avoid duplicate
tasks after restarts.

## Native widgets

The optional `native` companion keeps Homi's web application as the main product
and adds WidgetKit and Android App Widgets. Widget clients should receive a key
with only `widgets:read` whenever possible.

Supported widget content:

- next maintenance;
- Home Health;
- open repairs;
- monthly costs;
- a configurable quick action.
