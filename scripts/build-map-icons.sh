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
# Higher raster resolution preserves thin strokes and fine detail in the SDF.
# Previous: 64 base → 128px. Now: 128 base → 256px.
ICON_SIZE=$((48 * SCALE))
# Reduced spread (was 6) so thin features stay above MapLibre's alpha=128
# threshold. A 3px stroke at the old settings had center alpha ≈ 143 (barely
# visible); at these settings it's ≈ 180.
PADDING=$((3 * SCALE))
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
const zlib = require('zlib');
const path = require('path');

const tmpDir = '$TMP_DIR';
const outDir = '$PNG_DIR';
const SIZE = $CANVAS_SIZE;
const SPREAD = 1 * $SCALE;

function readPNG(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf[0] !== 137 || buf[1] !== 80) throw new Error('Not a PNG: ' + filePath);

  let offset = 8;
  const ihdrLen = buf.readUInt32BE(offset); offset += 4;
  const ihdrType = buf.toString('ascii', offset, offset + 4); offset += 4;
  if (ihdrType !== 'IHDR') throw new Error('Expected IHDR');
  const width = buf.readUInt32BE(offset); offset += 4;
  const height = buf.readUInt32BE(offset); offset += 4;
  const bitDepth = buf[offset++];
  const colorType = buf[offset++];
  offset += 3 + 4;

  const idatChunks = [];
  while (offset < buf.length) {
    const chunkLen = buf.readUInt32BE(offset); offset += 4;
    const chunkType = buf.toString('ascii', offset, offset + 4); offset += 4;
    if (chunkType === 'IDAT') {
      idatChunks.push(buf.subarray(offset, offset + chunkLen));
    }
    offset += chunkLen + 4;
    if (chunkType === 'IEND') break;
  }

  const compressed = Buffer.concat(idatChunks);
  const raw = zlib.inflateSync(compressed);

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  const rowBytes = width * bpp;
  const pixels = Buffer.alloc(width * height * bpp);

  for (let y = 0; y < height; y++) {
    const filterByte = raw[y * (rowBytes + 1)];
    const rowStart = y * (rowBytes + 1) + 1;
    const outStart = y * rowBytes;

    for (let x = 0; x < rowBytes; x++) {
      let val = raw[rowStart + x];
      if (filterByte === 1 && x >= bpp) {
        val = (val + pixels[outStart + x - bpp]) & 0xFF;
      } else if (filterByte === 2 && y > 0) {
        val = (val + pixels[outStart - rowBytes + x]) & 0xFF;
      } else if (filterByte === 3) {
        const a = x >= bpp ? pixels[outStart + x - bpp] : 0;
        const b = y > 0 ? pixels[outStart - rowBytes + x] : 0;
        val = (val + ((a + b) >> 1)) & 0xFF;
      } else if (filterByte === 4) {
        const a = x >= bpp ? pixels[outStart + x - bpp] : 0;
        const b = y > 0 ? pixels[outStart - rowBytes + x] : 0;
        const c = (x >= bpp && y > 0) ? pixels[outStart - rowBytes + x - bpp] : 0;
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xFF;
      }
      pixels[outStart + x] = val;
    }
  }

  // Extract alpha channel
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    if (bpp === 4) {
      alpha[i] = pixels[i * 4 + 3];
    } else if (bpp >= 3) {
      // No alpha — use luminance (any non-black pixel is inside)
      alpha[i] = Math.max(pixels[i * bpp], pixels[i * bpp + 1], pixels[i * bpp + 2]);
    } else {
      alpha[i] = pixels[i * bpp];
    }
  }

  return { width, height, alpha };
}

function createPNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function createChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([typeBytes, data]);
    const crc32 = zlib.crc32(body);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32 >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    rawData[y * rowSize] = 0;
    rgba.copy(rawData, y * rowSize + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', zlib.deflateSync(rawData)),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildSDF(alpha, width, height, spread) {
  const sdf = new Float32Array(width * height);
  const r = spread + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = alpha[y * width + x] > 127;
      let minDist = r + 1;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighborInside = alpha[ny * width + nx] > 127;
          if (neighborInside !== inside) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
          }
        }
      }

      sdf[y * width + x] = inside ? minDist : -minDist;
    }
  }

  return sdf;
}

const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.png'));

for (const file of files) {
  const name = path.basename(file, '.png');
  const { width, height, alpha } = readPNG(path.join(tmpDir, file));

  const sdf = buildSDF(alpha, width, height, SPREAD);

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const normalized = Math.max(0, Math.min(1, sdf[i] / SPREAD * 0.5 + 0.5));
    const a = Math.round(normalized * 255);
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = a;
  }

  const png = createPNG(width, height, rgba);
  const suffix = $SCALE > 1 ? '@${SCALE}x' : '';
  fs.writeFileSync(path.join(outDir, name + suffix + '.png'), png);
  console.log('  ' + name + suffix + '.png (' + png.length + ' bytes, ' + width + 'x' + height + ')');
}

console.log('Done!');
"

echo ""
echo "Output in assets/map/png/"
ls -la "$PNG_DIR"/*.png | grep -v aton  # atons are pre-built, not from SVG
