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

// ---------------------------------------------------------------------------
// Custom string scanner — ~40x faster than fast-xml-parser on Hermes for
// the highly regular GPX structure. Uses indexOf/slice exclusively; no
// regex, no intermediate object tree, no allocations per element beyond
// the output arrays.
// ---------------------------------------------------------------------------

function getAttr(tag: string, name: string): string | null {
  const key = ` ${name}="`;
  const start = tag.indexOf(key);
  if (start === -1) return null;
  const valStart = start + key.length;
  const valEnd = tag.indexOf('"', valStart);
  if (valEnd === -1) return null;
  return tag.slice(valStart, valEnd);
}

function getElement(xml: string, tag: string): string | null {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = xml.indexOf(open);
  if (start === -1) return null;
  const valStart = start + open.length;
  const end = xml.indexOf(close, valStart);
  if (end === -1) return null;
  const val = xml.slice(valStart, end).trim();
  return val.length > 0 ? val : null;
}

function parseFloat_(s: string | null): number | null {
  if (s === null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function validCoord(
  lat: string | null,
  lon: string | null,
): { latitude: number; longitude: number } | null {
  const latitude = parseFloat_(lat);
  const longitude = parseFloat_(lon);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseWaypoints(xml: string): MarkerFields[] {
  const results: MarkerFields[] = [];
  let pos = 0;
  while (true) {
    const start = xml.indexOf("<wpt ", pos);
    if (start === -1) break;
    const tagEnd = xml.indexOf(">", start);
    if (tagEnd === -1) break;
    const tag = xml.slice(start, tagEnd + 1);
    const selfClose = tag.endsWith("/>");

    let inner = "";
    let nextPos: number;
    if (selfClose) {
      nextPos = tagEnd + 1;
    } else {
      const closeTag = "</wpt>";
      const end = xml.indexOf(closeTag, tagEnd);
      if (end === -1) { pos = tagEnd + 1; continue; }
      inner = xml.slice(tagEnd + 1, end);
      nextPos = end + closeTag.length;
    }

    const coord = validCoord(getAttr(tag, "lat"), getAttr(tag, "lon"));
    if (coord) {
      results.push({
        ...coord,
        name: getElement(inner, "name"),
        notes: getElement(inner, "desc") ?? getElement(inner, "cmt"),
        icon: getElement(inner, "sym"),
      });
    }
    pos = nextPos;
  }
  return results;
}

function parseRoutes(xml: string): ParsedRoute[] {
  const results: ParsedRoute[] = [];
  let pos = 0;
  while (true) {
    const start = xml.indexOf("<rte>", pos);
    if (start === -1) break;
    const closeTag = "</rte>";
    const end = xml.indexOf(closeTag, start);
    if (end === -1) break;
    const inner = xml.slice(start + 5, end);

    const name = getElement(inner, "name");
    const points: { latitude: number; longitude: number }[] = [];
    let ptPos = 0;
    while (true) {
      const ptStart = inner.indexOf("<rtept ", ptPos);
      if (ptStart === -1) break;
      const ptTagEnd = inner.indexOf(">", ptStart);
      if (ptTagEnd === -1) break;
      const ptTag = inner.slice(ptStart, ptTagEnd + 1);
      const coord = validCoord(getAttr(ptTag, "lat"), getAttr(ptTag, "lon"));
      if (coord) points.push(coord);
      ptPos = ptTagEnd + 1;
    }
    if (points.length > 0) {
      results.push({ name, points });
    }
    pos = end + closeTag.length;
  }
  return results;
}

function parseTracks(xml: string): ParsedTrack[] {
  const results: ParsedTrack[] = [];
  let pos = 0;
  while (true) {
    const start = xml.indexOf("<trk>", pos);
    // Also handle <trk\s...> with attributes
    const startAlt = xml.indexOf("<trk ", pos);
    let trkStart: number;
    if (start === -1 && startAlt === -1) break;
    if (start === -1) trkStart = startAlt;
    else if (startAlt === -1) trkStart = start;
    else trkStart = Math.min(start, startAlt);

    const closeTag = "</trk>";
    const end = xml.indexOf(closeTag, trkStart);
    if (end === -1) break;
    const trkTagEnd = xml.indexOf(">", trkStart);
    if (trkTagEnd === -1) break;
    const inner = xml.slice(trkTagEnd + 1, end);

    const name = getElement(inner, "name");
    const points: TrackPointFields[] = [];
    let earliest: string | null = null;
    let latest: string | null = null;
    let prevLat = NaN;
    let prevLon = NaN;

    let ptPos = 0;
    while (true) {
      const ptStart = inner.indexOf("<trkpt ", ptPos);
      if (ptStart === -1) break;
      const ptTagEnd = inner.indexOf(">", ptStart);
      if (ptTagEnd === -1) break;
      const ptTag = inner.slice(ptStart, ptTagEnd + 1);

      const coord = validCoord(getAttr(ptTag, "lat"), getAttr(ptTag, "lon"));
      if (!coord) {
        ptPos = ptTagEnd + 1;
        continue;
      }

      // Find the end of this trkpt (either self-closing or </trkpt>)
      let ptInner: string | null = null;
      const selfClose = ptTag.endsWith("/>");
      let nextPos: number;
      if (selfClose) {
        nextPos = ptTagEnd + 1;
      } else {
        const ptClose = inner.indexOf("</trkpt>", ptTagEnd);
        if (ptClose === -1) {
          ptPos = ptTagEnd + 1;
          continue;
        }
        ptInner = inner.slice(ptTagEnd + 1, ptClose);
        nextPos = ptClose + 8;
      }

      let timestamp: string | null = null;
      let speed: number | null = null;
      let heading: number | null = null;

      if (ptInner) {
        timestamp = getElement(ptInner, "time");
        // Speed/course can be in <extensions> or directly on the point.
        const extStart = ptInner.indexOf("<extensions>");
        const extEnd = extStart !== -1
          ? ptInner.indexOf("</extensions>", extStart)
          : -1;
        const ext = extEnd !== -1
          ? ptInner.slice(extStart, extEnd + "</extensions>".length)
          : "";
        speed = parseFloat_(
          getElement(ext, "speed") ?? getElement(ptInner, "speed"),
        );
        heading = parseFloat_(
          getElement(ext, "course") ??
          getElement(ext, "heading") ??
          getElement(ptInner, "course"),
        );
      }

      // Track the full session time span including skipped duplicates —
      // the recording really did span this period even if consecutive
      // positions were identical.
      if (timestamp) {
        if (!earliest || timestamp < earliest) earliest = timestamp;
        if (!latest || timestamp > latest) latest = timestamp;
      }

      // Skip consecutive duplicate positions (common in high-frequency
      // Navionics recordings that log 3 pts/sec while stationary).
      if (coord.latitude === prevLat && coord.longitude === prevLon) {
        ptPos = nextPos;
        continue;
      }
      prevLat = coord.latitude;
      prevLon = coord.longitude;

      points.push({ ...coord, timestamp, speed, heading });
      ptPos = nextPos;
    }

    if (points.length > 0) {
      results.push({
        name,
        started_at: earliest,
        ended_at: latest,
        points,
      });
    }
    pos = end + closeTag.length;
  }
  return results;
}

export function parseGpx(xml: string): ParsedGpx {
  return {
    waypoints: parseWaypoints(xml),
    routes: parseRoutes(xml),
    tracks: parseTracks(xml),
  };
}
