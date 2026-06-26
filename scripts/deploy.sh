#!/usr/bin/env bash
#
# CI/CD pipeline. Run by the self-hosted GitHub runner on push to main, or by
# hand. Verifies everything, then rebuilds + restarts the prod containers.
#
# Operates on the canonical deployed tree (this repo at $ROOT) so the prod
# compose project and the gitignored .env (secrets) stay intact — `git reset`
# never touches ignored files.
#
set -euo pipefail
export PATH=/opt/nodejs/bin:$PATH
export NODE_OPTIONS=--experimental-require-module

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DB='postgresql://youboost:youboost_dev_password@localhost:5432/youboost_test'
cd "$ROOT"

step() { echo; echo "===== $* ====="; }

step "sync to origin/main"
git fetch --quiet origin main
git reset --hard origin/main
git rev-parse --short HEAD

step "install all workspaces"
# Single workspace-aware install (root + frontend + blog-engine).
npm install --no-audit --no-fund --silent

step "backend: lint + types + tests"
npx tsc --noEmit
npx eslint src --quiet
TEST_DATABASE_URL="$TEST_DB" npx prisma migrate deploy >/dev/null
TEST_DATABASE_URL="$TEST_DB" npx jest --silent

step "frontend: lint + types + tests"
npm run --workspace frontend typecheck
npm run --workspace frontend lint
npm run --workspace frontend test -- --silent

step "blog-engine: generate client + lint + types"
npm run --workspace blog-engine db:generate >/dev/null
npm run --workspace blog-engine typecheck
npm run --workspace blog-engine lint

step "e2e: isolated docker stack"
bash scripts/e2e-stack.sh

step "deploy: apply DB migrations to prod"
# Additive migrations only run here, before the new backend starts, so the
# running (old) backend keeps working and the new one finds its columns. The
# migrate image must be rebuilt to include migrations added since last deploy.
docker compose build migrate
docker compose run --rm migrate

step "deploy: rebuild + restart prod"
docker compose build --no-cache backend frontend
docker compose up -d backend frontend

step "wait for prod health"
for _ in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' https://www.youboost.store/api/health 2>/dev/null)" = "200" ]; then
    echo "prod healthy — deployed $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done
echo "ERROR: prod did not become healthy after deploy" >&2
exit 1
