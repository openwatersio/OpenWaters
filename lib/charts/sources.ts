import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import type { ChartRow, SourceRow } from "@/lib/database";

export type Chart = ChartRow & {
  sources: SourceRow[];
};

export function parseChart(
  row: ChartRow,
  sources: SourceRow[],
): Chart {
  return {
    ...row,
    sources,
  };
}

/**
 * Build a MapLibre style from one or more source rows.
 *
 * - Single `style` source: returns the URL string directly.
 * - Multiple sources or non-style types: composes a StyleSpecification
 *   with one raster source + layer per SourceRow, stacked in array order.
 */
export function buildMapStyle(
  sources: SourceRow[],
): StyleSpecification | string {
  // Single style source — pass URL verbatim to MapLibre
  if (sources.length === 1 && sources[0].type === "style") {
    return sources[0].url!;
  }

  const spec: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
  };

  for (const source of sources) {
    const sourceId = `source-${source.id}`;

    switch (source.type) {
      case "style":
        // Multiple style sources can't be composed — skip.
        // This case is handled above for single sources.
        break;

      case "raster": {
        const tiles = source.tiles ? JSON.parse(source.tiles) as string[] : undefined;
        spec.sources[sourceId] = {
          type: "raster",
          ...(source.url && !tiles ? { url: source.url } : {}),
          ...(tiles ? { tiles } : {}),
          tileSize: source.tile_size ?? 256,
          ...(source.minzoom != null && { minzoom: source.minzoom }),
          ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
          ...(source.bounds && { bounds: JSON.parse(source.bounds) }),
          ...(source.attribution && { attribution: source.attribution }),
        };
        (spec.layers as unknown[]).push({
          id: `layer-${source.id}`,
          type: "raster",
          source: sourceId,
        });
        break;
      }

      case "mbtiles": {
        // MapLibre Native iOS supports mbtiles:// URL scheme natively.
        // The url column stores the local path for downloaded files.
        spec.sources[sourceId] = {
          type: "raster",
          url: `mbtiles://${source.url}`,
          tileSize: source.tile_size ?? 256,
          ...(source.minzoom != null && { minzoom: source.minzoom }),
          ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
          ...(source.bounds && { bounds: JSON.parse(source.bounds) }),
          ...(source.attribution && { attribution: source.attribution }),
        };
        (spec.layers as unknown[]).push({
          id: `layer-${source.id}`,
          type: "raster",
          source: sourceId,
        });
        break;
      }

      case "pmtiles": {
        spec.sources[sourceId] = {
          type: "raster",
          url: `pmtiles://${source.url}`,
          tileSize: source.tile_size ?? 256,
          ...(source.minzoom != null && { minzoom: source.minzoom }),
          ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
          ...(source.bounds && { bounds: JSON.parse(source.bounds) }),
          ...(source.attribution && { attribution: source.attribution }),
        };
        (spec.layers as unknown[]).push({
          id: `layer-${source.id}`,
          type: "raster",
          source: sourceId,
        });
        break;
      }
    }
  }

  return spec;
}

/**
 * Build a preview style from catalog source shapes.
 * Filters to sources that can stream (style, raster) and skips
 * mbtiles/pmtiles with remote URLs (not yet downloaded).
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

/**
 * Convert the form's JSON `options` string into flat fields for `insertSource`.
 * This is the translation boundary between the legacy form interface
 * (which emits type + JSON options) and the new column-per-field schema.
 */
export function optionsToSourceFields(
  type: string,
  options: string,
): {
  url?: string | null;
  tiles?: string[] | null;
  bounds?: number[] | null;
  minzoom?: number | null;
  maxzoom?: number | null;
  attribution?: string | null;
  tileSize?: number | null;
} {
  const opts = JSON.parse(options) as Record<string, unknown>;

  switch (type) {
    case "style":
      return { url: (opts.url as string) ?? null };

    case "raster":
      return {
        tiles: (opts.tiles as string[]) ?? null,
        tileSize: (opts.tileSize as number) ?? null,
        minzoom: (opts.minzoom as number) ?? null,
        maxzoom: (opts.maxzoom as number) ?? null,
        attribution: (opts.attribution as string) ?? null,
      };

    case "mbtiles":
      return {
        url: (opts.path as string) ?? null,
        tileSize: (opts.tileSize as number) ?? null,
        minzoom: (opts.minzoom as number) ?? null,
        maxzoom: (opts.maxzoom as number) ?? null,
        bounds: (opts.bounds as number[]) ?? null,
        attribution: (opts.attribution as string) ?? null,
      };

    case "custom":
      // Full StyleSpecification — encode as data: URL
      return {
        url: `data:application/json,${encodeURIComponent(options)}`,
      };

    default:
      return {};
  }
}

/**
 * Convert a SourceRow back into the JSON options string the form expects.
 * Reverse of `optionsToSourceFields`.
 */
export function sourceToOptions(source: SourceRow): string {
  switch (source.type) {
    case "style":
      return JSON.stringify({ url: source.url });

    case "raster":
      return JSON.stringify({
        tiles: source.tiles ? JSON.parse(source.tiles) : [],
        ...(source.tile_size != null && { tileSize: source.tile_size }),
        ...(source.minzoom != null && { minzoom: source.minzoom }),
        ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
        ...(source.attribution && { attribution: source.attribution }),
      });

    case "mbtiles":
      return JSON.stringify({
        path: source.url,
        format: "png",
        ...(source.tile_size != null && { tileSize: source.tile_size }),
        ...(source.minzoom != null && { minzoom: source.minzoom }),
        ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
        ...(source.bounds && { bounds: JSON.parse(source.bounds) }),
        ...(source.attribution && { attribution: source.attribution }),
      });

    default:
      return "{}";
  }
}
