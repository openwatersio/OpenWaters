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
  /** Velocity made good toward waypoint in m/s (positive = closing).
   *  This is the textbook VMG: SOG projected onto bearing(P → waypoint). */
  vmg: number;
  /** Leg-aligned VMG: SOG projected onto the incoming leg bearing A→B.
   *  Null when no previous waypoint is provided. */
  legVmg: number | null;
  /** ETA in seconds, or null if not making meaningful progress.
   *  Uses `legVmg` when a previous waypoint is provided, otherwise `vmg`. */
  eta: number | null;
};

/**
 * Compute navigation progress toward a waypoint: distance, bearing, VMG, ETA.
 *
 * When `previous` is provided, ETA is computed from **leg-aligned VMG** —
 * SOG projected onto the leg bearing A→B — rather than the instantaneous
 * bearing P→B. This gives a much more stable ETA on a layline or any
 * off-axis approach, because the leg axis doesn't swing as the vessel
 * closes on B. The trade-off: on an unfavored tack (COG nearly perpendicular
 * to the leg), `legVmg` falls below `MIN_VMG_FOR_ETA` and ETA becomes null.
 * That's intentional — an oscillating number is worse than a blank.
 *
 * On the first leg (no previous waypoint), there is no leg axis, so ETA
 * falls back to the bearing-to-mark VMG.
 *
 * @param position Current position
 * @param sog Speed over ground in m/s
 * @param cog Course over ground in degrees true
 * @param waypoint Target waypoint (B)
 * @param previous Previous waypoint (A). When provided, ETA uses leg-aligned VMG.
 */
export function calculateWaypointProgress(
  position: { latitude: number; longitude: number },
  sog: number,
  cog: number,
  waypoint: { latitude: number; longitude: number },
  previous?: { latitude: number; longitude: number } | null,
): WaypointProgress {
  const distance = getDistance(position, waypoint);
  const bearing = getGreatCircleBearing(position, waypoint);
  const vmg = calculateVMG(sog, cog, bearing);

  let legVmg: number | null = null;
  let eta: number | null;
  if (previous) {
    const legBearing = getGreatCircleBearing(previous, waypoint);
    legVmg = calculateVMG(sog, cog, legBearing);
    eta = legVmg > MIN_VMG_FOR_ETA ? distance / legVmg : null;
  } else {
    eta = vmg > MIN_VMG_FOR_ETA ? distance / vmg : null;
  }

  return { distance, bearing, vmg, legVmg, eta };
}

/** Earth mean radius in meters (same value geolib uses internally). */
const EARTH_RADIUS_M = 6371008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export type LegProgress = {
  /** Distance remaining from position to B (leg end), meters. */
  rangeToB: number;
  /** Signed distance past B along the leg direction (A→B), meters.
   *  Negative: still before B. Positive: crossed the perpendicular plane at B. */
  alongTrackPastB: number;
  /** Signed cross-track distance from the A→B great-circle line, meters.
   *  Positive = right of track, negative = left (right-hand convention). */
  crossTrack: number;
  /** Initial bearing A→B in degrees true. */
  legBearing: number;
  /** Length of leg A→B in meters. */
  legLength: number;
};

/**
 * Compute along-track / cross-track progress of a position P relative to a
 * leg from A to B. Uses the standard spherical along/cross-track formulas
 * (Ed Williams / Chris Veness).
 *
 * `alongTrackPastB` going from negative to positive is the "crossed the
 * perpendicular at B" signal used for waypoint arrival; `crossTrack` is the
 * miss distance and is used to gate that trigger against wide passes.
 */
export function legProgress(
  A: { latitude: number; longitude: number },
  B: { latitude: number; longitude: number },
  P: { latitude: number; longitude: number },
): LegProgress {
  const legLength = getDistance(A, B);
  const legBearing = getGreatCircleBearing(A, B);
  const rangeToB = getDistance(P, B);

  // Degenerate leg (A == B): no meaningful along/cross-track.
  if (legLength === 0) {
    return {
      rangeToB,
      alongTrackPastB: -rangeToB,
      crossTrack: 0,
      legBearing,
      legLength,
    };
  }

  const distAP = getDistance(A, P);
  if (distAP === 0) {
    return {
      rangeToB,
      alongTrackPastB: -legLength,
      crossTrack: 0,
      legBearing,
      legLength,
    };
  }

  const bearingAP = getGreatCircleBearing(A, P);

  const delta13 = distAP / EARTH_RADIUS_M; // angular distance A→P
  const theta13 = toRad(bearingAP);
  const theta12 = toRad(legBearing);

  const crossTrackAngular = Math.asin(
    Math.sin(delta13) * Math.sin(theta13 - theta12),
  );
  const crossTrack = crossTrackAngular * EARTH_RADIUS_M;

  // Guard the acos domain for very short legs / near-collinear geometry.
  const acosArg = Math.min(
    1,
    Math.max(-1, Math.cos(delta13) / Math.cos(crossTrackAngular)),
  );
  const alongTrackFromA = Math.acos(acosArg) * EARTH_RADIUS_M;

  // acos is always ≥ 0, so recover sign from the angle between A→P and A→B.
  const angleDiff = ((bearingAP - legBearing + 540) % 360) - 180; // -180..180
  const sign = Math.abs(angleDiff) <= 90 ? 1 : -1;
  const signedAlongTrackFromA = sign * alongTrackFromA;

  return {
    rangeToB,
    alongTrackPastB: signedAlongTrackFromA - legLength,
    crossTrack,
    legBearing,
    legLength,
  };
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
  return `${rounded}°`;
}
