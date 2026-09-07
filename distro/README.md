# homelab-os

A custom atomic Linux distro (BlueBuild, built on Universal Blue's [Aurora](https://getaurora.dev) —
Fedora Atomic + KDE Plasma) with ZFS support and a pre-wired self-hosted media
stack: Authentik (SSO), Sonarr, Radarr, Prowlarr, Jellyseerr, qBittorrent, and
the custom [homepage dashboard](../apps/homepage-dashboard).

See [`../lovely-jumping-lake.md` plan](/) (or your own copy of the plan) for
the full architecture writeup. This README only covers day-to-day build/install
steps and the hardware-specific setup for a Dell PowerEdge R720.

## Building the image

**Status: CI builds a real image and a real bootable ISO, end to end, confirmed green.** Must be built via the GitHub Actions CI (`.github/workflows/distro-build.yml` — at the repo root, not nested under `distro/`, since GitHub Actions only reads workflows from the actual repo root). This repo lives at [github.com/jamesyoungdahr-debug/homelab-os](https://github.com/jamesyoungdahr-debug/homelab-os); pushing to it builds and publishes `ghcr.io/jamesyoungdahr-debug/homelab-os`, then a second job produces an installer ISO via `bootc-image-builder` and uploads it as the `homelab-os-iso` workflow artifact — both jobs succeeded on run [`34078289039`](https://github.com/jamesyoungdahr-debug/homelab-os/actions/runs/34078289039).

**How package installation actually works here, after three iterations to find out (all confirmed by directly testing a real container build, not guessed from docs):**

1. Raw `rpm-ostree install <url-or-package>`, called from a custom `script` module — fails everywhere (local WSL2 Podman/Buildah *and* real GitHub Actions CI) with `error: This system was not booted via libostree`.
2. The **official** `rpm-ostree` module — same failure, for the exact same reason, even for a plain URL install. So it's not "the official module handles this correctly and raw scripts don't" — rpm-ostree itself just doesn't work as a build-time package installer in a container build, official module or not. It talks to a live `rpm-ostreed` daemon over D-Bus backed by a real OSTree sysroot, which no container build (local or CI) has — only an actually-deployed/booted ostree host does.
3. **Plain `dnf install` works fine** in the exact same build context — confirmed directly for a URL-based RPM, for a package from a repo added moments earlier by a separate `dnf install`, and for a package whose only path is `zfs-dkms` (no prebuilt kmod matched the build kernel). All ZFS/tooling installation now goes through a custom `script` module (`files/scripts/install-zfs.sh`) calling plain `dnf install`, not `rpm-ostree install` and not the `rpm-ostree` module.

One more thing this surfaced: `zfs-dkms`'s post-install script tries to build the kernel module immediately and fails ("kernel headers ... cannot be found") — that's expected and harmless, not a bug to fix. DKMS builds against the *build host's* running kernel (`uname -r`), which during any container-based build (local or CI) is never the kernel actually packaged into this image, so that attempt can never succeed at build time regardless of what's installed. The `zfs` package's own post-install scriptlet already registers the DKMS source and enables `dkms.service`, `zfs-import-cache.service`, `zfs-mount.service`, `zfs-zed.service`, and `zfs.target` — the real module build happens correctly at the real system's first boot, against its real kernel, with no extra recipe steps needed.

Two smaller CI fixes along the way, also confirmed against real runs: `bootc-image-builder` no longer pulls the target image itself (added an explicit `podman pull` step — it fails with "image not known" otherwise even though the image the ISO job needs was just published by the other job, since separate jobs run on separate runners with no shared state), and its ISO output isn't flat in `output/` — it's nested at `output/bootiso/install.iso`, so the artifact-upload glob had to point there instead of `output/*.iso` (which silently matched nothing without failing the job).

**Before relying on a build long-term:**

1. Pin `base-image`/`image-version` in `recipes/recipe.yml` to a specific known-good Fedora release rather than `latest` (see Risks in the plan — floating `latest` can silently break things if the kernel/Fedora version jumps between the base image and what `install-zfs.sh` expects).
2. Verify the release-RPM filename/version in `files/scripts/install-zfs.sh` against [OpenZFS's current Fedora install docs](https://openzfs.github.io/openzfs-docs/Getting%20Started/Fedora) — OpenZFS bumps that package's own version independently of Fedora's (confirmed the "3-1" part and the `.fc44` pattern are currently correct for Aurora's current Fedora 44, but that will drift over time).

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
- **Found and fixed a real bug in the actual GitHub Actions CI run**: a custom `script` module requires scripts to live at `files/scripts/` specifically (it originally lived in a top-level `zfs/` directory).
- **Found the real ZFS install mechanism through three CI/local iterations, not by guessing**: raw `rpm-ostree install` AND the official `rpm-ostree` module both fail identically, everywhere (local and real CI), with `This system was not booted via libostree` — rpm-ostree needs a live daemon+D-Bus+real-sysroot no container build has. Plain `dnf install` works fine in the exact same context, confirmed directly for a URL RPM, a package from a repo added moments earlier, and a DKMS-only package. See "Building the image" above for the full story.
- Also found and fixed: the CI workflow files lived at `distro/.github/workflows/` and `apps/homepage-dashboard/.github/workflows/` — GitHub Actions only reads `.github/workflows/` at the actual repo root, so neither workflow ever triggered on the first push. Moved both to the real location. Separately, both also targeted a `main` branch trigger while this repo's default branch is `master`.

- **The full CI pipeline is green end to end**: the OS image builds and pushes to `ghcr.io/jamesyoungdahr-debug/homelab-os`, and a real bootable ISO is generated and uploaded as the `homelab-os-iso` artifact (run [`34078289039`](https://github.com/jamesyoungdahr-debug/homelab-os/actions/runs/34078289039)). Two more real bugs found and fixed along the way — see "Building the image" above.

Not yet validated: real Fedora/Aurora specifically for the Quadlet/Authentik testing above (that was WSL2 Ubuntu, not this image), and — the big remaining one — actually booting the ISO. Nobody has confirmed KDE Plasma boots, the Quadlets start, or ZFS actually imports a pool on this image yet.

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

**Done (2026-09-07), QEMU/KVM in WSL2, real UEFI boot from the actual downloaded `homelab-os-iso` artifact:**

- GRUB boots the ISO and shows the real menu entry: **"Install Aurora 44"** — confirms this is a genuine bootable UEFI installer for our custom image, not a generic Fedora ISO.
- The embedded Anaconda kickstart runs **fully unattended** — no manual clicking needed to start the install, it deploys straight from `/run/install/repo/container` (our actual bootc container image, not a package-based install).
- Deployment completes (took ~25 min in this triple-nested Windows→WSL2→KVM setup — a real machine will be much faster) and the **system reboots into a real, rendering KDE Plasma session** — "Welcome to Plasma Desktop / Powered by Aurora" — confirmed via screenshot.
- The first-run setup wizard (language → keyboard → user account) is interactive but proved awkward to drive by remote automation — QEMU monitor's synthetic keyboard/mouse events turned out to be unreliable (see below), so account creation wasn't completed and no live desktop session was reached.
- **Switched to direct disk inspection instead** (paused the VM, connected the qcow2 via `qemu-nbd`, mounted the ostree deployment read-only) — this is actually more thorough than a live shell would have been, since it directly confirms file/package state rather than trusting a GUI:
  - All 12 `.container`/`.network` Quadlet files present at `/usr/share/containers/systemd/` in the real deployed filesystem, including the `:U`-fixed `authentik-server.container`.
  - The Authentik OIDC blueprint present at `/etc/authentik/blueprints/homepage-oidc.yaml`.
  - `rpm -qa` inside the deployment (via `chroot`) confirms **ZFS is genuinely installed**: `zfs-release-3-1.fc44`, `libzfs7-2.4.4-1`, `zfs-dkms-2.4.4-1`, `zfs-2.4.4-1` — plus `smartmontools-7.5-9` and `lm_sensors-3.6.0-24`.
  - `zfs-import.target`, `zfs-mount.service`, `zfs-share.service`, and `zfs-zed.service` are all correctly enabled under `/etc/systemd/system/` — confirming (as found earlier) that the package's own post-install scriptlet handles this without any extra recipe steps.

**A real, separate finding worth recording**: driving the Anaconda GUI wizard via QEMU monitor's `sendkey`/`mouse_move`/`mouse_button` commands was unreliable — clicks and keypresses were silently dropped more often than not, with no error. Attaching a real VNC client (via `novnc`/`websockify`, driven through an actual browser rather than raw monitor commands) worked reliably immediately. If you need to drive a QEMU VM's GUI for testing, use a real VNC/SPICE client — don't rely on monitor-injected input events.

**Not yet done**: completing the first-run wizard to an actual logged-in desktop session, confirming Quadlet services reach `active (running)` state on a real boot (disk inspection confirms they're *correctly configured to start*, not that they successfully *do* start — that still needs a live boot), and the ZFS pool import/scratch-disk test.

Only move to the real R720 (PERC reconfiguration + iDRAC virtual media install)
once you're comfortable with the level of validation above, or after completing
the remaining live-boot checks.
