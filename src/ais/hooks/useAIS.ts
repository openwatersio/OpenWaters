import { proxy, useSnapshot } from "valtio";

import type { DataPoint } from "@/instruments/hooks/useInstruments";

export type AISVessel = {
  mmsi: string;
  /** Same shape as instrument store — flat path-keyed data points */
  data: Record<string, DataPoint>;
  /** When this vessel was last updated (any path), for staleness pruning */
  lastSeen: number;
};

type State = { vessels: Record<string, AISVessel> };

export const aisState = proxy<State>({ vessels: {} });

export function useAIS() {
  return useSnapshot(aisState).vessels;
}

/** Select a single AIS vessel by MMSI */
export function useAISVessel(mmsi: string) {
  return useSnapshot(aisState).vessels[mmsi];
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

  for (const [mmsi, update] of Object.entries(updates)) {
    const existing = aisState.vessels[mmsi];
    aisState.vessels[mmsi] = {
      mmsi,
      data: { ...(existing?.data ?? {}), ...update.paths },
      lastSeen: update.lastSeen,
    };
  }
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
  for (const mmsi of Object.keys(aisState.vessels)) {
    if (now - aisState.vessels[mmsi].lastSeen >= maxAgeMs) {
      delete aisState.vessels[mmsi];
    }
  }
}

/** Clear all AIS vessel data */
export function clearAIS() {
  aisBuffer = {};
  if (aisFlushTimer) {
    clearTimeout(aisFlushTimer);
    aisFlushTimer = null;
  }
  aisState.vessels = {};
}
