import { useSyncExternalStore } from "react";

/** A single data point from any instrument source */
export type DataPoint = {
  value: number | string | { latitude: number; longitude: number } | null;
  timestamp: number; // Unix ms
  source: string; // e.g. "signalk.raspberrypi", "nmea.tcp.192.168.1.1:10110"
  meta?: {
    sentence?: string; // NMEA sentence type, e.g. "DBT"
    pgn?: number; // NMEA 2000 PGN
    talker?: string; // NMEA talker ID, e.g. "SD"
  };
};

// --- Mutable store: zero-cost writes, throttled notifications ---

const NOTIFY_INTERVAL = 200; // ms — max 5 notifications/sec

/** The mutable data store — writes go here immediately */
let data: Record<string, DataPoint> = {};

/** Timestamp of the most recent write */
let lastWriteMs = 0;

/** Timestamp of the most recent listener notification */
let lastNotifyMs = 0;

/** Pending notification timer */
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Subscribed listeners (from useSyncExternalStore) */
const listeners = new Set<() => void>();

function notifyListeners() {
  notifyTimer = null;
  if (lastWriteMs > lastNotifyMs) {
    lastNotifyMs = lastWriteMs;
    for (const listener of listeners) {
      listener();
    }
  }
}

function scheduleNotify() {
  if (notifyTimer) return;
  notifyTimer = setTimeout(notifyListeners, NOTIFY_INTERVAL);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// --- Write API (called by protocol clients) ---

/** Update a single instrument path */
export function updatePath(path: string, dataPoint: DataPoint) {
  data[path] = dataPoint;
  lastWriteMs = dataPoint.timestamp;
  scheduleNotify();
}

/** Batch update multiple instrument paths */
export function updatePaths(updates: Record<string, DataPoint>) {
  let latestTimestamp = lastWriteMs;
  for (const [path, dp] of Object.entries(updates)) {
    data[path] = dp;
    if (dp.timestamp > latestTimestamp) {
      latestTimestamp = dp.timestamp;
    }
  }
  lastWriteMs = latestTimestamp;
  scheduleNotify();
}

/** Check if a data point is stale (older than maxAgeMs) */
export function isStale(path: string, maxAgeMs: number): boolean {
  const point = data[path];
  if (!point) return true;
  return Date.now() - point.timestamp > maxAgeMs;
}

/** Clear all instrument data */
export function clearInstruments() {
  data = {};
  lastWriteMs = Date.now();
  scheduleNotify();
}

// --- Read API (called by components) ---

/** Subscribe to a single instrument path. Re-renders only when that path's DataPoint changes. */
export function useInstrumentPath(path: string): DataPoint | undefined {
  return useSyncExternalStore(subscribe, () => data[path]);
}

/** Subscribe to the full instrument data map. Re-renders on any change. */
export function useInstrumentData(): Record<string, DataPoint> {
  return useSyncExternalStore(subscribe, () => data);
}

/** Subscribe to whether any instrument data exists. */
export function useHasInstrumentData(): boolean {
  return useSyncExternalStore(subscribe, () => Object.keys(data).length > 0);
}

/** Imperative read of the current data (always fresh, no React subscription) */
export function getInstrumentData(): Record<string, DataPoint> {
  return data;
}

/** Reset store to empty state — for tests */
export function resetInstrumentStore() {
  data = {};
  if (notifyTimer) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
  }
  lastWriteMs = 0;
  lastNotifyMs = 0;
}
