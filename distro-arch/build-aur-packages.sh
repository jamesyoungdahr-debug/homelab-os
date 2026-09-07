#!/usr/bin/env bash
# Run as root inside the calamares-installed container. Builds the
# remaining AUR packages our archiso profile needs as the 'builder' user,
# leaving the resulting .pkg.tar.zst files in /tmp/pkgout for extraction.
set -euo pipefail

mkdir -p /tmp/pkgout
chown builder:builder /tmp/pkgout

# zfs-dkms's tarball is signed by the OpenZFS release key, which isn't in
# the default keyring — import it before makepkg tries to verify sources.
su - builder -c "gpg --keyserver keyserver.ubuntu.com --recv-keys 6AD860EED4598027" || \
su - builder -c "gpg --keyserver hkps://keys.openpgp.org --recv-keys 6AD860EED4598027"

for pkg in zfs-dkms zfs-utils limine-mkinitcpio-hook limine-entry-tool; do
    echo "=== Building ${pkg} ==="
    rm -rf "/tmp/build-${pkg}"
    su - builder -c "git clone https://aur.archlinux.org/${pkg}.git /tmp/build-${pkg}"
    su - builder -c "cd /tmp/build-${pkg} && makepkg -s --noconfirm --needed"
    cp /tmp/build-"${pkg}"/*.pkg.tar.zst /tmp/pkgout/
done

echo "=== Done, packages in /tmp/pkgout ==="
ls -la /tmp/pkgout/
