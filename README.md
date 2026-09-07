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
and **CI now builds a real OS image and a real bootable installer ISO, end
to end** (run
[`34078289039`](https://github.com/jamesyoungdahr-debug/homelab-os/actions/runs/34078289039),
`homelab-os-iso` artifact). Getting there caught a string of real bugs, in
this order: workflow files nested under `distro/.github/` and
`apps/homepage-dashboard/.github/` are invisible to GitHub Actions (moved
to the real repo root); both workflows targeted a `main` branch trigger
while this repo's default branch is `master`; `rpm-ostree install` — both
called directly and through BlueBuild's own official `rpm-ostree` module —
fails identically in real CI with "not booted via libostree" (switched all
package installs to plain `dnf install`, confirmed working in the same
context); `bootc-image-builder` no longer pulls its target image itself
(added an explicit pull step); and its ISO lands at
`output/bootiso/install.iso`, not flat in `output/`. See
`distro/README.md`'s "Building the image" and "What's been validated"
sections for the full trail.

**The ISO has now been booted in a VM (QEMU/KVM in WSL2), and it works**: real UEFI boot showing GRUB's "Install Aurora 44" entry, a fully unattended Anaconda install deploying our actual container image, a reboot into a genuinely rendering KDE Plasma session ("Welcome to Plasma Desktop / Powered by Aurora"), and — via direct disk inspection (`qemu-nbd` + `chroot` into the ostree deployment, since driving Anaconda's GUI further by remote automation proved unreliable) — confirmation that all 12 Quadlet files, the Authentik blueprint, ZFS (`zfs`/`zfs-dkms`/`libzfs7`), and its systemd units are genuinely present and correctly configured in the real installed system. See `distro/README.md`'s "Testing before touching real hardware" section for the full detail, including the one open item (a live boot completing far enough to confirm services actually reach `active (running)`, not just that they're correctly wired to start).

**What's left:**

1. Optionally: finish validating a live boot to `active (running)` service state and a real ZFS pool import/reboot test — the disk-inspection evidence above is already strong, so this is a nice-to-have, not a blocker.
2. Move to the real R720 hardware: PERC controller reconfiguration, iDRAC virtual media install (see `distro/README.md`'s hardware section).

See the project plan for the full list of flagged risks and the reasoning
behind each architecture decision.
