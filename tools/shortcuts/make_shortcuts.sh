#!/bin/bash
# Makes two Desktop shortcuts (small Mac apps) that open Prism in Google Chrome:
#   PrismAPP   – the worker app, in a phone-sized window
#   PrismAdmin – straight to the Reports dashboard
# Each one starts the local Prism server first if it isn't running.
#
#   bash tools/shortcuts/make_shortcuts.sh
#
# Run it again if the PrismApp folder is moved.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$HERE/../.." && pwd)"
DEST="${DEST:-$HOME/Desktop}"
BUILD="$HERE/build"
mkdir -p "$BUILD"

# 1. Icons (1024px PNG -> .icns)
if [ ! -f "$BUILD/app.png" ] || [ ! -f "$BUILD/admin.png" ] || [ "$HERE/draw_icons.swift" -nt "$BUILD/app.png" ]; then
  echo "Drawing icons…"
  /usr/bin/swift "$HERE/draw_icons.swift" "$BUILD/app.png" "$BUILD/admin.png"
fi

make_icns() { # $1 = source png, $2 = output .icns
  local set="$BUILD/tmp.iconset"
  rm -rf "$set" && mkdir -p "$set"
  for s in 16 32 128 256 512; do
    /usr/bin/sips -z $s $s "$1" --out "$set/icon_${s}x${s}.png" >/dev/null
    /usr/bin/sips -z $((s * 2)) $((s * 2)) "$1" --out "$set/icon_${s}x${s}@2x.png" >/dev/null
  done
  /usr/bin/iconutil -c icns "$set" -o "$2"
  rm -rf "$set"
}
make_icns "$BUILD/app.png" "$BUILD/PrismAPP.icns"
make_icns "$BUILD/admin.png" "$BUILD/PrismAdmin.icns"

# 2. The little apps
make_app() { # $1 = name, $2 = bundle id, $3 = page after the address, $4 = window size
  local name="$1" app="$DEST/$1.app"
  rm -rf "$app"
  mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
  cp "$BUILD/$name.icns" "$app/Contents/Resources/AppIcon.icns"

  cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$name</string>
  <key>CFBundleDisplayName</key><string>$name</string>
  <key>CFBundleIdentifier</key><string>$2</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>$name</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSUIElement</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST

  cat > "$app/Contents/MacOS/$name" <<SCRIPT
#!/bin/bash
# $name – starts the Prism server if needed, then opens it in Google Chrome.
PROJECT="$PROJECT"
PORT=8080
URL="http://localhost:\$PORT/$3"
NAME="$name"
LOG="\$HOME/Library/Logs/PrismApp-server.log"

running() { /usr/bin/curl -sf --max-time 1 "http://127.0.0.1:\$PORT/mock-sheet" 2>/dev/null | /usr/bin/grep -q Prism; }
fail() {
  /usr/bin/osascript -e "display alert \"\$NAME\" message \"\$1\" as critical" >/dev/null 2>&1
  exit 1
}

if ! running; then
  if [ ! -r "\$PROJECT/dev_server.py" ]; then
    fail "Can't open the Prism folder (\$PROJECT). If macOS asked about the Documents folder, allow it in System Settings > Privacy & Security > Files and Folders. If the folder was moved, run tools/shortcuts/make_shortcuts.sh again."
  fi
  cd "\$PROJECT" || fail "Can't open the Prism folder."
  /usr/bin/nohup /usr/bin/python3 dev_server.py --port "\$PORT" >>"\$LOG" 2>&1 &
  disown
  for _ in \$(seq 1 60); do running && break; sleep 0.25; done
  running || fail "The Prism server didn't start. Something else may be using port \$PORT. Details: \$LOG"
fi

[ -n "\$PRISM_NO_BROWSER" ] && exit 0   # used when testing the shortcut
if [ -d "/Applications/Google Chrome.app" ]; then
  /usr/bin/open -na "Google Chrome" --args --app="\$URL" --window-size=$4
else
  /usr/bin/open "\$URL"
fi
SCRIPT
  chmod +x "$app/Contents/MacOS/$name"
  /usr/bin/codesign --force --sign - "$app" >/dev/null 2>&1 || true
  touch "$app"
  echo "Made $app"
}

make_app "PrismAPP" "com.prism.shortcut.app" "" "430,900"
make_app "PrismAdmin" "com.prism.shortcut.admin" "admin" "780,980"
