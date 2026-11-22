#!/bin/sh
# Renders teaser.html, versions A and B, into the three files Rozz needs, with headless Chrome.
#   sh marketing/burnside-2027/render.sh
# Output lands in marketing/burnside-2027/out/. Needs a network connection
# (the fonts come from Google Fonts).
set -e
cd "$(dirname "$0")"
CHROME="${CHROME:-$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/* 2>/dev/null | head -1)}"
[ -x "$CHROME" ] || CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE="file://$PWD/teaser.html"
mkdir -p out
# --allow-file-access-from-files: the icons are CSS masks, which Chrome refuses
# to read from file:// without it. Device scale 2 gives a crisp 2x image.
FLAGS="--headless=new --hide-scrollbars --allow-file-access-from-files --virtual-time-budget=6000"
for V in a b; do
  "$CHROME" $FLAGS --force-device-scale-factor=2 --window-size=1080,1350 --screenshot="$PWD/out/burnside-teaser-$V-feed-4x5.png" "$PAGE#feed,$V"
  "$CHROME" $FLAGS --force-device-scale-factor=2 --window-size=1080,1920 --screenshot="$PWD/out/burnside-teaser-$V-story-9x16.png" "$PAGE#story,$V"
  # A4: Chrome's print-to-PDF drops the gradient on the headline text, so the A4 is
  # a 300 dpi image (2480 x 3508) wrapped in an A4 PDF instead. Prints exactly as seen.
  "$CHROME" $FLAGS --force-device-scale-factor=2.2963 --window-size=1080,1527 --screenshot="$PWD/out/a4.png" "$PAGE#a4,$V"
  sips -s dpiWidth 300 -s dpiHeight 300 out/a4.png >/dev/null
  sips -s format pdf out/a4.png --out "out/burnside-teaser-$V-A4.pdf" >/dev/null
  rm out/a4.png
done
ls -la out
