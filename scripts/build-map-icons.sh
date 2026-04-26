#!/bin/bash
# Converts SVG map icons to SDF PNGs for MapLibre.
#
# Requires: rsvg-convert (librsvg), node
#
# Usage: ./scripts/build-map-icons.sh
#
# Input:  assets/map/svg/*.svg  (shapes on any background, any viewBox)
# Output: assets/map/png/*.png  (SDF PNGs with padding for distance field)
#
# SVGs should be sized to tightly fit their shape. The script adds padding
# around each icon for the SDF spread — no manual padding needed in the SVG.
# Non-SVG assets (e.g. hand-made aton PNGs) coexist in the png/ dir and
# are left untouched.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SVG_DIR="$PROJECT_DIR/assets/map/svg"
PNG_DIR="$PROJECT_DIR/assets/map/png"
TMP_DIR=$(mktemp -d)

trap "rm -rf $TMP_DIR" EXIT

mkdir -p "$PNG_DIR"

SCALE=2
# Build params shared with the rendering side via icon-config.json so layer
# `icon-size` values stay in sync (via src/map/iconSize.ts) when these change.
CONFIG="$PROJECT_DIR/assets/map/icon-config.json"
ICON_BASE=$(node -p "require('$CONFIG').size")
PAD_BASE=$(node -p "require('$CONFIG').padding")
ICON_SIZE=$((ICON_BASE * SCALE))
# Padding must hold the SDF outside gradient. bitmap-sdf with the MapLibre
# defaults (radius=8, cutoff=0.25) puts useful gradient out to 6 texels past
# the shape edge; padding ≥ that prevents the halo from clipping at the
# canvas border (which renders as a square).
PADDING=$((PAD_BASE * SCALE))
CANVAS_SIZE=$((ICON_SIZE + 2 * PADDING))

SVG_COUNT=$(ls "$SVG_DIR"/*.svg 2>/dev/null | wc -l | tr -d ' ')
if [ "$SVG_COUNT" = "0" ]; then
  echo "No SVGs found in $SVG_DIR"
  exit 0
fi

echo "Rasterizing $SVG_COUNT SVGs at ${SCALE}x (${ICON_SIZE}px icon + ${PADDING}px padding = ${CANVAS_SIZE}px canvas)..."
for svg in "$SVG_DIR"/*.svg; do
  name=$(basename "$svg" .svg)
  rsvg-convert -w $ICON_SIZE -h $ICON_SIZE \
    --page-width $CANVAS_SIZE --page-height $CANVAS_SIZE \
    --left $PADDING --top $PADDING \
    -b none \
    -o "$TMP_DIR/${name}.png" "$svg"
  echo "  $name.svg → temp PNG (${CANVAS_SIZE}x${CANVAS_SIZE})"
done

echo "Generating SDF PNGs..."
node -e "
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
// bitmap-sdf does feature-detection via 'window'; in Node we point window
// at the global so its instanceof checks find Uint8Array/Float32Array.
globalThis.window = globalThis;
const calcSDF = require('bitmap-sdf');

const tmpDir = '$TMP_DIR';
const outDir = '$PNG_DIR';
const SIZE = $CANVAS_SIZE;

const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png'));

for (const file of files) {
  const name = path.basename(file, '.png');
  const src = PNG.sync.read(fs.readFileSync(path.join(tmpDir, file)));
  const { width, height, data } = src; // RGBA8 buffer
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) alpha[i] = data[i * 4 + 3];

  // bitmap-sdf returns a Float32Array of normalized SDF values matching
  // MapLibre's symbol_sdf shader format: 0.75 at the shape edge, 1.0 deep
  // inside, 0.0 outside the 6-texel gradient (radius=8, cutoff=0.25).
  const sdf = calcSDF(alpha, { width, height, stride: 1, channel: 0 });

  const out = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    const a = Math.round(sdf[i] * 255);
    out.data[i * 4] = 255;
    out.data[i * 4 + 1] = 255;
    out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = a;
  }
  const buf = PNG.sync.write(out);
  const suffix = $SCALE > 1 ? '@${SCALE}x' : '';
  fs.writeFileSync(path.join(outDir, name + suffix + '.png'), buf);
  console.log('  ' + name + suffix + '.png (' + buf.length + ' bytes, ' + width + 'x' + height + ')');
}

console.log('Done!');
"

echo ""
echo "Output in assets/map/png/"
ls -la "$PNG_DIR"/*.png | grep -v aton  # atons are pre-built, not from SVG
