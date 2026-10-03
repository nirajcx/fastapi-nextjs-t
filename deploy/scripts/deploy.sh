#!/usr/bin/env bash
set -Eeuo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${DAYMARK_PROD_ENV:-${HOME}/.config/daymark/production.env}"
if [[ ! -f "$env_file" ]]; then
  echo "Missing production configuration: $env_file" >&2
  echo "Copy deploy/.env.example there and configure it before deploying." >&2
  exit 1
fi
compose=(docker compose --env-file "$env_file" -f "$repo_root/deploy/compose.prod.yml")
show_failure() {
  status=$?
  trap - ERR
  "${compose[@]}" ps || true
  "${compose[@]}" logs --tail 100 backend frontend minio || true
  exit "$status"
}
trap show_failure ERR
"${compose[@]}" config --quiet
"${compose[@]}" build
"${compose[@]}" up -d --no-build --remove-orphans
bash "$repo_root/deploy/scripts/healthcheck.sh" "$env_file"
