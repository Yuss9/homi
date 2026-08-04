#!/usr/bin/with-contenv bashio
set -euo pipefail

export TZ="$(bashio::config 'timezone')"
export NODE_ENV=production
export PORT=3000
export HOSTNAME=0.0.0.0
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_APP_URL="$(bashio::config 'app_url')"
export STORAGE_PROVIDER=local
export LOCAL_STORAGE_PATH=/data/uploads
export DATABASE_SSL=false
export CLAMAV_ENABLED=true
export CLAMAV_HOST=127.0.0.1
export CLAMAV_PORT=3310
export CLAMAV_TIMEOUT_MS=15000
export LOG_LEVEL="$(bashio::config 'log_level')"
export SMTP_HOST="$(bashio::config 'smtp_host')"
export SMTP_PORT="$(bashio::config 'smtp_port')"
export SMTP_USER="$(bashio::config 'smtp_user')"
export SMTP_PASSWORD="$(bashio::config 'smtp_password')"
export SMTP_FROM="$(bashio::config 'smtp_from')"

mkdir -p /data/postgres /data/uploads /data/clamav /data/secrets /run/postgresql
chown -R postgres:postgres /data/postgres /run/postgresql
chown -R homi:homi /data/uploads /app
chown -R clamav:clamav /data/clamav
chmod 700 /data/secrets

secret() {
  local name="$1"
  local path="/data/secrets/$name"
  if [[ ! -f "$path" ]]; then
    head -c 48 /dev/urandom | base64 | tr -d '\n' > "$path"
    chmod 600 "$path"
  fi
  cat "$path"
}

export BETTER_AUTH_SECRET="$(secret better_auth)"
export CRON_SECRET="$(secret cron)"
POSTGRES_PASSWORD="$(secret postgres)"
export DATABASE_URL="postgresql://homi:${POSTGRES_PASSWORD}@127.0.0.1:5432/homi"

if [[ ! -s /data/postgres/PG_VERSION ]]; then
  bashio::log.info "Initializing embedded PostgreSQL"
  su-exec postgres initdb -D /data/postgres --auth-local=trust --auth-host=scram-sha-256
  printf "listen_addresses = '127.0.0.1'\nport = 5432\n" >> /data/postgres/postgresql.conf
  su-exec postgres pg_ctl -D /data/postgres -w start
  su-exec postgres psql --dbname postgres --set ON_ERROR_STOP=1 <<SQL
CREATE ROLE homi LOGIN PASSWORD '${POSTGRES_PASSWORD}';
CREATE DATABASE homi OWNER homi;
SQL
  su-exec postgres pg_ctl -D /data/postgres -m fast -w stop
fi

bashio::log.info "Starting PostgreSQL"
su-exec postgres postgres -D /data/postgres &
POSTGRES_PID=$!
for _ in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -U homi -d homi >/dev/null 2>&1; then break; fi
  sleep 1
done
pg_isready -h 127.0.0.1 -U homi -d homi >/dev/null

bashio::log.info "Updating ClamAV signatures"
sed -i 's|^DatabaseDirectory .*|DatabaseDirectory /data/clamav|' /etc/clamav/freshclam.conf
freshclam --config-file=/etc/clamav/freshclam.conf || bashio::log.warning "ClamAV signature update failed; existing signatures will be used"
cat >/etc/clamav/clamd.conf <<'CONF'
Foreground true
TCPSocket 3310
TCPAddr 127.0.0.1
DatabaseDirectory /data/clamav
LocalSocket /run/clamav/clamd.sock
User clamav
MaxFileSize 25M
StreamMaxLength 25M
CONF
mkdir -p /run/clamav
chown clamav:clamav /run/clamav
su-exec clamav clamd --config-file=/etc/clamav/clamd.conf &
CLAMAV_PID=$!
for _ in $(seq 1 60); do
  if clamdscan --ping 1 >/dev/null 2>&1; then break; fi
  sleep 2
done
clamdscan --ping 1 >/dev/null

bashio::log.info "Applying Homi migrations"
su-exec homi node /app/scripts/migrate.mjs
bashio::log.info "Starting Homi on port 3000"
su-exec homi node /app/server.js &
HOMI_PID=$!

cleanup() {
  bashio::log.info "Stopping Homi services"
  kill -TERM "$HOMI_PID" "$CLAMAV_PID" "$POSTGRES_PID" 2>/dev/null || true
  wait || true
}
trap cleanup TERM INT EXIT
wait "$HOMI_PID"
