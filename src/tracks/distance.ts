import type { TrackPoint } from "@/database";
import { getDistance } from "geolib";

/** Reject segments faster than this — physically impossible for a sailing vessel. */
export const MAX_SEGMENT_SPEED_MS = 20; // ~39 knots

/**
 * Multiplier applied to the sum of endpoint accuracies to determine the noise
 * floor for a segment. Segments shorter than this are treated as GPS jitter.
 *
 * A factor of 1.0 means: only count segments that exceed the combined reported
 * uncertainty. Higher values are more conservative (more segments dropped).
 */
export const NOISE_FLOOR_FACTOR = 1.0;

/** Default assumed accuracy when a fix's accuracy is null. */
const DEFAULT_ACCURACY_M = 10;

type Coordinates = { latitude: number; longitude: number };

interface SegmentInputs {
  previous: TrackPoint;
  current: TrackPoint;
}

/**
 * Compute the contribution of a single segment to the total track distance.
 * Returns 0 for segments that should be discarded (noise, impossible speed).
 *
 * Exported so the live recording path can incrementally accumulate distance
 * using the same logic as the offline recompute.
 */
export function segmentDistance({ previous, current }: SegmentInputs): number {
  const meters = haversine(previous, current);
  if (meters === 0) return 0;

  const elapsedMs =
    new Date(current.timestamp).getTime() -
    new Date(previous.timestamp).getTime();
  if (elapsedMs > 0) {
    const segmentSpeed = (meters / elapsedMs) * 1000;
    if (segmentSpeed > MAX_SEGMENT_SPEED_MS) return 0;
  }

  const noiseFloor =
    ((previous.accuracy ?? DEFAULT_ACCURACY_M) +
      (current.accuracy ?? DEFAULT_ACCURACY_M)) *
    NOISE_FLOOR_FACTOR;
  if (meters < noiseFloor) return 0;

  return meters;
}

/**
 * Compute total distance along a track in meters by summing valid segments.
 * Pure function — given the same input, always returns the same output.
 */
export function computeDistance(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += segmentDistance({ previous: points[i - 1], current: points[i] });
  }
  return total;
}

function haversine(a: Coordinates, b: Coordinates): number {
  return getDistance(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude },
  );
}
