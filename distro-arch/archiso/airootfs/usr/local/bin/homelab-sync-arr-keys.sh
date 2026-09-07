#!/usr/bin/env bash
# Run at every boot by homelab-sync-arr-keys.service, after the *arr
# Quadlets. Each of Sonarr/Radarr/Prowlarr generates its OWN random API key
# into its config.xml the first time it starts — there's no way to know that
# value ahead of time without pre-seeding config.xml ourselves, which risks
# writing something those apps' config loader chokes on and breaking their
# startup. So instead: wait for each app to write its real config.xml, read
# the key back out, and drop it into dashboard.env — never touches the arr
# apps' own config at all. Restarts homepage-dashboard.service if anything
# actually changed, so the dashboard's arr widgets work with no manual
# copy-paste.
set -uo pipefail

SECRETS=/var/mnt/tank/appdata/secrets/dashboard.env
[ -f "$SECRETS" ] || exit 0

wait_for_key() {
    local config="$1" tries=30
    while [ ! -s "$config" ] && [ "$tries" -gt 0 ]; do
        sleep 2
        tries=$((tries - 1))
    done
    [ -s "$config" ] || return 1
    grep -oP '(?<=<ApiKey>)[^<]+' "$config"
}

changed=0
for app in sonarr radarr prowlarr; do
    varname="$(echo "$app" | tr '[:lower:]' '[:upper:]')_API_KEY"
    key="$(wait_for_key "/var/mnt/tank/appdata/${app}/config.xml")" || continue
    [ -n "$key" ] || continue
    current="$(grep "^${varname}=" "$SECRETS" | cut -d= -f2-)"
    if [ "$current" != "$key" ]; then
        sed -i "s|^${varname}=.*|${varname}=${key}|" "$SECRETS"
        changed=1
    fi
done

if [ "$changed" -eq 1 ]; then
    systemctl restart homepage-dashboard.service || true
fi
