#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ "$(uname -s)" != "Linux" ]]; then
  exit 0
fi

LIB_ROOT="$WEB_DIR/.local/pw-libs"
LIB_DIR="$LIB_ROOT/usr/lib/x86_64-linux-gnu"
mkdir -p "$LIB_ROOT"

required_libs=(
  "libnspr4.so"
  "libnss3.so"
  "libnssutil3.so"
  "libasound.so.2"
)

all_present=true
for lib in "${required_libs[@]}"; do
  if [[ ! -f "$LIB_DIR/$lib" ]]; then
    all_present=false
    break
  fi
done

if [[ "$all_present" == "true" ]]; then
  echo "$LIB_DIR"
  exit 0
fi

if ! command -v apt >/dev/null 2>&1 || ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "[ensure-playwright-linux-libs] apt/dpkg-deb not available; cannot install local browser libs." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

(
  cd "$tmp_dir"
  apt download libnspr4 libnss3 >/dev/null
  if ! apt download libasound2t64 >/dev/null 2>&1; then
    apt download libasound2 >/dev/null
  fi

  for deb in ./*.deb; do
    dpkg-deb -x "$deb" "$LIB_ROOT"
  done
)

missing=()
for lib in "${required_libs[@]}"; do
  if [[ ! -f "$LIB_DIR/$lib" ]]; then
    missing+=("$lib")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "[ensure-playwright-linux-libs] missing required libs after extraction: ${missing[*]}" >&2
  exit 1
fi

echo "$LIB_DIR"
