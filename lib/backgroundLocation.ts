import { insertTrackPoint } from "@/lib/database";
import { distanceMeters, shouldRecordPoint } from "@/lib/geo";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

const TASK_NAME = "track-recording-location";

type LastPoint = {
  latitude: number;
  longitude: number;
  heading: number | null;
  timestamp: number;
};

let lastPoint: LastPoint | null = null;

// Listeners notified when a point is actually recorded to DB
type PointRecordedListener = (
  lat: number,
  lon: number,
  segmentDistance: number,
  speed: number | null,
  timestamp: number,
) => void;

const pointRecordedListeners = new Set<PointRecordedListener>();

export function addPointRecordedListener(
  cb: PointRecordedListener,
): () => void {
  pointRecordedListeners.add(cb);
  return () => {
    pointRecordedListeners.delete(cb);
  };
}

function notifyPointRecorded(
  lat: number,
  lon: number,
  segmentDistance: number,
  speed: number | null,
  timestamp: number,
) {
  for (const cb of pointRecordedListeners) {
    cb(lat, lon, segmentDistance, speed, timestamp);
  }
}

export function resetLastPoint() {
  lastPoint = null;
}

function processLocation(
  coords: {
    latitude: number;
    longitude: number;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
  },
  timestamp: number,
  trackId: number,
) {
  const candidate = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    heading: coords.heading,
    timestamp,
  };

  if (!shouldRecordPoint(candidate, lastPoint)) return;

  let segmentDistance = 0;
  if (lastPoint) {
    segmentDistance = distanceMeters(
      lastPoint.latitude,
      lastPoint.longitude,
      coords.latitude,
      coords.longitude,
    );
  }

  lastPoint = candidate;

  insertTrackPoint(trackId, {
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: coords.speed,
    heading: coords.heading,
    accuracy: coords.accuracy,
    timestamp: new Date(timestamp).toISOString(),
  });

  notifyPointRecorded(coords.latitude, coords.longitude, segmentDistance, coords.speed, timestamp);
}

// Register the background task — must be called at module scope (top level)
TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("Background location error:", error.message);
    return;
  }

  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  // Get the active track ID from persisted state
  // We read from AsyncStorage directly since Zustand may not be hydrated in background
  const AsyncStorage =
    require("@react-native-async-storage/async-storage").default;

  const raw: string | null = await AsyncStorage.getItem("track-recording");
  if (!raw) return;

  try {
    const { state } = JSON.parse(raw);
    if (!state?.isRecording || !state?.activeTrackId) return;

    for (const loc of locations) {
      processLocation(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          accuracy: loc.coords.accuracy,
        },
        loc.timestamp,
        state.activeTrackId,
      );
    }
  } catch {
    // ignore parse errors
  }
});

export async function requestPermissions(): Promise<boolean> {
  const { status: fgStatus } =
    await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") return false;

  const { status: bgStatus } =
    await Location.requestBackgroundPermissionsAsync();
  return bgStatus === "granted";
}

export async function startBackgroundTracking(trackId: number): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (hasStarted) return;

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5, // meters — pre-filter before our sampling logic
    timeInterval: 1000,
    showsBackgroundLocationIndicator: true, // iOS blue bar
    foregroundService: {
      notificationTitle: "SeaScape",
      notificationBody: "Recording track",
      notificationColor: "#e53e3e",
    },
  });
}

export async function stopBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(TASK_NAME);
  }
}

export async function startForegroundTracking(
  trackId: number,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 2, // low threshold for smooth display line
      timeInterval: 500,
    },
    (loc) => {
      processLocation(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed,
          heading: loc.coords.heading,
          accuracy: loc.coords.accuracy,
        },
        loc.timestamp,
        trackId,
      );
    },
  );
}
