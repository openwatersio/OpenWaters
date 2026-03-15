import { getDistance, getGreatCircleBearing } from "geolib";

/** Distance between two points in meters (Haversine) */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return getDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
    0.01, // 1cm accuracy
  );
}

/** Absolute angular difference in degrees (0–180) */
export function headingDelta(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

/** Great-circle bearing from point 1 to point 2 in degrees (0–360) */
export function bearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const bearing = getGreatCircleBearing(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
  );
  // geolib already returns 0..360; normalize defensively
  return ((bearing % 360) + 360) % 360;
}

/** Format bearing as three-digit true bearing, e.g. "045°T" */
export function formatBearing(degrees: number): string {
  const rounded = Math.round(((degrees % 360) + 360) % 360);
  return `${String(rounded).padStart(3, "0")}°T`;
}

// Sampling thresholds for track recording
export const MIN_INTERVAL_MS = 2_000;
export const MAX_INTERVAL_MS = 30_000;
export const MIN_DISTANCE_M = 10;
export const MIN_HEADING_DELTA = 5;

/** Decide whether a new GPS fix should be recorded based on distance/heading/time thresholds. */
export function shouldRecordPoint(
  point: { latitude: number; longitude: number; heading: number | null; timestamp: number },
  last: { latitude: number; longitude: number; heading: number | null; timestamp: number } | null,
): boolean {
  if (!last) return true;

  const elapsed = point.timestamp - last.timestamp;

  if (elapsed < MIN_INTERVAL_MS) return false;
  if (elapsed >= MAX_INTERVAL_MS) return true;

  const dist = distanceMeters(
    last.latitude,
    last.longitude,
    point.latitude,
    point.longitude,
  );
  if (dist >= MIN_DISTANCE_M) return true;

  if (
    point.heading != null &&
    last.heading != null &&
    headingDelta(last.heading, point.heading) >= MIN_HEADING_DELTA
  ) {
    return true;
  }

  return false;
}
