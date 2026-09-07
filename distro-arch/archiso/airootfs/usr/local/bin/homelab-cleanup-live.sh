#!/usr/bin/env bash
# Run by Calamares (chrooted into the target), after users/displaymanager.
# unpackfs copies the ENTIRE live squashfs onto the target verbatim,
# including live-session-only accounts and config that customize_airootfs.sh
# set up purely for the live ISO's own convenience (see
# airootfs/root/customize_airootfs.sh): the liveuser account, a
# wheel-GROUP-wide passwordless-sudo rule (not just for liveuser — it would
# grant unrestricted passwordless root to the real account just created,
# since Calamares' users module puts that account in wheel too), SDDM
# autologin pointed at liveuser, and the "Install homelab-os" desktop
# launcher. None of that belongs on the installed system — left in place,
# the install boots straight into a stale liveuser desktop instead of
# prompting for the real account.
set -euo pipefail

userdel -r liveuser 2>/dev/null || true
rm -f /etc/sudoers.d/liveuser-wheel
rm -f /etc/sddm.conf.d/autologin.conf
rm -f /usr/share/applications/homelab-install.desktop
