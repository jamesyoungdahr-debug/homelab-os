#!/usr/bin/env bash
# Installs and configures Limine as the bootloader for the just-installed
# system. Run by Calamares' shellprocess@limine-bootloader job, chrooted
# into the target — so every path/command here operates on the target
# system, not the live session.
#
# Written as a real script rather than a static limine.conf baked into the
# image, specifically to avoid depending on Calamares' own GlobalStorage
# placeholder-substitution syntax for the root partition UUID — this script
# determines it itself, live, from the actual target it's running in
# (findmnt on "/" inside a chroot reflects the chroot's own root, i.e. the
# target system Calamares just built).

set -euo pipefail

# The ESP is the partition Calamares mounted at /boot/efi (or /efi,
# depending on partition layout) — check both, matching limine-entry-tool's
# own documented auto-detection order.
for candidate in /boot/efi /efi /boot; do
    if mountpoint -q "$candidate" 2>/dev/null && [ -d "$candidate/EFI" -o -w "$candidate" ]; then
        ESP="$candidate"
        break
    fi
done
: "${ESP:?Could not find a mounted EFI System Partition under /boot/efi, /efi, or /boot}"

mkdir -p "${ESP}/EFI/limine"
cp /usr/share/limine/BOOTX64.EFI "${ESP}/EFI/limine/BOOTX64.EFI"
# Also drop a copy at the removable-media fallback path — boots correctly
# even on firmware that ignores/loses the NVRAM entry below, which matters
# for a homelab server whose exact firmware behavior isn't fully known yet.
mkdir -p "${ESP}/EFI/BOOT"
cp /usr/share/limine/BOOTX64.EFI "${ESP}/EFI/BOOT/BOOTX64.EFI"

ROOT_UUID="$(findmnt -no UUID /)"
ROOT_DEVICE="$(findmnt -no SOURCE /)"
ESP_DISK="$(lsblk -no PKNAME "$(findmnt -no SOURCE "${ESP}")")"
ESP_PARTNUM="$(findmnt -no SOURCE "${ESP}" | grep -oE '[0-9]+$')"

# Limine's own ext4 driver can't read our root filesystem: mkfs.ext4 on a
# current e2fsprogs enables the `orphan_file` and `metadata_csum_seed`
# features by default, which Limine doesn't understand, so it fails to open
# ANY path on that partition (confirmed: PANIC "Failed to open kernel with
# path" even with a correct uuid()-referenced path and a verified-matching
# UUID). Limine reads its own ESP (FAT32) fine — that's how it found this
# very limine.conf — so sidestep the ext4 compatibility problem entirely by
# keeping a copy of the kernel/initramfs ON the ESP and loading them via
# `boot():`, which resolves to "the partition Limine itself was loaded
# from" (i.e. $ESP here). The root filesystem stays ext4 as normal; only
# the boot-time-readable copies live on the ESP. Kept in sync on kernel
# upgrades by the homelab-limine-sync pacman hook (see
# /etc/pacman.d/hooks/95-homelab-limine-sync.hook).
mkdir -p "${ESP}/boot"
cp /boot/vmlinuz-linux "${ESP}/boot/vmlinuz-linux"
cp /boot/initramfs-linux.img "${ESP}/boot/initramfs-linux.img"

cat > "${ESP}/EFI/limine/limine.conf" <<EOF
timeout: 3

/homelab-os
    protocol: linux
    path: boot():/boot/vmlinuz-linux
    cmdline: root=UUID=${ROOT_UUID} rw quiet
    module_path: boot():/boot/initramfs-linux.img
EOF

# NVRAM entry — best-effort; the fallback path copy above is what actually
# guarantees boot if this doesn't take (e.g. firmware without NVRAM
# support, or running inside a VM that doesn't persist it).
efibootmgr --create \
    --disk "/dev/${ESP_DISK}" \
    --part "${ESP_PARTNUM}" \
    --label "homelab-os" \
    --loader '\EFI\limine\BOOTX64.EFI' \
    --unicode || true

echo "Limine installed: root=${ROOT_DEVICE} (UUID=${ROOT_UUID}), ESP=${ESP}"
