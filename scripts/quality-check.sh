#!/bin/bash
set -euo pipefail

echo "=== Quality Check ==="

echo "-- npm audit (backend) --"
npm audit --audit-level=high || true

echo "-- npm audit (frontend) --"
cd frontend && npm audit --audit-level=high || true
cd ..

echo "-- Circular dependencies --"
npx madge --circular --extensions ts src/

echo "-- Unused code (knip) --"
npx knip

echo "-- TypeScript --"
npm run typecheck

echo "=== All checks passed ==="
