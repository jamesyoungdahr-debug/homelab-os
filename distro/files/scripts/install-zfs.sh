#!/usr/bin/env bash
# Installs OpenZFS via plain `dnf install`, NOT `rpm-ostree install`.
#
# This is the third and (so far) final iteration of this script — the first
# two both used `rpm-ostree install` (directly, and via BlueBuild's official
# `rpm-ostree` module) and both failed identically, in both a local WSL2
# Podman/Buildah environment AND real GitHub Actions CI, with:
#   error: This system was not booted via libostree
# rpm-ostree talks to a live rpm-ostreed daemon over D-Bus backed by a real
# OSTree sysroot, which no container BUILD (local or CI) has — only an
# actually-deployed/booted ostree host does. Confirmed by testing directly:
# plain `dnf install` (including from a URL, and installing a package from a
# repo added by a previous dnf call moments earlier) works fine in the exact
# same container-build context where rpm-ostree refuses.
#
# `dnf install zfs` here falls back to zfs-dkms (no prebuilt kmod-zfs
# matched this exact kernel yet) and registers the DKMS source. DKMS then
# immediately tries to build the module against the CURRENT kernel — which,
# during any container-based image build (this one or GitHub Actions CI),
# is whatever arbitrary kernel the *build host* happens to be running
# (`uname -r`), never the kernel actually packaged into this image. That
# attempt fails harmlessly every time, by design, regardless of what
# kernel-devel is installed inside the container — DKMS builds against the
# running host's kernel version, not an installed package version, so there
# is no way to satisfy it at build time. Confirmed directly: the overall dnf
# transaction still exits 0, and dkms.service (enabled by the zfs package
# itself) is what actually builds the module, correctly, against the real
# kernel at the real system's first boot.
set -euo pipefail

FEDORA_VERSION="$(rpm -E %fedora)"
echo "Installing OpenZFS for Fedora ${FEDORA_VERSION}"

# Separate dnf calls, not one combined list — OpenZFS's own Fedora docs do
# this as two distinct commands for a reason: a repo-providing RPM and a
# package from that same repo aren't reliably resolvable in one transaction.
dnf install -y "https://zfsonlinux.org/fedora/zfs-release-3-1.fc${FEDORA_VERSION}.noarch.rpm"
dnf install -y zfs

# Bundled here rather than a separate `rpm-ostree` module entry — that
# module hit the same "not booted via libostree" failure as raw
# `rpm-ostree install` even for a URL-based package, so named packages
# from it are untested and best avoided until proven otherwise. Plain dnf
# is confirmed working for all of this.
dnf install -y smartmontools lm_sensors

echo "OpenZFS + monitoring tools install complete for Fedora ${FEDORA_VERSION}"
