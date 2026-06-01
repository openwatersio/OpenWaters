import config from "@/assets/map/icon-config.json";
import type { ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";

// Rendered-icon size in source pixels at SCALE=1 (the build script renders
// the SVG to this many texels). The icon is centered in a larger source
// canvas (`config.canvas`); the surrounding transparent margin holds
// bitmap-sdf's gradient AND lifts MapLibre's `icon-halo-width` shader
// constraint. See `clampHalo` and the build script for the math — `ICON_PX`
// is the reference dimension for both `iconSize()` and the halo math.
const ICON_PX = config.icon;

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
  return cssPx / ICON_PX;
}

// MapLibre's symbol_sdf shader has a HARDCODED constraint:
//   halo_width < 6 × icon_size  (icon_size is the multiplier — what iconSize()
//                                returns, not CSS pixels)
// Source: https://github.com/maplibre/maplibre-native shaders/symbol_sdf.fragment.glsl
//   `halo_edge = (6.0 - halo_width / fontScale) / SDF_PX`  with `SDF_PX = 8.0`
// When violated, the shader samples outside the SDF gradient and the halo
// clips to the rectangular source canvas — producing dark square boxes.
// SDF_PX = 8 is a `#define`; you CANNOT change it by regenerating the source
// PNG with a wider gradient (that just breaks the shader's math).
//
// The icon-design fix (shape rendered at ICON_PX out of `config.size` source
// texels) lifts this limit proportionally — a smaller ICON_PX means a larger
// icon-size multiplier is required to render the shape at any given CSS px,
// which raises the absolute halo headroom. MAX_HALO_FACTOR uses 5 instead of
// the shader's hard 6 to leave margin for antialiasing and rounding.
const MAX_HALO_FACTOR = 5 / ICON_PX;

/**
 * Returns a safe `icon-halo-width` in CSS pixels for an icon rendered at
 * `iconCssPx`. Clamps `requestedHaloPx` to the maximum width that won't trip
 * MapLibre's SDF halo shader constraint and render as a dark square box.
 *
 * The shader constraint is on halo-width AND halo-blur *combined* — both are
 * divided by the icon-size multiplier inside the shader, so a blurred shadow
 * on a small icon overflows the SDF gradient just as a wide halo does. Pass
 * the layer's `icon-halo-blur` as `blurPx` so the width budget accounts for
 * it; the width is clamped to whatever headroom the blur leaves.
 *
 * Use at every interpolation stop where halo-width is specified, e.g.:
 * ```
 * "icon-halo-width": ["interpolate", ["linear"], ["zoom"],
 *   6,  clampHalo(8,  1),   // tiny icon → halo gets clamped down
 *   18, clampHalo(32, 1),   // bigger icon → halo stays at 1
 * ]
 * ```
 *
 * Rule of thumb (with current ICON_PX = 24): halo-width + blur can be up to
 * ~20% of the icon's CSS-pixel size. To draw a 1-px halo cleanly the icon
 * must be ≥ 5 CSS px; for a soft `width 1.5 + blur 2` shadow, ≥ ~18 CSS px.
 * Below those sizes the helper clamps the width down (possibly to 0) so the
 * halo still renders cleanly instead of smearing to a square.
 */
export function clampHalo(
  iconCssPx: number,
  requestedHaloPx: number,
  blurPx: number = 0,
): number {
  const budget = iconCssPx * MAX_HALO_FACTOR - blurPx;
  return Math.max(0, Math.min(requestedHaloPx, budget));
}

/**
 * Per-feature scale factor consumed by `vesselScaleAt()` and `vesselScaleDamped()`
 * to size a vessel symbol so it spans its broadcast LOA on the chart. Returns
 * `length / cos(latitude)` (in meters); the cosine term folds in Web Mercator
 * latitude stretching so the rendered length is correct at any latitude.
 */
export function vesselMppFactor(
  lengthMeters: number,
  latitudeDegrees: number,
): number {
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
  const k = 1 / (METERS_PER_PIXEL_Z0 * ICON_PX);
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

/**
 * Returns the worst-case minimum vessel size in CSS pixels: the smallest
 * vessel (minLengthMeters) rendered at the lowest zoom stop's reference size.
 * Use this to compute a safe `clampHalo()` floor that never smears even on the
 * tiniest vessels at the lowest visible zoom.
 *
 * Example: a 12 m boat with a 50 m reference rendering at 12 CSS px at z10
 * using power=0.25 gives `12 × (12/50)^0.25 ≈ 8.6 CSS px` as the floor.
 */
export function vesselMinCssPx(
  minLengthMeters: number,
  referenceLengthMeters: number,
  referenceCssPx: number,
  power: number = 1 / 3,
): number {
  return referenceCssPx * (minLengthMeters / referenceLengthMeters) ** power;
}
