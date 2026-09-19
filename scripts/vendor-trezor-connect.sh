#!/usr/bin/env bash
set -euo pipefail
# Copies Trezor Connect iframe/popup assets into public/trezor so the UI never
# loads connect.trezor.io. Install @trezor/connect, then run this script.
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/public/trezor"
mkdir -p "$dest"
pkg=""
for candidate in \
  "$root/node_modules/@trezor/connect" \
  "$root/node_modules/@trezor/connect-web"
do
  if [[ -d "$candidate" ]]; then
    pkg="$candidate"
    break
  fi
done
if [[ -z "$pkg" ]]; then
  echo "Install @trezor/connect (or @trezor/connect-web), then re-run." >&2
  echo "Until then, Trezor signing requires the vendor package to be vendored here." >&2
  mkdir -p "$dest"
  cat > "$dest/README.md" << 'EOF'
Place bundled @trezor/connect iframe/popup assets here.
Init uses connectSrc "./trezor/" and transports: ["WebUsbTransport"] only.
Do not point connectSrc at https://connect.trezor.io.
EOF
  exit 0
fi
# Common locations across connect versions
for dir in build/iframe build/popup lib/webusb iframe popup; do
  if [[ -d "$pkg/$dir" ]]; then
    cp -R "$pkg/$dir/." "$dest/"
  fi
done
echo "Vendored Trezor connect assets into public/trezor"
