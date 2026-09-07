# homelab-os monorepo

- [`apps/homepage-dashboard/`](apps/homepage-dashboard) — the custom
  dashboard web app: SSO login via Authentik, live status widgets for
  Sonarr/Radarr/Prowlarr, and host system stats (CPU/RAM/disk/network). Built
  and published as its own container image.
- [`distro/`](distro) — an earlier, **abandoned** atomic-distro approach
  (BlueBuild on Fedora Atomic/Aurora). Kept for reference only; see "Why two
  distro attempts" below.

**The actual OS now lives in its own repo:**
[github.com/jamesyoungdahr-debug/HoltOS](https://github.com/jamesyoungdahr-debug/HoltOS)
— a custom Arch Linux live/install medium (archiso + Calamares + Limine)
with a pre-wired stack of Podman Quadlets: Authentik (SSO), Sonarr, Radarr,
Prowlarr, Jellyseerr, qBittorrent, and Plex. It was split out of this
monorepo once it had a validated end-to-end install, since it's independent
build/release tooling from the dashboard app. Start with HoltOS's own README
for build/install steps and Dell PowerEdge R720 hardware setup (PERC
controller mode, iDRAC virtual media, firmware/UEFI checks). Start with
`apps/homepage-dashboard/README.md` if you're iterating on the dashboard app
itself in isolation.

## Why two distro attempts

The OS was first built as a BlueBuild/Fedora-Atomic image (`distro/`,
below) and validated fairly far — real CI builds, a real bootable ISO, disk
inspection confirming Quadlets were correctly wired. It was abandoned in
favor of a plain Arch Linux + archiso + Calamares approach (now HoltOS):
Anaconda's automation surface made deeper VM testing unreliable, whereas
archiso's live-session-is-the-install-target model let every install/boot
bug actually get found and fixed through real, repeated VM testing rather
than disk-inspection-only validation. `distro/` is left in place as a record
of that work, not as an active alternative.

## Why two pieces instead of one

Rebuilding/reflashing a full OS image every time the dashboard app changes
would be slow and risky. Keeping the dashboard as its own image — referenced
by tag from a Quadlet file, exactly like every other app in the stack
(Sonarr, Authentik, etc.) — means the two can be versioned, tested, and
rolled back independently.

## Status / what's left before this is real

The application layer — dashboard app, Authentik SSO, and the Sonarr/Radarr/
Prowlarr integration — has been built, run, and validated end to end against
a real local Docker stack: real SSO login round-trip through Authentik, all
three *arr widgets showing live data, both as a plain dev-server process and
as this app's own container talking to the others over a Docker network
(the same shape the real Podman Quadlets use). That process caught and
fixed several real bugs — see `apps/homepage-dashboard/README.md`'s
"Verified by actually running this" section for the list.

The OS itself (HoltOS) has a fully validated end-to-end cycle: boot the live
ISO → install with no password prompt → cold reboot → Limine → a real SDDM
login prompt → the full Podman Quadlet stack (Authentik, Postgres, Redis,
Sonarr, Radarr, Prowlarr, Jellyseerr, qBittorrent, Plex, the dashboard) comes
up on its own, secrets auto-generated, no manual setup. See HoltOS's own
README for the details and what's left (mainly: real R720 hardware — PERC
controller reconfiguration, iDRAC virtual media install).
