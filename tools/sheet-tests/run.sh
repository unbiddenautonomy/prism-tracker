#!/bin/bash
# Tests the Google Sheet script (google-sheet/Code.gs) using a fake spreadsheet.
# Uses Node.js if it's installed, otherwise the JavaScript engine built into macOS.
# Nothing touches Google.
#   bash tools/sheet-tests/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cat "$HERE/fakes.js" "$ROOT/google-sheet/Code.gs" "$HERE/tests.js" > "$TMP/run.js"
if command -v node >/dev/null 2>&1; then RUN=(node); else RUN=(/usr/bin/osascript -l JavaScript); fi
"${RUN[@]}" "$TMP/run.js" 2>&1 | grep -E "^(PASS|FAIL)|PASSED|FAILED" | tee "$TMP/out.txt" | grep -v "^PASS" || true
echo "$(grep -c '^PASS' "$TMP/out.txt") checks passed"
! grep -q "^FAIL" "$TMP/out.txt"
