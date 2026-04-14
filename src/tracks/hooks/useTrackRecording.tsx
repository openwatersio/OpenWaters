import { deleteTrack, endTrack, insertTrackPoint, startTrack, type Track } from "@/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Accuracy,
  hasStartedLocationUpdatesAsync,
  requestBackgroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  startLocationUpdatesAsync,
  stopLocationUpdatesAsync,
  watchPositionAsync,
  type LocationObject,
} from "expo-location";
import { defineTask } from "expo-task-manager";
import { getDistance } from "geolib";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const TASK_NAME = "track-recording-location";
const STORAGE_KEY = "track-recording";
const LOCATION_OPTIONS = {
  accuracy: Accuracy.BestForNavigation,
  distanceInterval: 5, // meters
  timeInterval: 1000,
  showsBackgroundLocationIndicator: true, // iOS blue bar
  foregroundService: {
    notificationTitle: "Open Waters",
    notificationBody: "Recording track",
    notificationColor: "#e53e3e",
  },
};

type State = {
  isRecording: boolean;
  track: Track | null;
  distance: number;
  pointCount: number;
  maxSpeed: number;
  lastLocation: LocationObject | null;
};

const MIN_TRACK_DURATION_MS = 60_000;

// ~39 knots — filters both impossibly fast reported speeds and position jumps
const MAX_SPEED_MS = 20;
// Reject fixes with poor GPS accuracy
const MAX_ACCURACY_METERS = 50;
// Below this speed (~0.5 kn) the vessel is effectively stationary; skip the fix
// so GPS jitter doesn't inflate the track distance.
const MIN_SPEED_MS = 0.25;

async function recordLocation(location: LocationObject) {
  const { track, lastLocation } = useTrackRecording.getState();

  // This should never happen since we only subscribe when recording, but just in case:
  if (!track) {
    console.warn("Received location update while no track is active.");
    stopTrackRecording();
    return
  }

  const { coords } = location;
  if (coords.accuracy !== null && coords.accuracy > MAX_ACCURACY_METERS) return;
  if (coords.speed !== null && coords.speed > MAX_SPEED_MS) return;
  if (coords.speed !== null && coords.speed < MIN_SPEED_MS) return;

  const segmentDistance = lastLocation ? getDistance(lastLocation.coords, coords) : 0;
  if (lastLocation) {
    const elapsedMs = location.timestamp - lastLocation.timestamp;
    if (elapsedMs > 0 && (segmentDistance / elapsedMs) * 1000 > MAX_SPEED_MS) return;
  }

  await insertTrackPoint(track.id, location);

  useTrackRecording.setState(({ distance, pointCount, maxSpeed }) => {
    return {
      lastLocation: location,
      distance: distance + segmentDistance,
      pointCount: pointCount + 1,
      maxSpeed: Math.max(maxSpeed, coords.speed ?? 0),
    };
  });
}

export const useTrackRecording = create<State>()(
  persist(
    () => ({
      isRecording: false as boolean,
      track: null as Track | null,
      distance: 0,
      pointCount: 0,
      maxSpeed: 0,
      lastLocation: null as LocationObject | null,
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

function resetState(track: Track | null = null) {
  useTrackRecording.setState({
    isRecording: track !== null,
    track,
    distance: 0,
    pointCount: 0,
    maxSpeed: 0,
    lastLocation: null,
  });
}

export async function startTrackRecording() {
  if (useTrackRecording.getState().isRecording) return;

  const granted = await requestPermissions();
  if (!granted) return;

  const track = await startTrack();

  resetState(track);

  await startBackgroundTracking();
}

export async function stopTrackRecording() {
  await stopBackgroundTracking();

  const { track, distance } = useTrackRecording.getState();

  if (track) {
    const durationMs = Date.now() - new Date(track.started_at).getTime();
    if (durationMs < MIN_TRACK_DURATION_MS) {
      await deleteTrack(track.id);
    } else {
      await endTrack(track.id, distance);
    }
  }

  resetState();
}

export async function requestPermissions(): Promise<boolean> {
  const { status: fgStatus } =
    await requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return false;

  const { status: bgStatus } =
    await requestBackgroundPermissionsAsync();
  return bgStatus === "granted";
}

defineTask<{ locations: LocationObject[] }>(
  TASK_NAME,
  async ({ data, error }) => {
    if (error) {
      console.warn("Background location error:", error.message);
      return;
    }

    const { locations } = data;

    const { track, isRecording } = useTrackRecording.getState() ?? {};

    if (!track || !isRecording) {
      stopBackgroundTracking();
      return;
    }

    for (const location of locations) {
      await recordLocation(location);
    }
  },
);

export async function startBackgroundTracking(): Promise<void> {
  if (!(await hasStartedLocationUpdatesAsync(TASK_NAME))) {
    console.log("Starting background location tracking");
    await startLocationUpdatesAsync(TASK_NAME, LOCATION_OPTIONS);
  }
}

export async function stopBackgroundTracking(): Promise<void> {
  if (await hasStartedLocationUpdatesAsync(TASK_NAME)) {
    console.log("Stopping background location tracking");
    await stopLocationUpdatesAsync(TASK_NAME);
  }
}

export function subscribeToLocationUpdate(callback: (location: LocationObject) => void) {
  const subscription = watchPositionAsync(LOCATION_OPTIONS, callback, (error) => {
    throw new Error(`Error watching location: ${error}`);
  });
  return () => {
    subscription.then((s) => s.remove())
  };
}
