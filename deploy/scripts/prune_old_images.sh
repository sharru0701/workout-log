#!/usr/bin/env bash
set -euo pipefail

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/sharru0701/workout-log-web}"
KEEP_IMAGES="${KEEP_IMAGES:-10}"
WEB_CONTAINER="${WEB_CONTAINER:-workoutlog-web}"

if ! [[ "${KEEP_IMAGES}" =~ ^[0-9]+$ ]] || [[ "${KEEP_IMAGES}" -lt 1 ]]; then
  echo "[prune] KEEP_IMAGES must be a positive integer" >&2
  exit 1
fi

running_image_id=""
if docker inspect "${WEB_CONTAINER}" >/dev/null 2>&1; then
  running_image_id="$(docker inspect -f '{{.Image}}' "${WEB_CONTAINER}" 2>/dev/null || true)"
fi

mapfile -t image_ids < <(docker image ls "${IMAGE_REPO}" --no-trunc --format '{{.ID}}' | awk '!seen[$0]++')

if [[ "${#image_ids[@]}" -le "${KEEP_IMAGES}" ]]; then
  echo "[prune] nothing to prune (${#image_ids[@]} images, keep=${KEEP_IMAGES})"
  docker image prune -f >/dev/null || true
  exit 0
fi

remove_count=0
for idx in "${!image_ids[@]}"; do
  image_id="${image_ids[$idx]}"

  if [[ "${idx}" -lt "${KEEP_IMAGES}" ]]; then
    continue
  fi

  if [[ -n "${running_image_id}" && "${image_id}" == "${running_image_id}" ]]; then
    continue
  fi

  echo "[prune] removing ${image_id}"
  docker image rm "${image_id}" >/dev/null 2>&1 || true
  remove_count=$((remove_count + 1))
done

docker image prune -f >/dev/null || true

echo "[prune] removed ${remove_count} old image(s) for ${IMAGE_REPO}"
