export type MBTilesOptions = {
  path: string;
  format: "png" | "jpg" | "jpeg" | "webp" | "pbf";
  tileSize?: number;
  minzoom?: number;
  maxzoom?: number;
  bounds?: [number, number, number, number];
  attribution?: string;
};
import { Directory, File, Paths } from "expo-file-system";
import { openDatabaseAsync } from "expo-sqlite";

/**
 * MBTiles files live under `documentDirectory/mbtiles/<uuid>.mbtiles`.
 * Each file is a SQLite database following the MBTiles 1.3 spec.
 * MapLibre Native reads tiles from them via the `mbtiles://` URL scheme.
 */
const MBTILES_DIR = "mbtiles";

export function mbtilesDirectory(): Directory {
  return new Directory(Paths.document, MBTILES_DIR);
}

export function ensureMBTilesDirectory(): Directory {
  const dir = mbtilesDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

/**
 * Raw MBTiles metadata as read from the file's `metadata` key-value table.
 * See https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md
 */
export type MBTilesMetadata = {
  name?: string;
  format?: string;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  type?: "overlay" | "baselayer";
  version?: string;
  description?: string;
};

/**
 * Opens an MBTiles file and reads its `metadata` table. The file is a SQLite
 * database, so we point `expo-sqlite` at its parent directory and treat the
 * file name as the database name.
 */
export async function readMBTilesMetadata(
  absolutePath: string,
): Promise<MBTilesMetadata> {
  const { dir, name } = splitPath(absolutePath);
  const db = await openDatabaseAsync(name, undefined, dir);
  try {
    const rows = await db.getAllAsync<{ name: string; value: string }>(
      "SELECT name, value FROM metadata",
    );
    const map = new Map(rows.map((r) => [r.name, r.value]));

    const result: MBTilesMetadata = {};
    if (map.has("name")) result.name = map.get("name");
    if (map.has("format")) result.format = map.get("format");
    if (map.has("attribution")) result.attribution = map.get("attribution");
    if (map.has("description")) result.description = map.get("description");
    if (map.has("version")) result.version = map.get("version");

    const type = map.get("type");
    if (type === "overlay" || type === "baselayer") result.type = type;

    const bounds = map.get("bounds");
    if (bounds) {
      const parts = bounds.split(",").map((p) => parseFloat(p.trim()));
      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        result.bounds = parts as [number, number, number, number];
      }
    }

    const minzoom = map.get("minzoom");
    if (minzoom != null) {
      const n = parseInt(minzoom, 10);
      if (!isNaN(n)) result.minzoom = n;
    }

    const maxzoom = map.get("maxzoom");
    if (maxzoom != null) {
      const n = parseInt(maxzoom, 10);
      if (!isNaN(n)) result.maxzoom = n;
    }

    return result;
  } finally {
    await db.closeAsync();
  }
}

/**
 * Imports an MBTiles file from a source location (typically a temporary
 * file from the document picker) into the app's managed mbtiles directory.
 *
 * Returns the absolute path to the copied file along with the parsed metadata
 * and a ready-to-save `MBTilesOptions` object.
 *
 * TODO: flag the copied file with NSURLIsExcludedFromBackupKey to keep
 * large MBTiles out of iCloud backup. Requires a small native helper.
 */
export async function importMBTilesFile(
  sourceUri: string,
): Promise<{ path: string; metadata: MBTilesMetadata; options: MBTilesOptions }> {
  const dir = ensureMBTilesDirectory();
  const filename = `${generateId()}.mbtiles`;
  const destination = new File(dir, filename);

  const source = new File(sourceUri);
  source.copy(destination);

  const path = stripFileScheme(destination.uri);
  const metadata = await readMBTilesMetadata(path);
  const options = metadataToOptions(path, metadata);

  return { path, metadata, options };
}

/**
 * Deletes an MBTiles file backing a chart source. Silently no-ops if the
 * file is already gone.
 */
export function deleteMBTilesFile(absolutePath: string): void {
  const file = new File(withFileScheme(absolutePath));
  if (file.exists) {
    file.delete();
  }
}

/**
 * Converts raw MBTiles metadata to `MBTilesOptions` suitable for storing
 * in the `sources` table.
 */
export function metadataToOptions(
  path: string,
  metadata: MBTilesMetadata,
): MBTilesOptions {
  const format = normalizeFormat(metadata.format);
  return {
    path,
    format,
    ...(metadata.minzoom != null && { minzoom: metadata.minzoom }),
    ...(metadata.maxzoom != null && { maxzoom: metadata.maxzoom }),
    ...(metadata.bounds && { bounds: metadata.bounds }),
    ...(metadata.attribution && { attribution: metadata.attribution }),
  };
}

function normalizeFormat(format: string | undefined): MBTilesOptions["format"] {
  switch (format) {
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "pbf":
      return format;
    default:
      // MBTiles spec requires a format field, but fall back to png for
      // permissive imports.
      return "png";
  }
}

function splitPath(absolutePath: string): { dir: string; name: string } {
  const slash = absolutePath.lastIndexOf("/");
  if (slash === -1) return { dir: "", name: absolutePath };
  return {
    dir: absolutePath.slice(0, slash),
    name: absolutePath.slice(slash + 1),
  };
}

function stripFileScheme(uri: string): string {
  const stripped = uri.startsWith("file://") ? uri.slice("file://".length) : uri;
  // iOS container paths are symlinked from /var -> /private/var. Some native
  // APIs (MapLibre's resource loader in particular) require the canonical
  // /private/var form or they report "path not found" even though the file
  // exists. Normalize eagerly so the stored path matches what native code
  // expects later.
  return stripped.startsWith("/var/") ? `/private${stripped}` : stripped;
}

function withFileScheme(path: string): string {
  return path.startsWith("file://") ? path : `file://${path}`;
}

function generateId(): string {
  // Simple random id — collision probability negligible for this use case.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
