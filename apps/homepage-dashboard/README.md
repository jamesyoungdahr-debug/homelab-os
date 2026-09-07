# homepage-dashboard

Next.js dashboard: SSO login via Authentik, live widgets for Sonarr/Radarr/Prowlarr,
and host system stats (CPU/RAM/disk/network). Built to run either standalone
(`.env` from `.env.example`) or as a Quadlet inside the
[homelab-os](../../distro) image, where its env vars come from
`distro/secrets.example/dashboard.env.example` instead.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

Requires a reachable Authentik instance (for SSO) and Sonarr/Radarr/Prowlarr
instances (for the widgets) — point the corresponding env vars at them.
Widgets fail independently: an unreachable *arr service shows "Unreachable"
in its own card without breaking the rest of the page.

## Authentik setup

1. Providers → Create → OAuth2/OpenID Provider. Client type: Confidential. Redirect URI: `https://<host>/api/auth/callback/authentik`.
2. Applications → Create, bind it to the provider above.
3. `AUTHENTIK_ISSUER` = the provider's "OpenID Configuration URL" with the trailing `.well-known/openid-configuration` stripped.
4. `AUTHENTIK_PUBLIC_URL` = the base origin (scheme + host + port, no path) that a **browser** can reach Authentik at. **This matters and is easy to get wrong**: verified against a live Authentik instance that its discovery document mirrors whatever host/port a request used for *every* endpoint it returns (token, userinfo, jwks, authorization — all of them, not just one). If `AUTHENTIK_ISSUER` points at a container-internal address (as it does when Authentik and this app are both containers on the same network), that address only works for this app's own server-to-server calls — it's meaningless to the end user's browser, which needs `AUTHENTIK_PUBLIC_URL` for the login redirect instead. If Authentik and this app are both just plain `localhost` processes (e.g. both run directly on your dev machine, not containerized), the two values are simply the same. See `auth.ts` for exactly how the split is used.
5. `AUTHENTIK_CLIENT_ID` / `AUTHENTIK_CLIENT_SECRET` = from the provider detail page.

(Inside homelab-os, steps 1-2 are automated by `distro/files/system/etc/authentik/blueprints/homepage-oidc.yaml` — you only need to set the client secret. That blueprint's `redirect_uris` field is a list of `{matching_mode, url}` objects, not a bare string — confirmed against a live Authentik 2025.8.6 instance, which otherwise rejects the blueprint with "Expected a list of items but got type str".)

## Getting *arr API keys

Each app: Settings → General → Security → API Key.

## Build

```bash
docker build -t homepage-dashboard .
```

## Verified by actually running this (2026-09-06)

Node.js/Next.js/Docker weren't available when this was first scaffolded — once they were, real bugs turned up that a build/type-check alone wouldn't have caught:

- Next.js has moved to v16; `middleware.ts` is renamed to `proxy.ts` (the exported function too: `middleware` → `proxy`). Already renamed here.
- Auth.js v5's `export { auth as proxy }` alone does **not** block unauthenticated requests — it only decorates `req.auth`. Needs an explicit `callbacks.authorized: ({ auth }) => !!auth` in `auth.ts`, confirmed by watching an unauthenticated request sail through to the dashboard before that callback was added.
- `next-auth@5.0.0-beta.25` (the version this was first pinned to) carries a critical advisory (OAuth state/nonce/PKCE cookies not bound to their provider) — bumped to `5.0.0-beta.32`. `next` itself was bumped past a postcss XSS/path-traversal advisory in the process (`npm audit` was clean afterward).
- `auth.ts` must build its NextAuth config **inside** the request-scoped callback form (`NextAuth(() => ({...}))`), not by calling `authentikEnv()` at module scope — the eager form crashed `next build` in a Docker build that (correctly) has no real secrets available at build time.
- Missing `.dockerignore` let a local `.env.local` leak into the Docker build context. Added one.
- The Authentik blueprint's `redirect_uris` needed the `{matching_mode, url}` list shape (see Authentik setup above), and the redirect URI itself must be browser-reachable — the same reasoning as `AUTHENTIK_PUBLIC_URL` above, not the internal container name.

Validated end to end against a real local Docker stack (Authentik + Postgres + Redis + Sonarr + Radarr + Prowlarr + this app, `distro/local-test/docker-compose.yml`): full SSO login round-trip, all three *arr widgets showing live data, both as a plain `npm run dev` process and as this app's own built container talking to the others over a Docker network — the same shape the real Podman Quadlets use.

## Known risks still unverified

- `DISK_MOUNT_PATH` should point at wherever your media/appdata actually lives (`/var/mnt/tank` inside homelab-os) — not exercised against a real ZFS-backed path yet.
- The real homelab-os distro (BlueBuild image build, Podman Quadlets, ZFS kmod, bootc ISO) has not been built or booted — only this app and the Authentik/*arr stack around it have been validated, via Docker Desktop, not Podman.
