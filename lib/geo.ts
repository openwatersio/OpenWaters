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
