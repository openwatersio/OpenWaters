import { getDistance, getGreatCircleBearing } from "geolib";

/** Minimum distance threshold (meters) — arrival triggers regardless of VMG */
const MIN_DISTANCE = 50;

export type ArrivalState = {
  distanceToWaypoint: number; // meters
  vmg: number; // m/s, positive = closing
  eta: number | null; // seconds, null if VMG <= 0
  arrived: boolean;
};

/**
 * Check whether the vessel has arrived at a waypoint using VMG (velocity made good).
 *
 * Arrival is detected when:
 * 1. Distance drops below MIN_DISTANCE (safety floor), OR
 * 2. VMG transitions from positive to negative (vessel has passed CPA)
 *    while distance is within a reasonable arrival zone (< 200m)
 *
 * Pure function with no side effects.
 */
export function checkWaypointArrival(
  position: { latitude: number; longitude: number },
  sog: number, // m/s
  cog: number, // degrees
  waypoint: { latitude: number; longitude: number },
  previous: ArrivalState | null,
): ArrivalState {
  const dist = getDistance(position, waypoint);

  // Compute VMG: projection of velocity toward the waypoint
  const bearingToWpt = getGreatCircleBearing(position, waypoint);
  const angleDiff = ((cog - bearingToWpt + 180) % 360) - 180; // -180 to 180
  const vmg = sog * Math.cos((angleDiff * Math.PI) / 180);

  const eta = vmg > 0.5 ? dist / vmg : null;

  let arrived = false;

  // Safety floor: close enough regardless of heading
  if (dist < MIN_DISTANCE) {
    arrived = true;
  }
  // VMG transition: was closing, now opening — vessel passed CPA
  else if (previous && previous.vmg > 0 && vmg <= 0 && dist < 200) {
    arrived = true;
  }

  return { distanceToWaypoint: dist, vmg, eta, arrived };
}
