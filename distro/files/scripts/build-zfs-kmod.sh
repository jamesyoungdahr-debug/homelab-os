#!/usr/bin/env bash
# Builds and installs the OpenZFS kernel module against the exact kernel
# baked into this image build, then enables auto-import/auto-mount of
# whatever ZFS pool the system finds at boot.
#
# This only handles a *data* pool (media/appdata) — root stays on Aurora's
# default filesystem. Root-on-ZFS on an atomic/OSTree system is a much harder,
# largely unsupported problem and isn't what was asked for here: the pool
# just needs to be importable and mounted, not bootable.
#
# TOP RISK (see plan): OpenZFS releases lag new kernels. If this script fails
# because no OpenZFS build is available yet for the kernel in this Aurora
# base image, that's the base-image/kernel-version mismatch to fix by pinning
# an older `image-version` in recipes/recipe.yml, not a bug in this script.

set -oue pipefail

KERNEL_VERSION="$(rpm -q --qf '%{VERSION}-%{RELEASE}.%{ARCH}' kernel)"
echo "Building OpenZFS kmod for kernel ${KERNEL_VERSION}"

# OpenZFS publishes a Fedora dnf repo with prebuilt kmods for supported
# kernels, and falls back to building from source (kmod-zfs-devel /
# zfs-dkms-style build) when no prebuilt kmod matches. Verify the exact repo
# URL/package names against https://openzfs.github.io/openzfs-docs/Getting%20Started/Fedora
# for whatever Fedora version Aurora is currently tracking.
rpm-ostree install --allow-inactive \
    https://zfsonlinux.org/fedora/zfs-release.fc"$(rpm -E %fedora)".noarch.rpm

# Prefer the prebuilt kmod matching this exact kernel; if unavailable, install
# the dkms-style package and build against kernel-devel instead.
if ! rpm-ostree install --allow-inactive "kmod-zfs-${KERNEL_VERSION}"; then
    echo "No prebuilt kmod-zfs for ${KERNEL_VERSION}, falling back to zfs-dkms build"
    rpm-ostree install --allow-inactive kernel-devel-"${KERNEL_VERSION}" zfs-dkms
fi

rpm-ostree install --allow-inactive zfs zfs-dracut

# Regenerate the initramfs so dracut picks up the zfs module hooks.
dracut -f --regenerate-all

# Standard OpenZFS systemd units — actually enabling them happens in
# recipes/recipe.yml's `systemd` module (rpm-ostree image builds can't run
# `systemctl enable` directly in this script's context), this just confirms
# the unit files exist so that module doesn't silently no-op.
for unit in zfs-import-cache.service zfs-import-scan.service zfs-mount.service zfs-zed.service; do
    systemctl list-unit-files "$unit" >/dev/null
done

echo "OpenZFS kmod build complete for ${KERNEL_VERSION}"
