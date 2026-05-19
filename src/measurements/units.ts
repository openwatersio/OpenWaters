import { projectPosition } from "@/geo";
import { distanceUnitDefs, type DistanceUnit } from "@/hooks/usePreferredUnits";

/**
 * Round-number ladder in user units. `niceDistance` snaps a raw value down
 * to the largest entry that fits. Shared by the scale bar and (eventually)
 * the adaptive range rings, so both surfaces agree on what counts as a
 * "nice" distance for a given zoom.
 */
const LADDER = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 3, 4, 5, 10, 25, 50, 100, 250,
  500, 1000,
] as const;

export interface NiceDistance {
  /** Snapped value expressed in the user's unit (e.g. 1.5 for "1.5 nm"). */
  value: number;
  /** Same value re-expressed in meters, for downstream pixel math. */
  meters: number;
  unit: DistanceUnit;
}

/**
 * Snap `rawMeters` down to the largest round-number entry that fits, in the
 * user's preferred distance unit. Returns both the value (for display) and
 * the equivalent in meters (for re-deriving a pixel length).
 *
 * If `rawMeters` is smaller than the smallest ladder entry, returns the
 * smallest entry rather than failing — callers should expect the bar to
 * overhang slightly at extreme zoom levels.
 */
export function niceDistance(
  rawMeters: number,
  unit: DistanceUnit,
): NiceDistance {
  const fromMeters = distanceUnitDefs[unit].fromMeters;
  const rawInUnit = rawMeters * fromMeters;

  let snapped: number = LADDER[0];
  for (const step of LADDER) {
    if (step <= rawInUnit) snapped = step;
    else break;
  }

  return {
    value: snapped,
    meters: snapped / fromMeters,
    unit,
  };
}

/**
 * Generate a closed-loop ring of `[longitude, latitude]` coordinates centered
 * on `center` at `radiusMeters`. The last point repeats the first so the
 * ring renders as a closed line.
 *
 * `segments` defaults to 64, which is smooth at the typical zoom levels a
 * range ring is visible at and cheap enough to regenerate per nav update.
 */
export function ringCoords(
  center: { latitude: number; longitude: number },
  radiusMeters: number,
  segments: number = 64,
): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const bearingRad = (i / segments) * 2 * Math.PI;
    coords.push(
      projectPosition(center.latitude, center.longitude, bearingRad, radiusMeters),
    );
  }
  return coords;
}
