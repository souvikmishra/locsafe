#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
if [[ ! -d dist ]]; then
  echo "dist/ missing; run pnpm build first" >&2
  exit 1
fi
ipfs add --cid-version=1 --chunker=size-262144 --raw-leaves -Q -r dist
