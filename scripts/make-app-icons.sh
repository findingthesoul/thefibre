#!/usr/bin/env bash
# Generate an app's four PWA icons from one square source PNG.
#
#   ./scripts/make-app-icons.sh <app> <source.png>
#   ./scripts/make-app-icons.sh my "~/…/branding/icons/PNG 3/mythread.png"
#
# Born 2026-09-23, when the portal got an icon and the sizes had to come from
# somewhere. apps/web and apps/connections already carried exactly these four
# files at exactly these dimensions; this is that shape made repeatable rather
# than a third person deriving it from a manifest by eye.
#
# Uses `sips`, which ships with macOS. Nothing to install.
set -euo pipefail

app="${1:?usage: make-app-icons.sh <app> <source.png>}"
src="${2:?usage: make-app-icons.sh <app> <source.png>}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/apps/$app/public"

[ -d "$root/apps/$app" ] || { echo "no such app: apps/$app" >&2; exit 1; }
[ -f "$src" ] || { echo "no such file: $src" >&2; exit 1; }
mkdir -p "$out"

w=$(sips -g pixelWidth "$src" | awk '/pixelWidth/{print $2}')
h=$(sips -g pixelHeight "$src" | awk '/pixelHeight/{print $2}')
[ "$w" = "$h" ] || echo "warning: source is ${w}x${h}, not square — it will be squashed" >&2
[ "$w" -ge 512 ] || echo "warning: source is ${w}px; 512 or more avoids a soft icon" >&2

for size in 192 512; do
  sips -s format png -z "$size" "$size" "$src" --out "$out/icon-$size.png" >/dev/null
done
sips -s format png -z 180 180 "$src" --out "$out/apple-touch-icon.png" >/dev/null

# The maskable one is the only interesting size.
#
# Android may crop a maskable icon to a CIRCLE, so two things have to be true:
# the artwork must sit inside the safe area (hence 80%), and the ground must
# reach the edges (hence the pad). Padding with the default WHITE puts a white
# ring inside the circle around a full-bleed tile — which is what the first run
# of this script produced, and why the colour is read rather than assumed.
#
# The ground is the SOURCE'S OWN centre pixel. These icons are full-bleed
# colour with rounded transparent corners, so the centre is the background.
# Override with ICON_PAD=RRGGBB for artwork whose centre is not its ground.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

pad="${ICON_PAD:-}"
if [ -z "$pad" ]; then
  sips -c 1 1 "$src" --out "$tmp/px.png" >/dev/null
  sips -s format bmp "$tmp/px.png" --out "$tmp/px.bmp" >/dev/null
  pad=$(python3 - "$tmp/px.bmp" <<'PY'
import sys
d = open(sys.argv[1], 'rb').read()
o = int.from_bytes(d[10:14], 'little')          # pixel-array offset
print('%02x%02x%02x' % (d[o + 2], d[o + 1], d[o]))  # BMP stores BGR
PY
)
fi

sips -s format png -z 410 410 "$src" --out "$tmp/inner.png" >/dev/null
sips -s format png -p 512 512 --padColor "$pad" "$tmp/inner.png" \
  --out "$out/icon-maskable-512.png" >/dev/null

echo "wrote into apps/$app/public (maskable ground #$pad):"
for f in icon-192.png icon-512.png apple-touch-icon.png icon-maskable-512.png; do
  printf '  %-24s %s\n' "$f" "$(sips -g pixelWidth -g pixelHeight "$out/$f" | awk '/pixel/{printf "%s ", $2}')"
done
