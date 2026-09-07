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

**What's left, and why it needs GitHub CI now, not more local testing:**

1. Verify the OpenZFS repo/package names in `distro/files/scripts/build-zfs-kmod.sh` against whatever Fedora version Aurora is tracking (see `distro/README.md`).
2. **Actually building the OS image needs to happen in the real GitHub Actions CI**, not generic local Podman/Buildah — confirmed the hard way: `rpm-ostree install` (used for the ZFS kmod and for `zfs`/`smartmontools`/`lm_sensors`) needs a live systemd+D-Bus-backed OSTree sysroot that a plain local container build never has, no matter which privilege flags or workarounds were tried. This is standard and expected for this class of image (BlueBuild's whole ecosystem runs on CI for exactly this reason) — it just means the next step is pushing this repo to GitHub and letting CI build it, rather than continuing to chase it locally.
3. Once CI produces a real image, generate the ISO via `bootc-image-builder` and boot it in a VM — Podman Quadlets under real Fedora/Aurora, the ZFS kmod actually building against a real kernel, and KDE Plasma booting are all still unexercised.
4. Only then move to the real R720 hardware.

See the project plan for the full list of flagged risks and the reasoning
behind each architecture decision.
