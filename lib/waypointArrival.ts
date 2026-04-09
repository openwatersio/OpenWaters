import { legProgress, type LegProgress } from "@/lib/geo";
import { getDistance, getGreatCircleBearing } from "geolib";

/** Default arrival circle radius in meters. */
export const DEFAULT_ARRIVAL_RADIUS = 50;

/** Fraction of leg length that caps the effective arrival radius. */
const LEG_LENGTH_RADIUS_CAP = 0.1;

/** Minimum cross-track tolerance in meters (floor for the cross-track gate). */
const MIN_CROSSTRACK_MAX = 150;

/** Cross-track gate as a multiple of effective radius. */
const CROSSTRACK_RADIUS_MULTIPLIER = 3;

/** Above this turn angle (degrees), the bisector is unreliable — fall back to circle only. */
const MAX_TURN_ANGLE_DEG = 170;

/** Below this turn angle (degrees), treat the route as straight and use the simple perpendicular. */
const MIN_TURN_ANGLE_DEG = 2;

export type LatLon = { latitude: number; longitude: number };

export type ArrivalInputs = {
  position: LatLon;
  /** Previous waypoint (A). Null on the first leg (no incoming leg). */
  previousWaypoint: LatLon | null;
  /** Active waypoint (B). Required. */
  activeWaypoint: LatLon;
  /** Next waypoint (C). Null on the last leg. Used to compute the bisector. */
  nextWaypoint: LatLon | null;
  /** When true, only the arrival circle triggers — no perpendicular/bisector. */
  arriveOnCircleOnly?: boolean;
  /** User-configured arrival circle radius, meters. Default 50. */
  arrivalRadius?: number;
};

export type ArrivalTrigger = "circle" | "perpendicular" | "bisector";

export type ArrivalResult = {
  arrived: boolean;
  trigger: ArrivalTrigger | null;
  /** Effective radius actually used, after leg-length capping. */
  effectiveRadius: number;
  geometry: {
    rangeToB: number;
    /** Null when there is no previous waypoint (first leg). */
    alongTrackPastB: number | null;
    /** Null when there is no previous waypoint (first leg). */
    crossTrack: number | null;
  };
};

/**
 * Check whether the vessel has arrived at a waypoint.
 *
 * Pure geometric predicate, evaluated in order — first match wins:
 *
 * 1. **Circle**: distance to B below the effective radius (capped to 10% of
 *    leg length so short legs can't insta-trigger).
 * 2. **Bisector** (interior waypoints with A, B, and C): vessel has crossed
 *    the angle bisector of the incoming and outgoing legs, within a
 *    cross-track gate. Prevents false arrivals at sharp turns.
 * 3. **Perpendicular** (terminal leg, or when the bisector degenerates):
 *    `alongTrackPastB > 0` with the same cross-track gate.
 *
 * On the first leg (no previous waypoint), only the circle can trigger.
 * When `arriveOnCircleOnly` is true, both the bisector and perpendicular
 * triggers are suppressed — use this for sailing any leg you can't lay.
 */
export function checkWaypointArrival(inputs: ArrivalInputs): ArrivalResult {
  const {
    position,
    previousWaypoint,
    activeWaypoint,
    nextWaypoint,
    arriveOnCircleOnly = false,
    arrivalRadius = DEFAULT_ARRIVAL_RADIUS,
  } = inputs;

  const rangeToB = getDistance(position, activeWaypoint);

  // Compute leg progress if we have an incoming leg.
  let progress: LegProgress | null = null;
  if (previousWaypoint) {
    progress = legProgress(previousWaypoint, activeWaypoint, position);
  }

  // Effective radius, capped at a fraction of the incoming-leg length.
  let effectiveRadius = arrivalRadius;
  if (progress && progress.legLength > 0) {
    effectiveRadius = Math.min(arrivalRadius, LEG_LENGTH_RADIUS_CAP * progress.legLength);
  }

  const baseResult = (
    arrived: boolean,
    trigger: ArrivalTrigger | null,
  ): ArrivalResult => ({
    arrived,
    trigger,
    effectiveRadius,
    geometry: {
      rangeToB,
      alongTrackPastB: progress?.alongTrackPastB ?? null,
      crossTrack: progress?.crossTrack ?? null,
    },
  });

  // 1. Arrival circle
  if (rangeToB < effectiveRadius) {
    return baseResult(true, "circle");
  }

  if (arriveOnCircleOnly || !progress) {
    return baseResult(false, null);
  }

  const crossTrackMax = Math.max(
    CROSSTRACK_RADIUS_MULTIPLIER * effectiveRadius,
    MIN_CROSSTRACK_MAX,
  );

  // 2. Bisector (needs a next waypoint to define the outgoing leg)
  if (nextWaypoint) {
    const legBC = getGreatCircleBearing(activeWaypoint, nextWaypoint);
    const legAB = progress.legBearing;
    // Turn angle: positive = how much the route bends at B. 0 = straight, 180 = U-turn.
    const rawDelta = ((legBC - legAB + 540) % 360) - 180; // -180..180
    const turnAngle = Math.abs(rawDelta);

    if (turnAngle >= MAX_TURN_ANGLE_DEG) {
      // Near U-turn — the bisector degenerates (it becomes parallel to the
      // cross-track direction) and the perpendicular would misfire on any
      // overshoot. Circle-only is the safe choice here.
      return baseResult(false, null);
    } else if (turnAngle >= MIN_TURN_ANGLE_DEG) {
      // Bisector arrival line: a line through B, perpendicular to the
      // direction of travel through the corner. "Direction of travel through
      // B" is the bisector bearing — halfway between the incoming bearing
      // (θ_AB) and the outgoing bearing (θ_BC). "Past" means P projects
      // positively onto a unit vector in that bearing direction.
      const bisectorBearing = legAB + rawDelta / 2;
      const projection = projectOntoBearing(activeWaypoint, position, bisectorBearing);
      const pastBisector = projection > 0;

      if (pastBisector && Math.abs(progress.crossTrack) < crossTrackMax) {
        return baseResult(true, "bisector");
      }
      // Not past the bisector (or too wide) — don't fall through to the
      // perpendicular, which would fire earlier and undo the bisector logic.
      return baseResult(false, null);
    }
    // Straight route (turnAngle < MIN): bisector == perpendicular to AB, fall
    // through to the perpendicular check below.
  }

  // 3. Perpendicular (terminal leg, or straight-route / U-turn fallback)
  if (progress.alongTrackPastB > 0 && Math.abs(progress.crossTrack) < crossTrackMax) {
    return baseResult(true, "perpendicular");
  }

  return baseResult(false, null);
}

/**
 * Project the vector from `origin` to `point` onto the unit vector pointing
 * along `bearingDeg` (degrees true), in meters. Uses a local flat-earth
 * approximation anchored at `origin`. Positive = point lies in the bearing
 * direction; negative = opposite.
 */
function projectOntoBearing(
  origin: LatLon,
  point: LatLon,
  bearingDeg: number,
): number {
  const latRad = (origin.latitude * Math.PI) / 180;
  // Local meters offsets of `point` from `origin`.
  const dx = (point.longitude - origin.longitude) * 111320 * Math.cos(latRad); // east
  const dy = (point.latitude - origin.latitude) * 110540; // north
  // Unit vector in bearing direction (bearing 0 = north, 90 = east).
  const b = (bearingDeg * Math.PI) / 180;
  const ux = Math.sin(b); // east component
  const uy = Math.cos(b); // north component
  return dx * ux + dy * uy;
}
