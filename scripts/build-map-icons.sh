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

SCALE=3
# Build params shared with the rendering side via icon-config.json so layer
# `icon-size` values stay in sync (via src/map/iconSize.ts) when these change.
#   - icon:   rendered-icon size in source pixels (the SVG is scaled to this
#             when rasterized; it need not equal the SVG's viewBox — the shapes
#             use a 48-unit viewBox but render down to `icon` source texels)
#   - canvas: total canvas size in source pixels (icon is centered, with
#             transparent margin around it)
# `icon` (the shape's source-texel size) sets MapLibre's halo headroom: a
# smaller ICON_PX means a larger icon-size multiplier is needed to render the
# shape at any given CSS size, and the shader's `(halo_width + halo_blur) <
# 6 × icon_size` constraint scales with that multiplier — so a smaller icon
# lifts the absolute halo+blur budget proportionally. With icon=24 the budget
# is ~5 × cssPx / 24 ≈ 4 CSS px (width + blur combined) on the smallest vessel
# (~19 CSS px), enough for a soft blurred drop shadow. SCALE keeps the source
# raster crisp (icon × SCALE = 72px here) independent of this ratio.
# `canvas` just adds transparent margin to hold bitmap-sdf's outside gradient
# (~6 source texels past the shape edge with radius=8, cutoff=0.25 defaults)
# plus the blur spread; it does NOT affect the halo budget.
CONFIG="$PROJECT_DIR/assets/map/icon-config.json"
ICON_BASE=$(node -p "require('$CONFIG').icon")
CANVAS_BASE=$(node -p "require('$CONFIG').canvas")
ICON_SIZE=$((ICON_BASE * SCALE))
CANVAS_SIZE=$((CANVAS_BASE * SCALE))
ICON_OFFSET=$(((CANVAS_SIZE - ICON_SIZE) / 2))

SVG_COUNT=$(ls "$SVG_DIR"/*.svg 2>/dev/null | wc -l | tr -d ' ')
if [ "$SVG_COUNT" = "0" ]; then
  echo "No SVGs found in $SVG_DIR"
  exit 0
fi

# Drop any prior density variants of the generated icons. Changing SCALE
# switches the @Nx suffix; without this, stale variants (built at a different
# icon/canvas ratio) linger and Metro serves them on matching-density devices.
# Hand-made PNGs without a source SVG (e.g. aton-buoy) are never touched.
for svg in "$SVG_DIR"/*.svg; do
  name=$(basename "$svg" .svg)
  rm -f "$PNG_DIR/${name}.png" "$PNG_DIR/${name}"@*x.png
done

echo "Rasterizing $SVG_COUNT SVGs at ${SCALE}x (${ICON_SIZE}px icon centered in ${CANVAS_SIZE}px canvas)..."
for svg in "$SVG_DIR"/*.svg; do
  name=$(basename "$svg" .svg)
  rsvg-convert -w $ICON_SIZE -h $ICON_SIZE \
    --page-width $CANVAS_SIZE --page-height $CANVAS_SIZE \
    --left $ICON_OFFSET --top $ICON_OFFSET \
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
