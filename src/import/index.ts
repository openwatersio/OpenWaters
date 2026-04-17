import { Directory, File } from "expo-file-system";
import { unzipSync, strFromU8 } from "fflate";
import {
  getDatabase,
  insertMarker,
  insertRoute,
  insertTrack,
  insertTrackPoints,
  replaceRoutePoints,
  updateRoute,
} from "@/database";
import { parseGpx } from "@/import/parse";
import { getDistance } from "geolib";

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

  await yieldToUi();
  const parsed = parseGpx(xml);

  // Push records and remember their indices; mutate later through the array
  // so valtio sees the changes. Local refs to the original objects would
  // bypass the proxy wrapping done on push.
  const markerIdxStart = summary.records.length;
  for (const wpt of parsed.waypoints) {
    summary.records.push({
      type: "marker",
      status: "pending",
      name: wpt.name ?? fileName,
      file: fileName,
    });
  }
  const routeIdxStart = summary.records.length;
  for (const rte of parsed.routes) {
    summary.records.push({
      type: "route",
      status: "pending",
      name: rte.name ?? fileName,
      file: fileName,
    });
  }
  const trackIdxStart = summary.records.length;
  for (const trk of parsed.tracks) {
    summary.records.push({
      type: "track",
      status: "pending",
      name: trk.name ?? fileName,
      file: fileName,
    });
  }

  let anyFailed = false;

  for (let i = 0; i < parsed.waypoints.length; i++) {
    const idx = markerIdxStart + i;
    summary.records[idx].status = "importing";
    try {
      const marker = await insertMarker(parsed.waypoints[i]);
      summary.records[idx].id = marker.id;
      summary.records[idx].status = "done";
    } catch (e) {
      summary.records[idx].status = "failed";
      summary.records[idx].error = e instanceof Error ? e.message : String(e);
      anyFailed = true;
    }
  }
  if (parsed.waypoints.length > 0) await yieldToUi();

  for (let i = 0; i < parsed.routes.length; i++) {
    const rte = parsed.routes[i];
    const idx = routeIdxStart + i;
    summary.records[idx].status = "importing";
    try {
      const route = await insertRoute(rte.name ?? undefined);
      await replaceRoutePoints(route.id, rte.points);
      await updateRoute(route.id, { distance: sumPathDistance(rte.points) });
      summary.records[idx].id = route.id;
      summary.records[idx].status = "done";
    } catch (e) {
      summary.records[idx].status = "failed";
      summary.records[idx].error = e instanceof Error ? e.message : String(e);
      anyFailed = true;
    }
    await yieldToUi();
  }

  const db = await getDatabase();
  for (let i = 0; i < parsed.tracks.length; i++) {
    const trk = parsed.tracks[i];
    const idx = trackIdxStart + i;
    summary.records[idx].status = "importing";
    try {
      const startedAt = trk.started_at ?? new Date().toISOString();
      const track = await insertTrack({
        name: trk.name,
        started_at: startedAt,
        ended_at: trk.ended_at,
      });
      summary.records[idx].id = track.id;
      if (!trk.name) summary.records[idx].name = `Track ${track.id}`;
      await yieldToUi();

      await insertTrackPoints(track.id, trk.points);

      const distance = sumPathDistance(trk.points);
      // Cache max_speed on the track row so the list view doesn't need to
      // aggregate over track_points. Some GPX files have no <speed> elements
      // at all — store null in that case.
      let maxSpeed: number | null = null;
      for (const p of trk.points) {
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
      summary.records[idx].status = "done";
    } catch (e) {
      summary.records[idx].status = "failed";
      summary.records[idx].error = e instanceof Error ? e.message : String(e);
      anyFailed = true;
    }
  }

  if (file) file.status = anyFailed ? "failed" : "done";

  return summary;
}

/** Import a zip archive containing one or more .gpx files. */
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

  // Replace the zip-level file entry with per-gpx entries so the user sees
  // what's inside before we start parsing.
  const parentIdx = parent ? summary.files.indexOf(parent) : -1;
  if (parentIdx >= 0) summary.files.splice(parentIdx, 1);

  const gpxEntries = Object.entries(entries).filter(([n]) =>
    n.toLowerCase().endsWith(".gpx"),
  );
  const entryFiles = gpxEntries.map(([name]) => {
    summary.files.push({ name: `${label}:${name}`, status: "pending" });
    // Return the proxy-wrapped reference; mutations through the pre-push
    // local would bypass valtio.
    return summary.files[summary.files.length - 1];
  });

  for (let i = 0; i < gpxEntries.length; i++) {
    const [, data] = gpxEntries[i];
    const entryFile = entryFiles[i];
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
  }
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
      await yieldToUi();
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
  }
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
      await yieldToUi();
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
    await yieldToUi();
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
