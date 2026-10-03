#!/usr/bin/env bash
set -Eeuo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${1:-${DAYMARK_PROD_ENV:-${HOME}/.config/daymark/production.env}}"
compose=(docker compose --env-file "$env_file" -f "$repo_root/deploy/compose.prod.yml")
for ((attempt=1; attempt<=60; attempt++)); do
  if "${compose[@]}" exec -T backend python -c \
    "import json,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)); assert d.get('status')=='ok' and d.get('db')=='healthy'" >/dev/null 2>&1 \
    && curl --max-time 5 -fsS http://127.0.0.1/ >/dev/null \
    && [[ "$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' http://127.0.0.1/api/v1/auth/me)" == "401" ]] \
    && "${compose[@]}" exec -T minio curl --max-time 5 -fsS http://127.0.0.1:9000/minio/health/ready >/dev/null 2>&1; then
    echo "Backend database, frontend, and MinIO checks passed."
    exit 0
  fi
  echo "Waiting for services ($attempt/60)..."
  sleep 2
done
echo "Deployment health checks timed out." >&2
exit 1
