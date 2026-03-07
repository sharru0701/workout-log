#!/usr/bin/env bash
set -euo pipefail

KEEP_IMAGES="${KEEP_IMAGES:-5}"
MIN_FREE_MB="${MIN_FREE_MB:-4096}"
MAX_ROOT_USAGE_PERCENT="${MAX_ROOT_USAGE_PERCENT:-90}"
AGGRESSIVE_PRUNE="${AGGRESSIVE_PRUNE:-0}"

if ! [[ "${KEEP_IMAGES}" =~ ^[0-9]+$ ]] || [[ "${KEEP_IMAGES}" -lt 1 ]]; then
  echo "[headroom] KEEP_IMAGES must be a positive integer" >&2
  exit 1
fi

if ! [[ "${MIN_FREE_MB}" =~ ^[0-9]+$ ]] || [[ "${MIN_FREE_MB}" -lt 1 ]]; then
  echo "[headroom] MIN_FREE_MB must be a positive integer" >&2
  exit 1
fi

if ! [[ "${MAX_ROOT_USAGE_PERCENT}" =~ ^[0-9]+$ ]] || [[ "${MAX_ROOT_USAGE_PERCENT}" -lt 1 ]] || [[ "${MAX_ROOT_USAGE_PERCENT}" -gt 99 ]]; then
  echo "[headroom] MAX_ROOT_USAGE_PERCENT must be between 1 and 99" >&2
  exit 1
fi

report_disk() {
  local target
  local targets=("/")

  for target in /var/lib/docker /var/lib/containerd; do
    if [[ -e "${target}" ]]; then
      targets+=("${target}")
    fi
  done

  echo "[headroom] filesystem usage"
  df -h "${targets[@]}" || true
  echo "[headroom] docker disk usage"
  docker system df || true
}

root_free_mb() {
  df -Pm / | awk 'NR==2 { print $4 }'
}

root_used_percent() {
  df -P / | awk 'NR==2 { gsub(/%/, "", $5); print $5 }'
}

prune_safe() {
  echo "[headroom] running safe docker cleanup"
  ./scripts/prune_old_images.sh || true
  docker container prune -f || true
  docker builder prune -af || true
  docker image prune -f || true
}

prune_aggressive() {
  echo "[headroom] running aggressive docker cleanup"
  docker image prune -af || true
  docker system prune -af --volumes || true
}

assert_headroom() {
  local free_mb
  local used_percent
  free_mb="$(root_free_mb)"
  used_percent="$(root_used_percent)"

  echo "[headroom] root free space: ${free_mb}MB"
  echo "[headroom] root usage: ${used_percent}%"

  if (( free_mb < MIN_FREE_MB )); then
    echo "[headroom] insufficient free space: need at least ${MIN_FREE_MB}MB on / before pulling images" >&2
    return 1
  fi

  if (( used_percent > MAX_ROOT_USAGE_PERCENT )); then
    echo "[headroom] root usage too high: need <= ${MAX_ROOT_USAGE_PERCENT}% before pulling images" >&2
    return 1
  fi

  return 0
}

report_disk
prune_safe

if [[ "${AGGRESSIVE_PRUNE}" == "1" ]] || ! assert_headroom; then
  prune_aggressive
fi

report_disk
assert_headroom
