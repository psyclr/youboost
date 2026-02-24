#!/bin/bash
set -euo pipefail
PROJECT_ROOT="/Users/alexander.abramovich/myprojects/smm"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null)

[ -z "$FILE_PATH" ] && exit 0
case "$FILE_PATH" in *.ts|*.tsx) ;; *) exit 0 ;; esac
case "$FILE_PATH" in */node_modules/*|*/dist/*|*/coverage/*|*/.next/*|*/src/generated/*) exit 0 ;; esac

if [[ "$FILE_PATH" == "$PROJECT_ROOT/frontend/"* ]]; then
    cd "$PROJECT_ROOT/frontend"
else
    cd "$PROJECT_ROOT"
fi

ESLINT_OUTPUT=$(npx eslint "$FILE_PATH" --no-fix --format stylish 2>&1) || true
if echo "$ESLINT_OUTPUT" | grep -qE "error|warning"; then
    echo "--- ESLint issues in $(basename "$FILE_PATH") ---"
    echo "$ESLINT_OUTPUT"
    echo "--- Fix these before proceeding ---"
fi
