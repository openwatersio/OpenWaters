import config from "@/assets/map/icon-config.json";

// Natural CSS-pixel footprint of an icon at icon-size=1, computed from the
// build-time canvas size (icon shape + padding on each side). Padding is
// included because MapLibre's icon-size scales the full raster including
// padding, not just the shape.
const NATURAL_LAYOUT_PX = config.size + 2 * config.padding;

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
