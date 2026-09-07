# homelab-os

A custom atomic Linux distro (BlueBuild, built on Universal Blue's [Aurora](https://getaurora.dev) —
Fedora Atomic + KDE Plasma) with ZFS support and a pre-wired self-hosted media
stack: Authentik (SSO), Sonarr, Radarr, Prowlarr, Jellyseerr, qBittorrent, and
the custom [homepage dashboard](../apps/homepage-dashboard).

See [`../lovely-jumping-lake.md` plan](/) (or your own copy of the plan) for
the full architecture writeup. This README only covers day-to-day build/install
steps and the hardware-specific setup for a Dell PowerEdge R720.

## Building the image

Must be built via the GitHub Actions CI (`.github/workflows/distro-build.yml` — at the repo root, not nested under `distro/`, since GitHub Actions only reads workflows from the actual repo root). This repo lives at [github.com/jamesyoungdahr-debug/homelab-os](https://github.com/jamesyoungdahr-debug/homelab-os); pushing to it builds and publishes `ghcr.io/jamesyoungdahr-debug/homelab-os` automatically, then separately produces an installer ISO via `bootc-image-builder`.

**Local `bluebuild build` won't work for the ZFS packages, and that's now designed around rather than fought.** Root cause, found by testing against both a local WSL2 Podman/Buildah setup *and* BlueBuild's real GitHub Actions CI (same error in both — see git history for the version of this file written mid-investigation, before the actual fix, if you want the full trail):

- A raw `rpm-ostree install <url-or-package>` call — which is what an earlier version of this recipe used, via a custom `script` module, to add the OpenZFS repo RPM and install the kmod — fails identically everywhere with `error: This system was not booted via libostree`. rpm-ostree talks to a live `rpm-ostreed` daemon over D-Bus backed by a real OSTree sysroot; no plain container build (local or CI) has that, only an actually-deployed/booted ostree host does.
- The **official** `rpm-ostree` module (the one already used for `zfs`/`smartmontools`/`lm_sensors`) does not hit this — whatever it does differently under the hood works in real CI. So the fix was to stop calling `rpm-ostree` directly from a custom script and route the OpenZFS repo RPM through that same official module instead, as two separate `rpm-ostree` module entries (see `recipes/recipe.yml`): one to install just the release RPM (drops the repo file), then a second to install `zfs` itself from the newly-added repo. This mirrors OpenZFS's own Fedora docs, which use two separate `dnf install` commands for exactly this reason — a repo-providing RPM and a package from that repo aren't reliably resolvable in one dnf/rpm-ostree transaction.
- This fix is written but **not yet re-verified against a real CI run** — the previous run failed on the old script-based approach. Check the Actions tab for the latest run before trusting this.

**Before your next real (CI) build:**

1. Confirm the latest `distro-build.yml` run actually succeeded — the ZFS package-install restructuring above hasn't had a green run yet.
2. Pin `base-image`/`image-version` in `recipes/recipe.yml` to a specific known-good Fedora release rather than `latest` (see Risks in the plan — floating `latest` can silently break the ZFS kmod build if the kernel jumps).
3. Verify the release-RPM filename/version in `recipes/recipe.yml`'s first `rpm-ostree` module entry against [OpenZFS's current Fedora install docs](https://openzfs.github.io/openzfs-docs/Getting%20Started/Fedora) — OpenZFS bumps that package's own version independently of Fedora's.

## First boot checklist

**Verified against a real Podman + systemd instance (2026-09-06)**, not just written from docs — see "What's been validated" below for what that caught and fixed.

1. `zpool import <poolname>` once, manually, to import your existing ZFS pool (pool assembly is data-dependent, so it's a runtime step, not baked into the image). After that, `zfs-import-cache`/`zfs-mount` keep it mounted across reboots.
2. Create `/var/mnt/tank/appdata/secrets/` and copy in `authentik.env` and `dashboard.env` from `secrets.example/`, filling in real values (see comments in each file). **Never commit the filled-in versions.**
3. Nothing else to start manually — confirmed that Podman's Quadlet generator picks up every `.container`/`.network` file and auto-starts it via `[Install] WantedBy=multi-user.target` on boot, with no `systemctl enable` or manual `systemctl start` needed (this was tested indirectly: an unplanned VM restart mid-test brought every single service back up, Authentik and *arr apps and Plex included, with zero manual intervention).
4. Once Sonarr/Radarr/Prowlarr have started for the first time, grab each one's API key (Settings → General → Security → API Key) and add it to `dashboard.env`, then `systemctl restart homepage-dashboard`.
5. Claim the Plex server: visit `http://<server-ip>:32400/web`, sign in, and claim it via [plex.tv/claim](https://plex.tv/claim) when prompted.
6. Log into `http://<server-ip>:9000` to confirm Authentik came up and the `homepage-dashboard` application (auto-provisioned by `homepage-oidc.yaml`) exists, then visit the dashboard at `http://<server-ip>:3000` and confirm SSO login works end to end.

## What's been validated (2026-09-06, real Podman + systemd, not just Docker Compose)

Copied the actual Quadlet files in this repo to `/usr/share/containers/systemd/` on a real Podman 5.7/systemd host (WSL2 Ubuntu — not the target Aurora/Fedora, but real Podman and real systemd, so this exercises the actual mechanism the distro depends on, not a Docker Compose stand-in):

- All 12 `.container`/`.network` files generate valid systemd units with zero syntax errors — `podman-system-generator` accepted every one on the first try.
- **Found and fixed a real bug**: Authentik's container crash-looped with `PermissionError: [Errno 13] Permission denied: '/media/public'` against a freshly-created, root-owned host directory — its image runs as UID 1000 with no self-chowning init step (unlike the LinuxServer *arr images, which do this themselves via PUID/PGID). Fixed by adding Podman's `:U` volume flag to `authentik-server.container` and `authentik-worker.container`'s `media`/`certs` mounts, which tells Podman to chown the host directory to match on start.
- With that fix, the `homepage-oidc.yaml` blueprint applied successfully **fully automatically** on first migration — no manual `ak apply_blueprint` step needed, confirming the "zero manual OIDC setup" goal actually holds.
- Container-to-container DNS resolution on the `homelab` network works (confirmed `sonarr` resolving and reaching `authentik-server` by name).
- The dashboard's `Dockerfile` builds cleanly under Podman/Buildah too, not just Docker — same image, same result.
- A full real SSO login round-trip through this Podman-backed Authentik, with the dashboard also running as a Podman-managed container, succeeded.
- Installed the real `bluebuild` CLI (v0.9.37) and ran `recipe.yml` through it: **templated into a fully valid Containerfile on the first try**, and pushing to GitHub confirmed the workflow itself runs end to end (dashboard image build succeeded on the very first real CI run). This file was written from documentation alone and had never touched the real tool before.
- **Found and fixed two real bugs in the actual GitHub Actions CI run**, not just locally: a custom `script` module requires scripts to live at `files/scripts/` specifically (it originally lived in a top-level `zfs/` directory); and — the bigger one — `rpm-ostree install` called directly from that custom script fails identically in real CI as it did locally (`This system was not booted via libostree`), while the official `rpm-ostree` module doesn't. Restructured the ZFS install to go entirely through that official module instead of a custom script — see "Building the image" above.
- Also found and fixed: the CI workflow files lived at `distro/.github/workflows/` and `apps/homepage-dashboard/.github/workflows/` — GitHub Actions only reads `.github/workflows/` at the actual repo root, so neither workflow ever triggered on the first push. Moved both to the real location. Separately, both also targeted a `main` branch trigger while this repo's default branch is `master`.

Not yet validated: the ZFS-module restructuring's actual CI result (pushed, not yet re-run as of this writing), real Fedora/Aurora specifically for the Quadlet/Authentik testing above (that was WSL2 Ubuntu), and bootc ISO generation/boot.

## Hardware setup: Dell PowerEdge R720

This distro targets a 2012-era dual Xeon E5-2600 R720 with a PERC H710/H310
RAID controller and iDRAC7. None of this is automated by the image build —
it has to happen on the physical hardware before/during install.

- **PERC controller → HBA/passthrough mode.** ZFS needs raw disk access, not a hardware RAID volume underneath it. Check whether your specific PERC H710 firmware revision supports true HBA/passthrough mode (not all do). If it doesn't, the fallback is to create one single-disk RAID-0 virtual disk per physical drive — it works, but still hides real SMART data behind the controller, so prefer true HBA mode if available.
- **iDRAC7 virtual media.** Upload the built ISO through the iDRAC web console (Virtual Console → Virtual Media → Map CD/DVD) to install without physical USB media.
- **Firmware.** Update BIOS/iDRAC firmware to the latest available for this generation before installing. Confirm the boot mode is set to **UEFI**, not legacy BIOS — atomic/bootc images assume UEFI.
- **CPU generation — checked, looks fine.** The R720's Xeon E5-2600 (Sandy/Ivy Bridge) supports AVX but not AVX2 (`x86-64-v3`). Fedora's proposal to raise the *default* baseline to x86-64-v3 was rejected for Fedora 45 and pushed to at least Fedora 46 under review — and even if/when it lands, the plan on the table only adds *optional* v3-optimized package variants alongside the existing default baseline, not a hard replacement of it. So current Fedora/Aurora should still run on this CPU. Worth a quick re-check of Fedora's status page right before the real build, since this is a moving target, but it's no longer the open question it was.
- **No GPU / no Quick Sync.** This is a rack server with no iGPU beyond a basic remote-KVM video chip. Plex will only be able to do software transcoding unless you add a discrete GPU via PCIe passthrough later.

## Testing before touching real hardware

Boot the built ISO in a VM first:

- Confirm KDE Plasma boots and you can log in.
- `systemctl status sonarr.service` (and the others) to confirm Quadlets started.
- Attach a scratch virtual disk, `zpool create tank /dev/sdX`, reboot the VM, confirm it auto-imports.
- Walk through the full SSO login flow via the dashboard app.

Only move to the real R720 (PERC reconfiguration + iDRAC virtual media install)
once the VM boot is fully validated.
