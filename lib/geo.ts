import { getDistance, getGreatCircleBearing } from "geolib";

/** Project a position forward along a bearing by a distance in meters (flat-earth approximation) */
export function projectPosition(
  latitude: number,
  longitude: number,
  bearingRad: number,
  distanceMeters: number,
): [longitude: number, latitude: number] {
  const dLat = (distanceMeters * Math.cos(bearingRad)) / 110540;
  const dLon =
    (distanceMeters * Math.sin(bearingRad)) /
    (111320 * Math.cos((latitude * Math.PI) / 180));
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

  const cpaDist = Math.sqrt((dx + dvx * tcpa) ** 2 + (dy + dvy * tcpa) ** 2);

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
    const t = Math.max(
      0,
      Math.min(
        1,
        ((longitude - a.longitude) * dx + (latitude - a.latitude) * dy) / lenSq,
      ),
    );
    const projLatitude = a.latitude + t * dy;
    const projLongitude = a.longitude + t * dx;
    const dist = getDistance(
      { latitude, longitude },
      { latitude: projLatitude, longitude: projLongitude },
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i + 1;
    }
  }

  return bestDist <= thresholdMeters ? bestIndex : null;
}

/**
 * Calculate velocity made good (VMG) — the component of a vessel's velocity
 * projected along the bearing to a target. VMG equals SOG when heading directly
 * at the target, zero when perpendicular, and negative when heading away.
 *
 * @param sog Speed over ground in m/s
 * @param cog Course over ground in degrees true
 * @param bearingToTarget Bearing to target in degrees true
 * @returns VMG in m/s (positive = closing, negative = opening)
 */
export function calculateVMG(
  sog: number,
  cog: number,
  bearingToTarget: number,
): number {
  const angleDiff = ((cog - bearingToTarget + 180) % 360) - 180; // -180 to 180
  return sog * Math.cos((angleDiff * Math.PI) / 180);
}

/** Minimum VMG (m/s) for an ETA to be meaningful; below this ETA is null */
export const MIN_VMG_FOR_ETA = 0.5;

export type WaypointProgress = {
  /** Distance to waypoint in meters */
  distance: number;
  /** Bearing to waypoint in degrees true */
  bearing: number;
  /** Velocity made good toward waypoint in m/s (positive = closing) */
  vmg: number;
  /** ETA in seconds, or null if not making meaningful progress */
  eta: number | null;
};

/**
 * Compute navigation progress toward a waypoint: distance, bearing, VMG, ETA.
 *
 * ETA is based on VMG rather than raw SOG, so sailing off-course correctly
 * extends the estimate — and becomes null when the vessel isn't actually
 * closing on the target.
 *
 * @param position Current position
 * @param sog Speed over ground in m/s
 * @param cog Course over ground in degrees true
 * @param waypoint Target waypoint
 */
export function calculateWaypointProgress(
  position: { latitude: number; longitude: number },
  sog: number,
  cog: number,
  waypoint: { latitude: number; longitude: number },
): WaypointProgress {
  const distance = getDistance(position, waypoint);
  const bearing = getGreatCircleBearing(position, waypoint);
  const vmg = calculateVMG(sog, cog, bearing);
  const eta = vmg > MIN_VMG_FOR_ETA ? distance / vmg : null;
  return { distance, bearing, vmg, eta };
}

export type RouteLeg = {
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number };
  /** Leg distance in meters */
  distance: number;
  /** Initial bearing along the leg in degrees true */
  bearing: number;
};

/**
 * Compute leg-by-leg distance and bearing for a sequence of route points.
 * Returns an empty array for routes with fewer than 2 points.
 */
export function calculateRouteLegs(
  points: { latitude: number; longitude: number }[],
): RouteLeg[] {
  if (points.length < 2) return [];
  return points.slice(1).map((point, i) => {
    const prev = points[i];
    return {
      from: prev,
      to: point,
      distance: getDistance(prev, point),
      bearing: getGreatCircleBearing(prev, point),
    };
  });
}

export type DestinationProgress = {
  /** Total distance remaining to the final waypoint in meters */
  distance: number;
  /** ETA to the final waypoint in seconds, or null if not making progress */
  eta: number | null;
};

/**
 * Compute distance and ETA to the final waypoint of a route.
 *
 * Distance is the sum of the remaining distance to the active waypoint plus
 * all legs beyond it. ETA combines the VMG-based ETA to the active waypoint
 * with an optimistic estimate for the remaining legs at the current SOG.
 *
 * @param nextWaypointProgress Progress toward the currently active waypoint
 * @param points All points in the route
 * @param activeIndex Index of the currently active waypoint in `points`
 * @param sog Speed over ground in m/s (used for remaining-legs ETA estimate)
 */
export function calculateDestinationProgress(
  nextWaypointProgress: WaypointProgress,
  points: { latitude: number; longitude: number }[],
  activeIndex: number,
  sog: number,
): DestinationProgress {
  let remainingLegsDistance = 0;
  for (let i = activeIndex; i < points.length - 1; i++) {
    remainingLegsDistance += getDistance(points[i], points[i + 1]);
  }

  const distance = nextWaypointProgress.distance + remainingLegsDistance;

  let eta: number | null = null;
  if (nextWaypointProgress.eta != null) {
    if (remainingLegsDistance === 0) {
      eta = nextWaypointProgress.eta;
    } else if (sog > MIN_VMG_FOR_ETA) {
      eta = nextWaypointProgress.eta + remainingLegsDistance / sog;
    }
  }

  return { distance, eta };
}

/** Format bearing as three-digit true bearing, e.g. "045°T" */
export function formatBearing(degrees: number): string {
  const rounded = Math.round(((degrees % 360) + 360) % 360);
  return `${String(rounded).padStart(3, "0")}°`;
}
