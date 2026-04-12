import type { LngLatBounds } from "@maplibre/maplibre-react-native";

import type { SourceRow } from "@/lib/database";

/**
 * Returns true if a source can be rendered right now.
 *
 * - `style` and `raster` sources stream over the network — always renderable.
 * - `mbtiles` and `pmtiles` sources require a local file path. If the url
 *   is a remote URL (not yet downloaded), the source can't render.
 */
function canRender(source: SourceRow): boolean {
  if (source.type === "mbtiles" || source.type === "pmtiles") {
    // A local path starts with "/" — remote URLs start with "http"
    return source.url != null && source.url.startsWith("/");
  }
  return true;
}

/**
 * Given a chart's sources and the current viewport, returns the subset of
 * sources that should be rendered.
 *
 * Selection rules:
 * 1. Sources that can't render (e.g. MBTiles not yet downloaded) are excluded.
 * 2. Sources without bounds are always included (global coverage assumed).
 * 3. Sources with bounds are included only if they intersect the viewport.
 */
export function selectSources(
  sources: SourceRow[],
  viewport?: { bounds: LngLatBounds },
): SourceRow[] {
  const renderable = sources.filter(canRender);

  if (!viewport?.bounds) return renderable;

  return renderable.filter((source) => {
    // No bounds means global — always include
    if (!source.bounds) return true;

    // Check bounds intersection
    const sourceBounds = JSON.parse(source.bounds) as [number, number, number, number];
    return boundsIntersect(sourceBounds, viewport.bounds);
  });
}

/**
 * Test whether two bounding boxes intersect.
 * Both are [west, south, east, north].
 */
function boundsIntersect(
  a: [number, number, number, number],
  b: LngLatBounds,
): boolean {
  const [aWest, aSouth, aEast, aNorth] = a;
  const [bWest, bSouth, bEast, bNorth] = b;

  return aWest <= bEast && aEast >= bWest && aSouth <= bNorth && aNorth >= bSouth;
}
