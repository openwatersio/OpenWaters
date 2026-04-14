import type { CatalogSource, Theme } from "@/catalog/types";
import type { DepthUnit } from "@/hooks/usePreferredUnits";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/**
 * Filters that a source must match to be included in a generated style.
 * For each filter, sources with no value for that field always pass.
 * Sources with a value only pass when the value equals the filter.
 */
export type SourceFilters = {
  theme?: Theme;
  units?: DepthUnit;
};

/**
 * Filter catalog sources by theme and units preferences, with fallback.
 *
 * Fallback logic, applied independently per filter field:
 * - If any source matches the requested value, use that value.
 * - Otherwise fall back to the default (`day` for theme, `ft` for units).
 * - If no sources have the field at all, no filtering is applied for it.
 *
 * Sources that don't specify a field always pass that filter.
 */
export function filterSources(
  sources: CatalogSource[],
  filters: SourceFilters,
): CatalogSource[] {
  const effectiveTheme = resolveFilter<Theme>(sources, "theme", filters.theme, "day");
  const effectiveUnits = resolveFilter<DepthUnit>(sources, "units", filters.units, "ft");

  return sources.filter((source) => {
    if (effectiveTheme && source.theme && source.theme !== effectiveTheme) return false;
    if (effectiveUnits && source.units && source.units !== effectiveUnits) return false;
    return true;
  });
}

/**
 * Resolve which filter value is actually present in the sources.
 * Returns the requested value if any source has it, otherwise the default
 * if any source has that, otherwise undefined (meaning: don't filter).
 */
function resolveFilter<T extends string>(
  sources: CatalogSource[],
  field: "theme" | "units",
  requested: T | undefined,
  fallback: T,
): T | undefined {
  const values = new Set<string>();
  for (const source of sources) {
    const v = source[field];
    if (v) values.add(v);
  }
  if (values.size === 0) return undefined;
  if (requested && values.has(requested)) return requested;
  if (values.has(fallback)) return fallback;
  return undefined;
}

/**
 * Build a preview style from catalog source shapes.
 * Filters to sources that can stream (style, raster) and skips
 * mbtiles/pmtiles with remote URLs (not yet downloaded).
 *
 * Applies theme/units filtering so entries with variant sources
 * (e.g. one style per theme) render a single preview.
 *
 * Used by catalog listing pages for thumbnail previews.
 */
export function buildPreviewStyle(
  sources: CatalogSource[],
  filters: SourceFilters = {},
): StyleSpecification | string | null {
  // Apply theme/units filters before picking streamable sources
  const filtered = filterSources(sources, filters);

  // Filter to streamable sources
  const streamable = filtered.filter((s) => s.type === "style" || s.type === "raster");
  if (streamable.length === 0) return null;

  // Pick the first streamable style source if present — styles can't
  // be composed, so we just render whichever variant matched.
  const styleSource = streamable.find((s) => s.type === "style");
  if (styleSource && styleSource.type === "style" && styleSource.url) {
    return styleSource.url;
  }

  const spec: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
  };

  for (const [index, source] of streamable.entries()) {
    const sourceId = `preview-${source.id ?? index}`;
    if (source.type === "raster") {
      spec.sources[sourceId] = {
        type: "raster",
        ...(source.url && !source.tiles ? { url: source.url } : {}),
        ...(source.tiles ? { tiles: source.tiles } : {}),
        tileSize: source.tileSize ?? 256,
        ...(source.minzoom != null && { minzoom: source.minzoom }),
        ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
        ...(source.bounds && { bounds: source.bounds as [number, number, number, number] }),
        ...(source.attribution && { attribution: source.attribution }),
      };
      (spec.layers as unknown[]).push({
        id: `layer-${sourceId}`,
        type: "raster",
        source: sourceId,
      });
    }
  }

  return spec;
}

/**
 * Compute a bounding box that covers all sources with bounds.
 * Returns undefined if no sources have bounds.
 */
export function computeBounds(
  sources: Array<{ bounds?: string | number[] | null }>,
): [number, number, number, number] | undefined {
  let west = 180, south = 90, east = -180, north = -90;
  let found = false;

  for (const source of sources) {
    if (!source.bounds) continue;
    const b = typeof source.bounds === "string"
      ? (JSON.parse(source.bounds) as number[])
      : source.bounds;
    if (b.length < 4) continue;
    found = true;
    west = Math.min(west, b[0]);
    south = Math.min(south, b[1]);
    east = Math.max(east, b[2]);
    north = Math.max(north, b[3]);
  }

  return found ? [west, south, east, north] : undefined;
}
