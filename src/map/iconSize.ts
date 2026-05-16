import config from "@/assets/map/icon-config.json";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";

// Natural CSS-pixel footprint of an icon at icon-size=1, computed from the
// build-time canvas size (icon shape + padding on each side). Padding is
// included because MapLibre's icon-size scales the full raster including
// padding, not just the shape.
const NATURAL_LAYOUT_PX = config.size + 2 * config.padding;

// Web Mercator CSS-pixels-to-meters at zoom 0 at the equator. Meters-per-pixel
// at any (zoom, latitude) is METERS_PER_PIXEL_Z0 * cos(latitude) / 2^zoom.
const METERS_PER_PIXEL_Z0 = 156543.03392;

/**
 * Returns the `icon-size` value needed to render an icon at the given display
 * size in CSS pixels. Use this in layer style props instead of hardcoded
 * ratios so changing the raster build parameters in
 * `assets/map/icon-config.json` doesn't require updating every layer.
 */
export function iconSize(cssPx: number): number {
  return cssPx / NATURAL_LAYOUT_PX;
}

/**
 * Returns the `icon-size` for a "halo" version of an icon — a larger sibling
 * layer rendered underneath the fill icon so its outline shows around the
 * edges. Use this to work around MapLibre's `icon-halo-width` constraint
 * (`halo_width < 6 × icon_size` for clean halos, per the symbol_sdf shader),
 * which makes thick halos on small icons render as canvas-bounded squares.
 */
export function iconSizeWithHalo(cssPx: number, haloWidth: number): number {
  return iconSize(cssPx + 2 * haloWidth);
}

/**
 * Per-feature scale factor consumed by `vesselScaleExpression()` to size a
 * vessel symbol so it spans its broadcast LOA on the chart. Returns
 * `length / cos(latitude)` (in meters); the cosine term folds in Web Mercator
 * latitude stretching so the rendered length is correct at any latitude.
 */
export function vesselMppFactor(lengthMeters: number, latitudeDegrees: number): number {
  const cosLat = Math.cos((latitudeDegrees * Math.PI) / 180);
  // Guard against cos→0 at the poles (won't occur for AIS but keeps the math defined).
  return lengthMeters / Math.max(cosLat, 1e-6);
}

/**
 * Returns the `icon-size` expression for a vessel rendered at true broadcast-
 * LOA scale, as if the chart were at the given Web-Mercator zoom level. Use
 * as a stop value in a top-level `["interpolate", ["exponential", 2], ["zoom"], …]`.
 *
 * MapLibre forbids `["zoom"]` anywhere but as the input to a top-level
 * `step`/`interpolate`, so the per-zoom factor `2^zoom` is baked in here
 * at compose time. Requires the feature to carry a positive numeric
 * `mppFactor` property (`LOA / cos(latitude)`; see `vesselMppFactor`).
 */
export function vesselScaleAt(zoom: number): ExpressionSpecification {
  const k = 1 / (METERS_PER_PIXEL_Z0 * NATURAL_LAYOUT_PX);
  return ["*", ["get", "mppFactor"], k * 2 ** zoom];
}

/**
 * Returns the `icon-size` expression for compressed length scaling — bigger
 * vessels render bigger but with diminishing returns. Use at low-zoom stops
 * to keep size differences visible without inflating large vessels to their
 * (gigantic) true on-chart length.
 *
 * Anchored so a vessel of `referenceLengthMeters` renders at exactly
 * `referenceCssPx`. Other vessels scale by `(mppFactor / reference)^power`
 * relative to the reference, so `power=1` is linear and `power=1/3` (cube
 * root) compresses a 30:1 length ratio to ~3:1 size ratio.
 *
 * Requires the feature to carry a positive numeric `mppFactor` property.
 */
export function vesselScaleDamped(
  referenceLengthMeters: number,
  referenceCssPx: number,
  power: number = 1 / 3,
): ExpressionSpecification {
  const multiplier = iconSize(referenceCssPx) / referenceLengthMeters ** power;
  return ["*", multiplier, ["^", ["get", "mppFactor"], power]];
}
