#!/usr/bin/env bash
# Run by Calamares (chrooted into the target) between initcpiocfg and
# initcpio. unpackfs just copies the live squashfs verbatim, so the target's
# /etc/mkinitcpio.conf still has the live medium's archiso-only HOOKS
# (archiso, archiso_loop_mnt, archiso_pxe_common, archiso_pxe_nbd,
# archiso_pxe_http, archiso_pxe_nfs) baked in by releng's preset. Those hooks
# need binaries we deliberately don't ship (no PXE/network-boot support:
# ipconfig, nbd-client) and make mkinitcpio hard-fail with exit code 1 on a
# real install. They're meaningless outside a live/PXE boot anyway — strip
# them so mkinitcpio builds a normal installed-system initramfs.
#
# That alone isn't enough, though: the mkinitcpio-archiso package (needed at
# BUILD time so mkarchiso can build the live medium's own initramfs) also
# installs its own preset (/etc/mkinitcpio.d/linux.preset, naming the preset
# "archiso" instead of the normal "default"/"fallback") and a conf.d
# drop-in (/etc/mkinitcpio.conf.d/archiso.conf) that mkinitcpio.conf.d's
# override mechanism applies ON TOP of /etc/mkinitcpio.conf regardless of
# what HOOKS says there — so it reintroduces the same archiso hooks even
# after the sed above. Replace both with what a normal `linux` package
# install would leave, so mkinitcpio builds plain
# /boot/initramfs-linux(.img|-fallback.img) — exactly what our own
# homelab-limine-install.sh's limine.conf already points at.
set -euo pipefail
sed -i -E 's/[[:space:]]*archiso(_[a-z_]+)?//g' /etc/mkinitcpio.conf

rm -f /etc/mkinitcpio.conf.d/archiso.conf
rm -f /etc/mkinitcpio.d/linux.preset

cat > /etc/mkinitcpio.d/linux.preset <<'EOF'
# mkinitcpio preset file for the 'linux' package

ALL_kver="/boot/vmlinuz-linux"

PRESETS=('default' 'fallback')

default_image="/boot/initramfs-linux.img"

fallback_image="/boot/initramfs-linux-fallback.img"
fallback_options="-S autodetect"
EOF
