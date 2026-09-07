#!/usr/bin/env bash
# Run by the homelab-limine-sync pacman hook after every kernel/initramfs
# update. Limine loads the kernel via `boot():` (see homelab-limine-install.sh
# for why: its ext4 driver can't read a filesystem with the orphan_file /
# metadata_csum_seed features current mkfs.ext4 enables by default) — that
# means the copies living on the ESP are what actually boots, not
# /boot/vmlinuz-linux itself. Without this, a routine kernel upgrade would
# regenerate /boot/initramfs-linux.img but leave the ESP's copy stale, and
# the next boot would run the OLD kernel with a mismatched initramfs.
set -euo pipefail

for candidate in /boot/efi /efi /boot; do
    if mountpoint -q "$candidate" 2>/dev/null && [ -d "$candidate/EFI" -o -w "$candidate" ]; then
        ESP="$candidate"
        break
    fi
done
: "${ESP:?Could not find a mounted EFI System Partition under /boot/efi, /efi, or /boot}"

mkdir -p "${ESP}/boot"
cp /boot/vmlinuz-linux "${ESP}/boot/vmlinuz-linux"
cp /boot/initramfs-linux.img "${ESP}/boot/initramfs-linux.img"
