import {
  getDatabase,
  insertMarker,
  insertRoute,
  insertTrack,
  insertTrackPoints,
  replaceRoutePoints,
  updateRoute,
} from "@/database";
import { parseGpx, parseNavionicsMarker } from "@/import/parse";
import log from "@/logger";
import { Directory, File } from "expo-file-system";
import { strFromU8, unzipSync } from "fflate";
import { getDistance } from "geolib";

const logger = log.extend("import");

export type ImportError = {
  file: string;
  message: string;
  /** `file` = whole file failed, `parse` = GPX structure, `item` = skipped point/route. */
  kind: "file" | "parse" | "item";
};

export type ImportRecordType = "marker" | "route" | "track";
export type ImportRecordStatus = "pending" | "importing" | "done" | "failed";

/** A file the user picked, possibly inside a zip or directory. Carries its
 *  own lifecycle independent of the feature records it contains. */
export type ImportFile = {
  name: string;
  status: ImportRecordStatus;
  error?: string;
};

export type ImportRecord = {
  type: ImportRecordType;
  status: ImportRecordStatus;
  /** DB row id once inserted. Undefined for `pending` / `failed`. */
  id?: number;
  /** Display name — falls back to the source filename when the GPX lacks one. */
  name: string;
  /** Name of the source file this record came from. */
  file: string;
  /** Populated when status === "failed". */
  error?: string;
};

export type ImportSummary = {
  files: ImportFile[];
  records: ImportRecord[];
  errors: ImportError[];
};

export type ImportOptions = {
  /** Optional live summary to mutate in place; the return value is the same object. */
  summary?: ImportSummary;
  /**
   * The file entry being processed. The importer transitions its status
   * through importing → done/failed as work progresses.
   */
  file?: ImportFile;
};

const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

export function emptySummary(): ImportSummary {
  return { files: [], records: [], errors: [] };
}

/**
 * Sum straight-line distances between consecutive points. Imported tracks
 * lack GPS accuracy metadata, so the segmentDistance noise-floor logic used
 * for live recording would drop most real segments. Straight-line sum is
 * what other GPX tools (and our own route distance) use.
 */
function sumPathDistance(
  points: { latitude: number; longitude: number }[],
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += getDistance(points[i - 1], points[i]);
  }
  return total;
}

/** Import a single GPX document (XML text). Writes to the database. */
export async function importGpxText(
  xml: string,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { file } = options;
  const summary = options.summary ?? emptySummary();
  const fileName = file?.name ?? "stream";
  if (file) file.status = "importing";

  const parsed = parseGpx(xml);

  let anyFailed = false;

  // Markers: insert then push as done in a single mutation — avoids
  // pending→importing→done churn that triggers three re-renders each.
  for (const wpt of parsed.waypoints) {
    try {
      const marker = await insertMarker(wpt);
      summary.records.push({
        type: "marker",
        status: "done",
        id: marker.id,
        name: wpt.name ?? fileName,
        file: fileName,
      });
    } catch (e) {
      logger.error("marker insert failed", e);
      summary.records.push({
        type: "marker",
        status: "failed",
        name: wpt.name ?? fileName,
        file: fileName,
        error: e instanceof Error ? e.message : String(e),
      });
      anyFailed = true;
    }
  }

  // Routes: same pattern — insert then push as done.
  for (const rte of parsed.routes) {
    try {
      const route = await insertRoute(rte.name ?? undefined);
      await replaceRoutePoints(route.id, rte.points);
      await updateRoute(route.id, { distance: sumPathDistance(rte.points) });
      summary.records.push({
        type: "route",
        status: "done",
        id: route.id,
        name: rte.name ?? fileName,
        file: fileName,
      });
    } catch (e) {
      logger.error("route insert failed", e);
      summary.records.push({
        type: "route",
        status: "failed",
        name: rte.name ?? fileName,
        file: fileName,
        error: e instanceof Error ? e.message : String(e),
      });
      anyFailed = true;
    }
  }

  // Tracks: push as importing (so UI shows the current track name),
  // then flip to done after the heavy insert completes.
  const db = await getDatabase();
  for (const trk of parsed.tracks) {
    summary.records.push({
      type: "track",
      status: "importing",
      name: trk.name ?? fileName,
      file: fileName,
    });
    const idx = summary.records.length - 1;
    try {
      const startedAt = trk.started_at ?? new Date().toISOString();
      const track = await insertTrack({
        name: trk.name,
        started_at: startedAt,
        ended_at: trk.ended_at,
      });

      await insertTrackPoints(track.id, trk.points);

      // Single pass for distance + max speed to avoid iterating 200k+ points twice.
      let distance = 0;
      let maxSpeed: number | null = null;
      for (let j = 0; j < trk.points.length; j++) {
        const p = trk.points[j];
        if (j > 0) distance += getDistance(trk.points[j - 1], p);
        if (p.speed != null && (maxSpeed === null || p.speed > maxSpeed)) {
          maxSpeed = p.speed;
        }
      }
      await db.runAsync(
        "UPDATE tracks SET distance = ?, max_speed = ? WHERE id = ?",
        distance,
        maxSpeed,
        track.id,
      );
      summary.records[idx].id = track.id;
      if (!trk.name) summary.records[idx].name = `Track ${track.id}`;
      summary.records[idx].status = "done";
    } catch (e) {
      logger.error("track insert failed", e);
      summary.records[idx].status = "failed";
      summary.records[idx].error = e instanceof Error ? e.message : String(e);
      anyFailed = true;
    }
  }

  if (file) file.status = anyFailed ? "failed" : "done";

  logger.debug(
    `${fileName} wpt=${parsed.waypoints.length} rte=${parsed.routes.length} trk=${parsed.tracks.length}`,
  );

  return summary;
}

/** Import a zip archive containing .gpx and/or Navionics .json marker files. */
export async function importZipBytes(
  bytes: Uint8Array,
  label = "archive.zip",
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { file: parent, summary: summaryOpt, ...rest } = options;
  const summary = summaryOpt ?? emptySummary();
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    if (parent) {
      parent.status = "failed";
      parent.error = `Invalid zip: ${e}`;
    }
    summary.errors.push({
      file: label,
      message: `Invalid zip: ${e}`,
      kind: "file",
    });
    return summary;
  }

  // Replace the zip-level file entry with per-entry files so the user sees
  // what's inside before we start parsing.
  const parentIdx = parent ? summary.files.indexOf(parent) : -1;
  if (parentIdx >= 0) summary.files.splice(parentIdx, 1);

  // Sort GPX entries by compressed size (ascending) so small files (routes)
  // finish quickly and the user sees progress before big tracks start.
  const gpxEntries = Object.entries(entries)
    .filter(([n]) => n.toLowerCase().endsWith(".gpx"))
    .sort((a, b) => a[1].length - b[1].length);
  const jsonMarkerEntries = Object.entries(entries).filter(
    ([n]) => n.toLowerCase().endsWith(".json") && n.includes("markers/"),
  );

  // Seed file entries for GPX files (markers are small enough to batch
  // under a single "markers" file entry).
  const gpxFiles = gpxEntries.map(([name]) => {
    summary.files.push({ name: `${label}:${name}`, status: "pending" });
    return summary.files[summary.files.length - 1];
  });

  let markersFile: ImportFile | undefined;
  if (jsonMarkerEntries.length > 0) {
    summary.files.push({
      name: `${label}:markers (${jsonMarkerEntries.length})`,
      status: "pending",
    });
    markersFile = summary.files[summary.files.length - 1];
  }

  // Import Navionics JSON markers — insert then push as done directly.
  if (markersFile) {
    markersFile.status = "importing";
    let anyMarkerFailed = false;
    for (const [name, data] of jsonMarkerEntries) {
      const entryName = `${label}:${name}`;
      try {
        const json = strFromU8(data);
        const marker = parseNavionicsMarker(json);
        if (!marker) {
          summary.errors.push({
            file: entryName,
            message: "Not a valid Navionics marker",
            kind: "parse",
          });
          anyMarkerFailed = true;
          continue;
        }
        const inserted = await insertMarker(marker);
        summary.records.push({
          type: "marker",
          status: "done",
          id: inserted.id,
          name: marker.name ?? name.split("/").pop() ?? entryName,
          file: entryName,
        });
      } catch (e) {
        summary.records.push({
          type: "marker",
          status: "failed",
          name: name.split("/").pop() ?? entryName,
          file: entryName,
          error: e instanceof Error ? e.message : String(e),
        });
        summary.errors.push({
          file: entryName,
          message: e instanceof Error ? e.message : String(e),
          kind: "file",
        });
        anyMarkerFailed = true;
      }
    }
    markersFile.status = anyMarkerFailed ? "failed" : "done";
    logger.debug(`${label} markers: ${jsonMarkerEntries.length} processed`);
  }

  // Import GPX files (routes + tracks) — yield every 10 files to let the
  // UI breathe without paying a setTimeout penalty on every single file.
  for (let i = 0; i < gpxEntries.length; i++) {
    const [, data] = gpxEntries[i];
    const entryFile = gpxFiles[i];
    const errorsBefore = summary.errors.length;
    try {
      const xml = strFromU8(data);
      await importGpxText(xml, { ...rest, summary, file: entryFile });
      for (let j = errorsBefore; j < summary.errors.length; j++) {
        summary.errors[j].file = entryFile.name;
      }
    } catch (e) {
      entryFile.status = "failed";
      entryFile.error = e instanceof Error ? e.message : String(e);
      summary.errors.push({
        file: entryFile.name,
        message: e instanceof Error ? e.message : String(e),
        kind: "file",
      });
    }
    if (i % 10 === 9) await yieldToUi();
  }
  logger.debug(`${label}: ${gpxEntries.length} gpx, ${jsonMarkerEntries.length} markers`);
  return summary;
}

/**
 * Walk a directory recursively and collect all `.gpx` File entries.
 * Depth-first; symlinks aren't followed because expo-file-system doesn't
 * expose them.
 */
export function collectGpxFiles(dir: Directory): File[] {
  const files: File[] = [];
  const stack: Directory[] = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: (Directory | File)[];
    try {
      entries = current.list();
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry instanceof Directory) {
        stack.push(entry);
      } else if (entry.uri.toLowerCase().endsWith(".gpx")) {
        files.push(entry);
      }
    }
  }
  return files;
}

/** Import every .gpx file under a picked directory (recursive). */
export async function importPickedDirectory(
  dir: Directory,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { file: parent, summary: summaryOpt, ...rest } = options;
  const summary = summaryOpt ?? emptySummary();
  const files = collectGpxFiles(dir);

  // Replace the directory-level file entry with per-gpx entries.
  const parentIdx = parent ? summary.files.indexOf(parent) : -1;
  if (parentIdx >= 0) summary.files.splice(parentIdx, 1);

  const entries = files.map((f) => {
    const name = f.uri.split("/").pop() ?? f.uri;
    summary.files.push({ name, status: "pending" });
    return summary.files[summary.files.length - 1];
  });

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const entry = entries[i];
    const errorsBefore = summary.errors.length;
    try {
      const xml = await f.text();
      await importGpxText(xml, { ...rest, summary, file: entry });
      for (let j = errorsBefore; j < summary.errors.length; j++) {
        summary.errors[j].file = entry.name;
      }
    } catch (e) {
      entry.status = "failed";
      entry.error = e instanceof Error ? e.message : String(e);
      summary.errors.push({
        file: entry.name,
        message: e instanceof Error ? e.message : String(e),
        kind: "file",
      });
    }
    if (i % 10 === 9) await yieldToUi();
  }
  logger.debug(`directory: ${files.length} files`);
  return summary;
}

/**
 * Import from a picked File instance. Dispatches on the filename extension.
 * Takes the File directly (not a URI) because `File.pickFileAsync()` returns
 * a native-backed File with a security-scoped URL on iOS; wrapping it in
 * `new File(uri)` loses that binding.
 */
export async function importPickedFile(
  file: File,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { file: fileEntry } = options;
  const summary = options.summary ?? emptySummary();
  const fileName =
    fileEntry?.name ?? file.name ?? file.uri.split("/").pop() ?? file.uri;
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".gpx")) {
    try {
      const xml = await file.text();
      return await importGpxText(xml, { ...options, summary });
    } catch (e) {
      if (fileEntry) {
        fileEntry.status = "failed";
        fileEntry.error = e instanceof Error ? e.message : String(e);
      }
      summary.errors.push({
        file: fileName,
        message: e instanceof Error ? e.message : String(e),
        kind: "file",
      });
      return summary;
    }
  }

  if (lower.endsWith(".zip")) {
    const bytes = await file.bytes();
    return await importZipBytes(bytes, fileName, { ...options, summary });
  }

  if (fileEntry) {
    fileEntry.status = "failed";
    fileEntry.error = "Unsupported file type";
  }
  summary.errors.push({
    file: fileName,
    message: "Unsupported file type",
    kind: "file",
  });
  return summary;
}
