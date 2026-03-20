import { deleteTrack, endTrack, insertTrackPoint, startTrack, type Track } from "@/lib/database";
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
  averageSpeed: number;
  lastLocation: LocationObject | null;
};

const MIN_TRACK_DURATION_MS = 60_000;

let stopForegroundSubscription: (() => void) | null = null;

function startForegroundTracking() {
  stopForegroundSubscription = subscribeToLocationUpdate((location) => {
    const { track } = useTrackRecording.getState();
    if (!track) {
      console.warn("Received location update while no track is active.");
      stopForegroundTracking();
      return;
    }

    insertTrackPoint(track.id, location);
    onLocationUpdate(location);
  });
}

function stopForegroundTracking() {
  if (stopForegroundSubscription) {
    stopForegroundSubscription();
    stopForegroundSubscription = null;
  }
}

function onLocationUpdate(location: LocationObject) {
  useTrackRecording.setState((state) => {
    // This should never happen since we only subscribe when recording, but just in case:
    if (!state.track) throw new Error("Received point when track is not recording.");

    const { coords } = location;
    const segmentDistance = state.lastLocation ? getDistance(state.lastLocation?.coords, coords) : 0;

    return {
      lastLocation: location,
      distance: state.distance + segmentDistance,
      pointCount: state.pointCount + 1,
      maxSpeed: Math.max(state.maxSpeed, coords.speed ?? 0),
      averageSpeed: coords.speed != null
        ? (state.averageSpeed * state.pointCount + coords.speed) / (state.pointCount + 1)
        : state.averageSpeed,
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
      averageSpeed: 0,
      lastLocation: null as LocationObject | null,
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.isRecording) {
          resume();
        }
      },
    },
  ),
);

export async function start() {
  const granted = await requestPermissions();
  if (!granted) return;

  const track = await startTrack();

  useTrackRecording.setState({
    track,
    isRecording: true,
    pointCount: 0,
    maxSpeed: 0,
    averageSpeed: 0,
  });

  startForegroundTracking();
  await startBackgroundTracking();
}

export async function resume() {
  const { isRecording, track } = useTrackRecording.getState();
  if (!isRecording || !track) return;

  startForegroundTracking();
}

export async function stop() {
  stopForegroundTracking();
  await stopBackgroundTracking();

  const { track } = useTrackRecording.getState();

  if (track) {
    const durationMs = Date.now() - new Date(track.started_at).getTime();
    if (durationMs < MIN_TRACK_DURATION_MS) {
      await deleteTrack(track.id);
    } else {
      await endTrack(track.id, track.distance);
    }
  }

  useTrackRecording.setState({
    isRecording: false,
    track: null,
    pointCount: 0,
    maxSpeed: 0,
    averageSpeed: 0,
  });
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
      insertTrackPoint(track.id, location);
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
