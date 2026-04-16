import {
  deleteTrack,
  endTrack,
  getTrackPoints,
  insertTrackPoint,
  startTrack,
  type Track,
  type TrackPoint,
} from "@/database";
import { persistProxy } from "@/persistProxy";
import { computeDistance, segmentDistance } from "@/tracks/distance";
import {
  Accuracy,
  hasStartedLocationUpdatesAsync,
  requestBackgroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
  type LocationObject,
} from "expo-location";
import { defineTask } from "expo-task-manager";
import { useEffect, useState } from "react";
import { proxy, useSnapshot } from "valtio";
import { subscribeKey } from "valtio/utils";

const TASK_NAME = "track-recording-location";
const STORAGE_KEY = "track-recording";
const MIN_TRACK_DURATION_MS = 60_000;

// Reject obviously bad fixes at the storage boundary. We deliberately keep
// these gates loose so the raw track_points table preserves enough data to
// recompute distance offline with different filters. The real distance math
// lives in @/tracks/distance.
const MAX_ACCURACY_METERS = 30;

type State = {
  track: Track | null;
  distance: number;
  pointCount: number;
  maxSpeed: number;
  lastPoint: TrackPoint | null;

  // -- computed --
  readonly isRecording: boolean;
  readonly averageSpeed: number;
};

export const trackRecordingState = proxy<State>({
  track: null,
  distance: 0,
  pointCount: 0,
  maxSpeed: 0,
  lastPoint: null,

  get isRecording(): boolean {
    return this.track !== null;
  },
  get averageSpeed(): number {
    // Average over the time we have data for, not wall-clock. `distance`
    // only updates when a fix lands, so dividing by `now` would make the
    // average sag between fixes and snap back when one arrives.
    if (!this.track || !this.lastPoint || !this.lastPoint.timestamp) return 0;
    const ms =
      new Date(this.lastPoint.timestamp).getTime() -
      new Date(this.track.started_at).getTime();
    return ms > 0 ? this.distance / (ms / 1000) : 0;
  },
});

persistProxy(trackRecordingState, { name: STORAGE_KEY });

/** React hook — returns a tracked snapshot. */
export function useTrackRecording() {
  return useSnapshot(trackRecordingState);
}

/**
 * Returns the polyline of the active recording. Loads historical points
 * from the DB on mount, then appends each new fix as the recording store
 * records it.
 *
 * Held in component state, not on the store, because a multi-day track
 * can accumulate tens of thousands of points and would otherwise force
 * AsyncStorage writes + Valtio snapshot clones on every fix.
 *
 * Returns an empty array when no recording is active.
 */
export function useTrackRecordingPoints(): Array<[number, number]> {
  const trackId = useSnapshot(trackRecordingState).track?.id ?? null;
  const [points, setPoints] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    if (trackId == null) {
      setPoints([]);
      return;
    }

    // Load existing points from the DB
    getTrackPoints(trackId).then((rows) => {
      const dbCoords = rows.map(
        (p): [number, number] => [p.longitude, p.latitude],
      );
      // Prepend historical points before any that the subscription already
      // appended while the query was in flight.
      setPoints((prev) => [...dbCoords, ...prev]);
    });

    // Subscribe to new points as they come in
    return subscribeKey(trackRecordingState, "lastPoint", (point) => {
      if (!point || point.track_id !== trackId) return;
      setPoints((prev) => [...prev, [point.longitude, point.latitude]]);
    });
  }, [trackId]);

  return points;
}

// -- Public actions ------------------------------------------------------

export async function startTrackRecording() {
  if (trackRecordingState.isRecording) return;

  const granted = await requestPermissions();
  if (!granted) return;

  resetTrackRecording(await startTrack());
  await startBackgroundTracking();
}

export async function stopTrackRecording() {
  await stopBackgroundTracking();

  const { track } = trackRecordingState;
  if (track) {
    const durationMs = Date.now() - new Date(track.started_at).getTime();
    if (durationMs < MIN_TRACK_DURATION_MS) {
      await deleteTrack(track.id);
    } else {
      // Recompute distance from the persisted points so the saved value
      // reflects the canonical algorithm, not the running-sum approximation.
      const points = await getTrackPoints(track.id);
      await endTrack(track.id, computeDistance(points));
    }
  }

  resetTrackRecording();
}

/** Reset the in-memory recording state. Exposed for tests. */
export function resetTrackRecording(track: Track | null = null) {
  Object.assign(trackRecordingState, {
    track,
    distance: 0,
    pointCount: 0,
    maxSpeed: 0,
    lastPoint: null,
  });
}

// -- Internal: location pipeline ----------------------------------------

async function recordLocation(location: LocationObject) {
  const { track, lastPoint } = trackRecordingState;
  if (!track) return;

  const { coords } = location;
  // Cheap sanity gate — drop fixes with no usable accuracy. Everything else
  // is persisted so it can be re-evaluated by the distance algorithm later.
  if (coords.accuracy !== null && coords.accuracy > MAX_ACCURACY_METERS) return;

  const inserted = await insertTrackPoint(track.id, location);
  applyFix(inserted, lastPoint);
}

function applyFix(inserted: TrackPoint, previous: TrackPoint | null) {
  const segment = previous
    ? segmentDistance({ previous, current: inserted })
    : 0;
  Object.assign(trackRecordingState, {
    lastPoint: inserted,
    distance: trackRecordingState.distance + segment,
    pointCount: trackRecordingState.pointCount + 1,
    maxSpeed: Math.max(trackRecordingState.maxSpeed, inserted.speed ?? 0),
  });
}

async function requestPermissions(): Promise<boolean> {
  const { status: fgStatus } = await requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return false;
  const { status: bgStatus } = await requestBackgroundPermissionsAsync();
  return bgStatus === "granted";
}

async function startBackgroundTracking(): Promise<void> {
  if (await hasStartedLocationUpdatesAsync(TASK_NAME)) return;
  console.log("Starting background location tracking");
  await startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Accuracy.BestForNavigation,
    // Coarser sampling reduces how much GPS noise gets summed into the
    // accumulated distance: each segment carries more real motion vs. jitter.
    distanceInterval: 15, // meters
    timeInterval: 1000,
    showsBackgroundLocationIndicator: true, // iOS blue bar
    foregroundService: {
      notificationTitle: "Open Waters",
      notificationBody: "Recording track",
      notificationColor: "#e53e3e",
    },
  });
}

async function stopBackgroundTracking(): Promise<void> {
  if (!(await hasStartedLocationUpdatesAsync(TASK_NAME))) return;
  console.log("Stopping background location tracking");
  await stopLocationUpdatesAsync(TASK_NAME);
}

// Serialize task invocations. expo-task-manager doesn't guarantee one batch
// finishes before the next starts, and `recordLocation` reads `lastPoint`
// before awaiting the DB insert — so concurrent batches would capture the
// same `lastPoint` and double-count the leading segment.
let queue: Promise<void> = Promise.resolve();

defineTask<{ locations: LocationObject[] }>(
  TASK_NAME,
  async ({ data, error }) => {
    if (error) {
      console.warn("Background location error:", error.message);
      return;
    }
    if (!trackRecordingState.isRecording) {
      stopBackgroundTracking();
      return;
    }
    queue = queue.then(async () => {
      for (const location of data.locations) {
        await recordLocation(location);
      }
    });
    await queue;
  },
);
