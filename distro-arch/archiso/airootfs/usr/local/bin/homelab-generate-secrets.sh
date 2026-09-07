#!/usr/bin/env bash
# Run by Calamares (chrooted into the target), after users. Auto-generates
# authentik.env and dashboard.env under /var/mnt/tank/appdata/secrets so
# Authentik + Postgres + Redis + the dashboard's own SSO login all work with
# no manual setup — every value here is a random secret with no external
# dependency (unlike the *arr apps' API keys, which each app only generates
# for itself on first start; pre-seeding those would mean guessing at their
# config.xml schema and risk breaking Sonarr/Radarr/Prowlarr's own startup,
# so those three still need a one-time copy from each app's UI into
# dashboard.env after first boot — see distro/secrets.example/dashboard.env.example).
#
# NEXTAUTH_URL / AUTHENTIK_PUBLIC_URL default to this box's own configured
# hostname (from /etc/hostname, which the `users` step already wrote to the
# target) — works out of the box on a LAN with mDNS/local DNS resolution;
# replace with a static IP or reverse-proxy domain later if needed.
set -euo pipefail

SECRETS_DIR=/var/mnt/tank/appdata/secrets
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

gen() { openssl rand -base64 36 | tr -d '\n'; }

POSTGRES_PASSWORD="$(gen)"
AUTHENTIK_SECRET_KEY="$(gen)"
CLIENT_SECRET="$(gen)"
NEXTAUTH_SECRET="$(gen)"
BOX_HOSTNAME="$(cat /etc/hostname)"

cat > "$SECRETS_DIR/authentik.env" <<EOF
POSTGRES_USER=authentik
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=authentik
AUTHENTIK_POSTGRESQL__HOST=postgres
AUTHENTIK_POSTGRESQL__USER=authentik
AUTHENTIK_POSTGRESQL__NAME=authentik
AUTHENTIK_POSTGRESQL__PASSWORD=${POSTGRES_PASSWORD}
AUTHENTIK_REDIS__HOST=redis
AUTHENTIK_SECRET_KEY=${AUTHENTIK_SECRET_KEY}
AUTHENTIK_ERROR_REPORTING__ENABLED=false
AUTHENTIK_HOMEPAGE_CLIENT_SECRET=${CLIENT_SECRET}
EOF
chmod 600 "$SECRETS_DIR/authentik.env"

cat > "$SECRETS_DIR/dashboard.env" <<EOF
NEXTAUTH_URL=http://${BOX_HOSTNAME}:3000
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
AUTHENTIK_ISSUER=http://authentik-server:9000/application/o/homepage-dashboard/
AUTHENTIK_PUBLIC_URL=http://${BOX_HOSTNAME}:9000
AUTHENTIK_CLIENT_ID=homepage-dashboard
AUTHENTIK_CLIENT_SECRET=${CLIENT_SECRET}
SONARR_URL=http://sonarr:8989
SONARR_API_KEY=
RADARR_URL=http://radarr:7878
RADARR_API_KEY=
PROWLARR_URL=http://prowlarr:9696
PROWLARR_API_KEY=
DISK_MOUNT_PATH=/var/mnt/tank
EOF
chmod 600 "$SECRETS_DIR/dashboard.env"
