# homelab-os monorepo

Two independently-built pieces that together make up a self-hosted homelab
server:

- [`distro/`](distro) — a custom atomic Linux distro (BlueBuild, built on
  Universal Blue's Aurora — Fedora Atomic + KDE Plasma) with ZFS support and
  a pre-wired stack of Podman Quadlets: Authentik (SSO), Sonarr, Radarr,
  Prowlarr, Jellyseerr, qBittorrent, and Plex.
- [`apps/homepage-dashboard/`](apps/homepage-dashboard) — the custom
  dashboard web app: SSO login via Authentik, live status widgets for
  Sonarr/Radarr/Prowlarr, and host system stats (CPU/RAM/disk/network). Built
  and published as its own container image, referenced from the distro's
  `homepage-dashboard.container` Quadlet.

Start with `distro/README.md` for build/install steps and the
Dell PowerEdge R720-specific hardware setup (PERC controller mode, iDRAC
virtual media, firmware/UEFI checks). Start with
`apps/homepage-dashboard/README.md` if you're iterating on the dashboard app
itself in isolation.

## Why two pieces instead of one

Rebuilding/reflashing a full OS image every time the dashboard app changes
would be slow and risky. Keeping the dashboard as its own image — referenced
by tag from a Quadlet file, exactly like every other app in the stack
(Sonarr, Authentik, etc.) — means the two can be versioned, tested, and
rolled back independently.

## Status / what's left before this is real

The application layer — dashboard app, Authentik SSO, and the Sonarr/Radarr/
Prowlarr integration — has been built, run, and validated end to end against
a real local Docker stack (`distro/local-test/`, Docker Desktop on Windows):
real SSO login round-trip through Authentik, all three *arr widgets showing
live data, both as a plain dev-server process and as this app's own
container talking to the others over a Docker network (the same shape the
real Podman Quadlets use). That process caught and fixed several real bugs —
see `apps/homepage-dashboard/README.md`'s "Verified by actually running
this" section for the list (a Next.js 16 breaking change, an auth bypass, a
security advisory, a Docker build-time crash, and two Authentik blueprint
format issues).

The distro side has also had real validation, using WSL2 + real Podman +
real Buildah (not just Docker Desktop): all 12 Quadlet files generate valid
systemd units with zero errors, a real permission bug in the Authentik
Quadlets was found and fixed, the OIDC blueprint auto-applies with zero
manual steps, and `recipe.yml` templates into a fully valid Containerfile
against the real `bluebuild` CLI. See `distro/README.md`'s "What's been
validated" section for the details.

This repo now lives at
[github.com/jamesyoungdahr-debug/homelab-os](https://github.com/jamesyoungdahr-debug/homelab-os),
and CI has already caught more real bugs since the first push: workflow
files nested under `distro/.github/` and `apps/homepage-dashboard/.github/`
are invisible to GitHub Actions (it only reads `.github/workflows/` at the
actual repo root — moved them), both workflows targeted a `main` branch
trigger while this repo's default branch is `master`, and — the big one —
`rpm-ostree install` called from a custom script fails in real CI exactly
as it did locally, while routing the same install through the official
`rpm-ostree` module instead doesn't. See `distro/README.md`'s "Building the
image" and "What's been validated" sections for the full trail.

**What's left:**

1. Confirm the ZFS-install restructuring (see above) actually goes green on the next CI run — pushed, not yet re-verified.
2. Once CI produces a real image, generate the ISO via `bootc-image-builder` and boot it in a VM — Podman Quadlets under real Fedora/Aurora, the ZFS kmod actually loading against a real kernel, and KDE Plasma booting are all still unexercised.
3. Only then move to the real R720 hardware.

See the project plan for the full list of flagged risks and the reasoning
behind each architecture decision.
