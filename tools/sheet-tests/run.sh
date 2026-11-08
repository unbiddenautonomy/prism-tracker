#!/bin/bash
# Tests the Google Sheet script (google-sheet/Code.gs) on this Mac, using a fake
# spreadsheet and the JavaScript engine built into macOS. Nothing touches Google.
#   bash tools/sheet-tests/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cat "$HERE/fakes.js" "$ROOT/google-sheet/Code.gs" "$HERE/tests.js" > "$TMP/run.js"
/usr/bin/osascript -l JavaScript "$TMP/run.js" 2>&1 | grep -E "^(PASS|FAIL)|PASSED|FAILED" | tee "$TMP/out.txt" | grep -v "^PASS" || true
echo "$(grep -c '^PASS' "$TMP/out.txt") checks passed"
! grep -q "^FAIL" "$TMP/out.txt"
