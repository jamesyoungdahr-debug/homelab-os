# homelab-os

A custom atomic Linux distro (BlueBuild, built on Universal Blue's [Aurora](https://getaurora.dev) —
Fedora Atomic + KDE Plasma) with ZFS support and a pre-wired self-hosted media
stack: Authentik (SSO), Sonarr, Radarr, Prowlarr, Jellyseerr, qBittorrent, and
the custom [homepage dashboard](../apps/homepage-dashboard).

See [`../lovely-jumping-lake.md` plan](/) (or your own copy of the plan) for
the full architecture writeup. This README only covers day-to-day build/install
steps and the hardware-specific setup for a Dell PowerEdge R720.

## Building the image

**Must be built via the GitHub Actions CI (`.github/workflows/build.yml`), not a generic local Podman/Buildah setup — confirmed the hard way, see below.** Push to a GitHub repo and let CI build and publish `ghcr.io/<user>/homelab-os`, then separately produce an installer ISO via `bootc-image-builder`.

`bluebuild build recipes/recipe.yml` looks like it should work locally too, and the recipe **does** template correctly into a valid Containerfile (verified — see below) — but the build itself fails partway through on a genuine environment gap, not a bug in this recipe:

- Tested with real Podman 5.7 + Buildah 1.42 on a plain (non-ostree) Linux host (WSL2 Ubuntu 26.04).
- `rpm-ostree install` — used both by the `script` module (for the ZFS kmod) and the `rpm-ostree` module (for `zfs`/`smartmontools`/`lm_sensors`) — refuses to run: `error: This system was not booted via libostree; found container=podman environment variable.`
- Worked around the `container` env var check (`env -u container ...`) and got a *different* error: `System has not been booted with systemd as init system (PID 1)` — rpm-ostree talks to a live `rpm-ostreed` daemon over D-Bus, which needs a real running systemd, which a plain `buildah run`/`podman run` container doesn't have.
- Tried running the container with `--systemd=always` so systemd actually boots as PID 1 — `systemctl is-system-running` still reported `offline`, and `/sysroot/ostree` was empty. The image as pulled by a generic container tool is just the flattened rootfs; it doesn't carry a live OSTree sysroot the way an actually-deployed/booted ostree host does.
- This is well-documented as *possible* for real bootc/Universal Blue images (`RUN rpm-ostree install ...` in a Containerfile is the standard pattern, used everywhere in that ecosystem) — so BlueBuild's own GitHub Actions build environment clearly satisfies whatever rpm-ostree needs here. What that CI environment does differently wasn't identified; rather than keep reverse-engineering it, use the real thing.

**Before your first real (CI) build:**

1. Replace `<user>` in `files/system/usr/share/containers/systemd/homepage-dashboard.container` and this repo's image references with your actual GitHub username/org.
2. Pin `base-image`/`image-version` in `recipes/recipe.yml` to a specific known-good Fedora release rather than `latest` (see Risks in the plan — floating `latest` can silently break the ZFS kmod build if the kernel jumps).
3. Verify the `files/scripts/build-zfs-kmod.sh` repo URL and package names against [OpenZFS's current Fedora install docs](https://openzfs.github.io/openzfs-docs/Getting%20Started/Fedora) for whatever Fedora version Aurora is tracking at build time.
4. Set up the `SIGNING_SECRET` repo secret (cosign key pair) the workflow expects — see BlueBuild's [image signing docs](https://blue-build.org/how-to/cosign/).

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
- Installed the real `bluebuild` CLI (v0.9.37) and ran `recipe.yml` through it: **templated into a fully valid Containerfile on the first try** — all five modules (`files`, `script`, `rpm-ostree`, `systemd`, `signing`) recognized and correctly wired. This file was written from documentation alone and had never touched the real tool before.
- **Found and fixed a real bug**: the `script` module requires scripts to live at `files/scripts/`, not wherever else you'd put them — `build-zfs-kmod.sh` originally lived in a top-level `zfs/` directory and failed with "Cannot declare scripts to run if `/tmp/files/scripts` doesn't exist." Moved it.
- Attempting the actual local image *build* (not just templating) hit a real environment wall — see "Building the image" above for the full story. Short version: `rpm-ostree install` needs a live systemd+D-Bus-backed OSTree sysroot that a plain container run never has, so this class of build has to happen in BlueBuild's real CI, not generic local Podman/Buildah.

Not yet validated: real Fedora/Aurora specifically (this was WSL2 Ubuntu), the ZFS kmod build actually succeeding against a real kernel, and bootc ISO generation/boot — all blocked on needing a real CI-driven build first.

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
