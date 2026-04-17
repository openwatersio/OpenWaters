import { XMLParser } from "fast-xml-parser";
import type { MarkerFields, TrackPointFields } from "@/database";

/**
 * Parse a Navionics marker JSON file into MarkerFields.
 * Each file is a single object: `{name, lat, lon, description}`.
 * Returns null if the JSON doesn't match the expected shape.
 */
export function parseNavionicsMarker(json: string): MarkerFields | null {
  try {
    const obj = JSON.parse(json);
    if (typeof obj.lat !== "number" || typeof obj.lon !== "number") return null;
    return {
      latitude: obj.lat,
      longitude: obj.lon,
      name: obj.name ?? null,
      notes: obj.description ?? null,
    };
  } catch {
    return null;
  }
}

export type ParsedRoute = {
  name: string | null;
  points: { latitude: number; longitude: number }[];
};

export type ParsedTrack = {
  name: string | null;
  started_at: string | null;
  ended_at: string | null;
  points: TrackPointFields[];
};

export type ParsedGpx = {
  waypoints: MarkerFields[];
  routes: ParsedRoute[];
  tracks: ParsedTrack[];
};

// Always coerce these elements to arrays even when a single instance is
// present. Mirrors the export shape in src/tracks/gpx.ts.
const ARRAY_TAGS = new Set(["wpt", "rte", "rtept", "trk", "trkseg", "trkpt"]);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

function toNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function validCoord(lat: unknown, lon: unknown): { latitude: number; longitude: number } | null {
  const latitude = toNum(lat);
  const longitude = toNum(lon);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function parseGpx(xml: string): ParsedGpx {
  const doc = parser.parse(xml);
  const gpx = doc?.gpx;
  if (!gpx) return { waypoints: [], routes: [], tracks: [] };

  const waypoints: MarkerFields[] = [];
  for (const wpt of gpx.wpt ?? []) {
    const coord = validCoord(wpt["@_lat"], wpt["@_lon"]);
    if (!coord) continue;
    waypoints.push({
      ...coord,
      name: toStr(wpt.name),
      notes: toStr(wpt.desc ?? wpt.cmt),
      icon: toStr(wpt.sym),
    });
  }

  const routes: ParsedRoute[] = [];
  for (const rte of gpx.rte ?? []) {
    const points: { latitude: number; longitude: number }[] = [];
    for (const rtept of rte.rtept ?? []) {
      const coord = validCoord(rtept["@_lat"], rtept["@_lon"]);
      if (coord) points.push(coord);
    }
    if (points.length === 0) continue;
    routes.push({ name: toStr(rte.name), points });
  }

  const tracks: ParsedTrack[] = [];
  for (const trk of gpx.trk ?? []) {
    const points: TrackPointFields[] = [];
    for (const seg of trk.trkseg ?? []) {
      for (const trkpt of seg.trkpt ?? []) {
        const coord = validCoord(trkpt["@_lat"], trkpt["@_lon"]);
        if (!coord) continue;
        // GPX <extensions> can carry speed/course. Accept a few common spellings.
        const ext = trkpt.extensions ?? {};
        const speed = toNum(ext.speed ?? trkpt.speed);
        const heading = toNum(ext.course ?? ext.heading ?? trkpt.course);
        points.push({
          ...coord,
          timestamp: toStr(trkpt.time),
          speed,
          heading,
        });
      }
    }
    if (points.length === 0) continue;

    const times = points
      .map((p) => p.timestamp)
      .filter((t): t is string => !!t)
      .sort();
    const started_at = times[0] ?? null;
    const ended_at = times.length ? times[times.length - 1] : null;

    tracks.push({
      name: toStr(trk.name),
      started_at,
      ended_at,
      points,
    });
  }

  return { waypoints, routes, tracks };
}
