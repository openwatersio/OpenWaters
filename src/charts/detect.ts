import type {
  CatalogSource,
  MBTilesSource,
  RasterSource,
  StyleSource,
} from "@/charts/catalog/types";
import {
  importMBTilesFile,
  type MBTilesMetadata,
} from "@/charts/mbtiles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DetectResult = {
  source: CatalogSource;
  /** Suggested chart name derived from metadata, if available */
  suggestedName?: string;
};

// ---------------------------------------------------------------------------
// URL detection
// ---------------------------------------------------------------------------

/**
 * Detect the source type from a URL string using sequential heuristics:
 *
 * 1. Contains `{x}` + `{y}` + `{z}` or `{bbox-epsg-3857}` → raster
 * 2. Ends in `.mbtiles` or `.pmtiles` → direct download URL
 * 3. Fetch and inspect JSON body → style or TileJSON
 * 4. Nothing matches → throw
 */
export async function detectUrl(url: string): Promise<DetectResult> {
  const trimmed = url.trim();

  // 1. XYZ / WMS tile template
  if (isRasterTemplate(trimmed)) {
    return {
      source: rasterSource(trimmed),
    };
  }

  // 2. Direct file download URL
  const lower = trimmed.split("?")[0].toLowerCase();
  if (lower.endsWith(".mbtiles")) {
    return {
      source: mbtilesSource(trimmed),
    };
  }
  if (lower.endsWith(".pmtiles")) {
    return {
      source: { type: "pmtiles", id: uniqueId("pmtiles"), title: "PMTiles", url: trimmed },
    };
  }

  // 3 & 4. Fetch and inspect
  const response = await fetch(trimmed);
  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  if (contentType.includes("json") || lower.endsWith(".json")) {
    return detectJson(body, trimmed);
  }

  // Try parsing as JSON anyway — some servers don't set content-type correctly
  try {
    return detectJson(body, trimmed);
  } catch {
    // Not JSON
  }

  throw new Error(
    "Could not detect source type. Expected a tile URL template ({z}/{x}/{y}), " +
      "a MapLibre style JSON, a TileJSON, or an .mbtiles/.pmtiles file.",
  );
}

// ---------------------------------------------------------------------------
// File detection
// ---------------------------------------------------------------------------

/**
 * Detect source type from a picked file and import it.
 *
 * @param fileUri - URI from the file picker
 * @param fileName - Original filename for extension detection
 * @param chartId - Chart directory to import into (if known)
 */
export async function detectFile(
  fileUri: string,
  fileName: string,
  chartId?: string,
): Promise<DetectResult> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".mbtiles")) {
    const { path, metadata } = await importMBTilesFile(fileUri, chartId);
    return {
      source: mbtilesSourceFromImport(path, metadata),
      suggestedName: metadata.name,
    };
  }

  if (lower.endsWith(".pmtiles")) {
    // Future: import PMTiles file
    throw new Error("PMTiles file import is not yet supported");
  }

  throw new Error(
    `Unsupported file type: ${fileName}. Supported formats: .mbtiles`,
  );
}

// ---------------------------------------------------------------------------
// JSON inspection
// ---------------------------------------------------------------------------

function detectJson(body: string, url: string): DetectResult {
  const json = JSON.parse(body);

  // MapLibre StyleSpecification: has version 8 + sources object
  if (json.version === 8 && json.sources && typeof json.sources === "object") {
    const source: StyleSource = {
      type: "style",
      id: uniqueId("style"),
      title: json.name ?? "Style",
      url,
    };
    return { source, suggestedName: json.name };
  }

  // TileJSON: has a tiles array
  if (Array.isArray(json.tiles) && json.tiles.length > 0) {
    const source: RasterSource = {
      type: "raster",
      id: uniqueId("raster"),
      title: json.name ?? "Raster",
      tiles: json.tiles,
      ...(json.minzoom != null && { minzoom: json.minzoom }),
      ...(json.maxzoom != null && { maxzoom: json.maxzoom }),
      ...(json.bounds && { bounds: json.bounds }),
      ...(json.attribution && { attribution: json.attribution }),
    };
    return { source, suggestedName: json.name };
  }

  throw new Error(
    "JSON does not appear to be a MapLibre style or TileJSON document",
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let sourceCounter = 0;

/** Generate a unique source ID with a type prefix */
function uniqueId(type: string): string {
  return `${type}-${++sourceCounter}`;
}

function isRasterTemplate(url: string): boolean {
  const hasXyz =
    url.includes("{x}") && url.includes("{y}") && url.includes("{z}");
  return hasXyz || url.includes("{bbox-epsg-3857}");
}

function rasterSource(url: string): RasterSource {
  return {
    type: "raster",
    id: uniqueId("raster"),
    title: "Raster",
    tiles: [url],
  };
}

function mbtilesSource(url: string): MBTilesSource {
  return {
    type: "mbtiles",
    id: uniqueId("mbtiles"),
    title: "MBTiles",
    url,
  };
}

function mbtilesSourceFromImport(
  path: string,
  metadata: MBTilesMetadata,
): MBTilesSource {
  return {
    type: "mbtiles",
    id: uniqueId("mbtiles"),
    title: metadata.name ?? "MBTiles",
    url: path,
    ...(metadata.minzoom != null && { minzoom: metadata.minzoom }),
    ...(metadata.maxzoom != null && { maxzoom: metadata.maxzoom }),
    ...(metadata.bounds && { bounds: metadata.bounds }),
    ...(metadata.attribution && { attribution: metadata.attribution }),
  };
}
