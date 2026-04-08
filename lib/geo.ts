import { getDistance } from "geolib";

/** Project a position forward along a bearing by a distance in meters (flat-earth approximation) */
export function projectPosition(
  latitude: number,
  longitude: number,
  bearingRad: number,
  distanceMeters: number,
): [longitude: number, latitude: number] {
  const dLat = (distanceMeters * Math.cos(bearingRad)) / 110540;
  const dLon = (distanceMeters * Math.sin(bearingRad)) / (111320 * Math.cos((latitude * Math.PI) / 180));
  return [longitude + dLon, latitude + dLat];
}

/** Absolute angular difference in degrees (0–180) */
export function headingDelta(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

export type CPA = {
  /** Distance at closest point of approach, in meters */
  distance: number;
  /** Time until closest point of approach, in seconds */
  time: number;
};

export type Vessel = {
  latitude: number;
  longitude: number;
  /** Speed over ground in m/s */
  sog: number;
  /** Course over ground in radians, true north */
  cog: number;
};

/**
 * Calculate Closest Point of Approach (CPA) between two vessels
 * using linear approximation (flat earth, constant velocity).
 *
 * @returns CPA with distance (meters) and time (seconds), or null if
 *          no relative motion or CPA is in the past
 */
export function calculateCPA(a: Vessel, b: Vessel): CPA | null {
  // Velocity vectors (m/s, flat earth approximation)
  const aVx = a.sog * Math.sin(a.cog);
  const aVy = a.sog * Math.cos(a.cog);
  const bVx = b.sog * Math.sin(b.cog);
  const bVy = b.sog * Math.cos(b.cog);

  // Relative position in meters (approximate)
  const dx =
    (b.longitude - a.longitude) *
    111320 *
    Math.cos((a.latitude * Math.PI) / 180);
  const dy = (b.latitude - a.latitude) * 110540;

  // Relative velocity
  const dvx = bVx - aVx;
  const dvy = bVy - aVy;

  const dvSq = dvx * dvx + dvy * dvy;
  if (dvSq < 0.001) return null; // No relative motion

  const tcpa = -(dx * dvx + dy * dvy) / dvSq;
  if (tcpa < 0) return null; // CPA is in the past

  const cpaDist = Math.sqrt(
    (dx + dvx * tcpa) ** 2 + (dy + dvy * tcpa) ** 2,
  );

  return { distance: cpaDist, time: tcpa };
}

/**
 * Ground distance (meters) represented by one screen pixel in the standard
 * Web Mercator projection at the given zoom and latitude. Matches the
 * formula used by MapLibre / Mapbox GL.
 *
 * Useful for converting a pixel tolerance (e.g. "40px of slop") into meters
 * at the current zoom, so hit-test thresholds scale with how zoomed-in the
 * map is.
 */
export function metersPerPixel(zoom: number, latitude: number): number {
  return (
    (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom)
  );
}

/**
 * Find the index of the leg segment closest to a point.
 * Returns the index to insert at (i.e. after points[index-1], before points[index]),
 * or null if no leg is within the threshold.
 */
export function findNearestLegIndex(
  latitude: number,
  longitude: number,
  points: { latitude: number; longitude: number }[],
  thresholdMeters: number,
): number | null {
  if (points.length < 2) return null;

  let bestDist = Infinity;
  let bestIndex: number | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((longitude - a.longitude) * dx + (latitude - a.latitude) * dy) / lenSq));
    const projLatitude = a.latitude + t * dy;
    const projLongitude = a.longitude + t * dx;
    const dist = getDistance({ latitude, longitude }, { latitude: projLatitude, longitude: projLongitude });
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i + 1;
    }
  }

  return bestDist <= thresholdMeters ? bestIndex : null;
}

/** Format bearing as three-digit true bearing, e.g. "045°T" */
export function formatBearing(degrees: number): string {
  const rounded = Math.round(((degrees % 360) + 360) % 360);
  return `${String(rounded).padStart(3, "0")}°T`;
}
