import type { CatalogEntry, MBTilesSource, PMTilesSource } from "@/charts/catalog/types";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { boundsIntersect } from "@/geo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadPlan = {
  /** MBTiles/PMTiles files to download (catalog sources whose bounds intersect) */
  files: (MBTilesSource | PMTilesSource)[];
  /** Whether to create a tile pack for raster/style sources */
  needsTilePack: boolean;
  /** Estimated total download size in bytes */
  estimatedBytes: number;
  /** Estimated tile count for the tile pack (0 if no pack needed) */
  estimatedTileCount: number;
};

// ---------------------------------------------------------------------------
// Tile count estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the number of tiles in a bounding box for a zoom range.
 * Uses the standard Web Mercator tile grid formula.
 */
export function estimateTileCount(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
): number {
  const [west, south, east, north] = bounds;
  let total = 0;

  for (let z = minZoom; z <= maxZoom; z++) {
    const n = Math.pow(2, z);
    const xMin = Math.floor(((west + 180) / 360) * n);
    const xMax = Math.floor(((east + 180) / 360) * n);
    const yMin = Math.floor(
      ((1 - Math.log(Math.tan((north * Math.PI) / 180) + 1 / Math.cos((north * Math.PI) / 180)) / Math.PI) / 2) * n,
    );
    const yMax = Math.floor(
      ((1 - Math.log(Math.tan((south * Math.PI) / 180) + 1 / Math.cos((south * Math.PI) / 180)) / Math.PI) / 2) * n,
    );
    total += (xMax - xMin + 1) * (yMax - yMin + 1);
  }

  return total;
}

/** Average raster tile size in bytes (rough estimate for size display) */
const AVG_TILE_BYTES = 15_000;

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

/**
 * Given a chart's catalog entry and a selected bounding box + zoom range,
 * determine what needs to be downloaded.
 */
export function planDownload(
  catalog: CatalogEntry,
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
  alreadyDownloaded: Set<string>,
): DownloadPlan {
  const files: (MBTilesSource | PMTilesSource)[] = [];
  let needsTilePack = false;
  let fileBytes = 0;

  for (const source of catalog.sources) {
    switch (source.type) {
      case "mbtiles":
      case "pmtiles": {
        // Skip already-downloaded files
        if (alreadyDownloaded.has(source.id)) break;
        // Check if the source's bounds intersect the selected region
        if (
          source.bounds &&
          boundsIntersect(
            source.bounds,
            bounds as [number, number, number, number],
          )
        ) {
          files.push(source);
          fileBytes += source.sizeBytes ?? 0;
        }
        break;
      }

      case "raster":
      case "style":
        needsTilePack = true;
        break;
    }
  }

  const estimatedTileCount = needsTilePack
    ? estimateTileCount(bounds, minZoom, maxZoom)
    : 0;
  const tilePackBytes = estimatedTileCount * AVG_TILE_BYTES;

  return {
    files,
    needsTilePack,
    estimatedBytes: fileBytes + tilePackBytes,
    estimatedTileCount,
  };
}

/**
 * Simplified plan for charts without a catalog (manual charts).
 * Always creates a tile pack.
 */
export function planTilePackOnly(
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
): DownloadPlan {
  const estimatedTileCount = estimateTileCount(bounds, minZoom, maxZoom);
  return {
    files: [],
    needsTilePack: true,
    estimatedBytes: estimatedTileCount * AVG_TILE_BYTES,
    estimatedTileCount,
  };
}
