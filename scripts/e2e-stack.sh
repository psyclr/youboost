#!/usr/bin/env bash
#
# Bring up the isolated e2e stack (docker-compose.test.yml), run the real-backend
# Playwright specs against it, then tear it down. Fully self-contained — owns its
# Postgres/Redis/backend/frontend, touches no prod/dev data.
#
# Usage:
#   scripts/e2e-stack.sh                      # runs the real-backend specs
#   scripts/e2e-stack.sh landing-cart-checkout
#   KEEP_STACK=1 scripts/e2e-stack.sh         # leave the stack up after (debug)
#
set -euo pipefail

export PATH=/opt/nodejs/bin:$PATH
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT=youboost-e2e
# Absolute -f path: the trap runs cleanup after we cd into frontend/, so a
# relative compose path would not resolve and teardown would silently fail.
COMPOSE=(docker compose -p "$PROJECT" -f "$ROOT/docker-compose.test.yml")
BASE_URL=http://localhost:3301

cleanup() {
  if [ "${KEEP_STACK:-0}" != "1" ]; then
    echo "--- tearing down e2e stack ---"
    "${COMPOSE[@]}" down -v >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "--- building + starting isolated e2e stack ---"
"${COMPOSE[@]}" up -d --build

echo "--- waiting for test frontend on $BASE_URL ---"
ok=0
for _ in $(seq 1 120); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/" 2>/dev/null)" = "200" ]; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != "1" ]; then
  echo "ERROR: test frontend did not come up" >&2
  "${COMPOSE[@]}" logs --tail 40 backend frontend >&2 || true
  exit 1
fi

echo "--- running real-backend Playwright specs ---"
cd frontend
if [ "$#" -gt 0 ]; then specs=("$@"); else specs=(landing-cart-checkout orders-create); fi
E2E_REAL_BACKEND=1 E2E_BASE_URL="$BASE_URL" npx playwright test "${specs[@]}"
