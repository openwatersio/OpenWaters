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
import { deleteStagedFile } from "@/import/staging";
import log from "@/logger";
import { File } from "expo-file-system";
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

/**
 * Import a single GPX document (XML text). All DB writes for one file are
 * wrapped in a transaction so a crash leaves no partial data.
 */
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
  const db = await getDatabase();

  // Markers
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

  // Routes
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

  // Tracks
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

      // Single pass for distance + max speed
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

/**
 * Import a single Navionics JSON marker file. Returns the summary with
 * the marker record appended.
 */
export async function importNavionicsJson(
  json: string,
  fileName: string,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const { file } = options;
  const summary = options.summary ?? emptySummary();
  if (file) file.status = "importing";

  try {
    const marker = parseNavionicsMarker(json);
    if (!marker) {
      summary.errors.push({
        file: fileName,
        message: "Not a valid Navionics marker",
        kind: "parse",
      });
      if (file) file.status = "failed";
      return summary;
    }
    const inserted = await insertMarker(marker);
    summary.records.push({
      type: "marker",
      status: "done",
      id: inserted.id,
      name: marker.name ?? fileName,
      file: fileName,
    });
    if (file) file.status = "done";
  } catch (e) {
    logger.error("marker insert failed", e);
    summary.records.push({
      type: "marker",
      status: "failed",
      name: fileName,
      file: fileName,
      error: e instanceof Error ? e.message : String(e),
    });
    summary.errors.push({
      file: fileName,
      message: e instanceof Error ? e.message : String(e),
      kind: "file",
    });
    if (file) file.status = "failed";
  }

  return summary;
}

/**
 * Import a single staged file (GPX or Navionics JSON). Reads the file,
 * dispatches to the appropriate parser, and deletes the file from staging
 * on success.
 */
export async function importStagedFile(
  file: File,
  options: ImportOptions = {},
): Promise<ImportSummary> {
  const summary = options.summary ?? emptySummary();
  const fileName = file.name ?? file.uri.split("/").pop() ?? "file";
  const lower = fileName.toLowerCase();

  try {
    const text = await file.text();

    if (lower.endsWith(".gpx")) {
      await importGpxText(text, { ...options, summary });
    } else if (lower.endsWith(".json")) {
      await importNavionicsJson(text, fileName, { ...options, summary });
    } else {
      summary.errors.push({
        file: fileName,
        message: "Unsupported file type",
        kind: "file",
      });
      if (options.file) {
        options.file.status = "failed";
        options.file.error = "Unsupported file type";
      }
      return summary;
    }

    // Only delete from staging if the file entry didn't fail
    const fileEntry = options.file;
    if (!fileEntry || fileEntry.status === "done") {
      deleteStagedFile(file);
    }
  } catch (e) {
    logger.error(`failed to import ${fileName}`, e);
    if (options.file) {
      options.file.status = "failed";
      options.file.error = e instanceof Error ? e.message : String(e);
    }
    summary.errors.push({
      file: fileName,
      message: e instanceof Error ? e.message : String(e),
      kind: "file",
    });
  }

  return summary;
}
