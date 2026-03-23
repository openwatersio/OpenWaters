import { create } from "zustand";

import type { DataPoint } from "@/hooks/useInstruments";

export type AISVessel = {
  mmsi: string;
  /** Same shape as instrument store — flat path-keyed data points */
  data: Record<string, DataPoint>;
  /** When this vessel was last updated (any path), for staleness pruning */
  lastSeen: number;
};

interface State {
  vessels: Record<string, AISVessel>;
}

export const useAIS = create<State>()(() => ({
  vessels: {},
}));

/** Select a single AIS vessel by MMSI */
export function useAISVessel(mmsi: string) {
  return useAIS((s) => s.vessels[mmsi]);
}

// --- Buffered AIS writes: accumulate in a mutable object, flush on a timer ---

const AIS_FLUSH_INTERVAL = 1000; // ms

/** Mutable buffer for pending AIS updates, keyed by MMSI */
let aisBuffer: Record<string, { paths: Record<string, DataPoint>; lastSeen: number }> = {};
let aisFlushTimer: ReturnType<typeof setTimeout> | null = null;

/** Flush buffered AIS updates to the store immediately */
export function flushAIS() {
  aisFlushTimer = null;
  const updates = aisBuffer;
  aisBuffer = {};

  if (Object.keys(updates).length === 0) return;

  useAIS.setState((s) => {
    const vessels = { ...s.vessels };
    for (const [mmsi, update] of Object.entries(updates)) {
      const existing = vessels[mmsi];
      vessels[mmsi] = {
        mmsi,
        data: { ...(existing?.data ?? {}), ...update.paths },
        lastSeen: update.lastSeen,
      };
    }
    return { vessels };
  });
}

function scheduleAISFlush() {
  if (aisFlushTimer) return;
  aisFlushTimer = setTimeout(flushAIS, AIS_FLUSH_INTERVAL);
}

/** Create or update a vessel entry with new data paths (buffered) */
export function updateAISVessel(
  mmsi: string,
  paths: Record<string, DataPoint>,
) {
  const existing = aisBuffer[mmsi];
  if (existing) {
    Object.assign(existing.paths, paths);
    existing.lastSeen = Date.now();
  } else {
    aisBuffer[mmsi] = { paths: { ...paths }, lastSeen: Date.now() };
  }
  scheduleAISFlush();
}

/** Remove vessels not updated within maxAgeMs (default 9 minutes) */
export function pruneStaleVessels(maxAgeMs: number = 9 * 60 * 1000) {
  const now = Date.now();
  useAIS.setState((s) => ({
    vessels: Object.fromEntries(
      Object.entries(s.vessels).filter(([, v]) => now - v.lastSeen < maxAgeMs),
    ),
  }));
}

/** Clear all AIS vessel data */
export function clearAIS() {
  aisBuffer = {};
  if (aisFlushTimer) {
    clearTimeout(aisFlushTimer);
    aisFlushTimer = null;
  }
  useAIS.setState({ vessels: {} });
}
