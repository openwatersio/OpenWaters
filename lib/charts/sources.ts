import type { StyleSpecification } from "@maplibre/maplibre-react-native";

/**
 * Build a preview style from catalog source shapes.
 * Filters to sources that can stream (style, raster) and skips
 * mbtiles/pmtiles with remote URLs (not yet downloaded).
 *
 * Used by catalog listing pages for thumbnail previews.
 */
export function buildPreviewStyle(
  sources: Array<{
    id?: string;
    type: string;
    url?: string;
    tiles?: string[];
    tileSize?: number;
    bounds?: number[];
    minzoom?: number;
    maxzoom?: number;
    attribution?: string;
  }>,
): StyleSpecification | string | null {
  // Filter to streamable sources
  const streamable = sources.filter((s) => s.type === "style" || s.type === "raster");
  if (streamable.length === 0) return null;

  if (streamable.length === 1 && streamable[0].type === "style" && streamable[0].url) {
    return streamable[0].url;
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
