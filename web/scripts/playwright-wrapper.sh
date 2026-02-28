#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" == "Linux" ]]; then
  lib_dir="$(bash "$SCRIPT_DIR/ensure-playwright-linux-libs.sh")"
  if [[ -n "$lib_dir" && -d "$lib_dir" ]]; then
    export LD_LIBRARY_PATH="$lib_dir${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  fi
fi

cd "$WEB_DIR"
exec playwright "$@"
