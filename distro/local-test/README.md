# local-test

Docker Compose pre-flight harness for the homelab-os stack — mirrors the real
Podman Quadlet topology (same container names, same env var shapes) so the
architecture can be validated on a dev machine with Docker Desktop before
ever building the actual OS image or touching the R720. See
`apps/homepage-dashboard/README.md`'s "Verified by actually running this"
section for what this already caught.

## Usage

```bash
cp authentik.env.example authentik.env    # if starting fresh; fill in real secrets
cp dashboard.env.example dashboard.env
docker compose up -d
```

First boot takes a minute — Postgres/Authentik migrations, then the
`homepage-oidc.yaml` blueprint auto-applies (retried automatically on a
schedule until it succeeds, no manual step needed once the blueprint YAML
itself is correct).

Get real *arr API keys once each app has started once:

```bash
docker compose exec sonarr grep -o '<ApiKey>[^<]*</ApiKey>' /config/config.xml
docker compose exec radarr grep -o '<ApiKey>[^<]*</ApiKey>' /config/config.xml
docker compose exec prowlarr grep -o '<ApiKey>[^<]*</ApiKey>' /config/config.xml
```

Paste them into `dashboard.env`, then `docker compose up -d --build homepage-dashboard`.

Visit http://localhost:3000 and sign in with the bootstrap admin
(`AUTHENTIK_BOOTSTRAP_EMAIL`/`AUTHENTIK_BOOTSTRAP_PASSWORD` in `authentik.env`) —
Authentik prompts for a password reset on first login for that account by
default, which is expected.

## Known-good version note

Authentik `2025.8.6` (the tag pinned in the real Quadlets) is what this was
actually tested against. Authentik itself reported a newer `2026.8.1`
available during testing — don't bump the pin without re-validating against
this same harness first; blueprint field shapes have already changed once
between the version this was originally written against and 2025.8.6 (see
the `redirect_uris` note in the dashboard README).

## Teardown

```bash
docker compose down -v   # -v also removes the named volumes (fresh state next time)
```
