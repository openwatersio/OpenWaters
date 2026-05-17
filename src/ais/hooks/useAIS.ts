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

/**
 * Newer-timestamp-wins merge gate. Returns true if `incoming` should replace
 * `existing` at the same path. Used to merge updates from multiple sources
 * (Signal K, NMEA, AIS Stream) without source-priority logic — whichever
 * source has the freshest data for a given path is the one that wins.
 */
export function shouldAccept(
  existing: DataPoint | undefined,
  incoming: DataPoint,
): boolean {
  return existing === undefined || incoming.timestamp > existing.timestamp;
}

/** Flush buffered AIS updates to the store immediately */
export function flushAIS() {
  aisFlushTimer = null;
  const updates = aisBuffer;
  aisBuffer = {};

  if (Object.keys(updates).length === 0) return;

  for (const [mmsi, update] of Object.entries(updates)) {
    const existing = aisState.vessels[mmsi];
    const merged: Record<string, DataPoint> = { ...(existing?.data ?? {}) };
    for (const [path, dp] of Object.entries(update.paths)) {
      if (shouldAccept(merged[path], dp)) {
        merged[path] = dp;
      }
    }
    aisState.vessels[mmsi] = {
      mmsi,
      data: merged,
      lastSeen: update.lastSeen,
    };
  }
}

function scheduleAISFlush() {
  if (aisFlushTimer) return;
  aisFlushTimer = setTimeout(flushAIS, AIS_FLUSH_INTERVAL);
}

/**
 * Create or update a vessel entry with new data paths (buffered). Per-path
 * updates are merged into the store via {@link shouldAccept} on flush — older
 * values lose to newer ones regardless of source.
 */
export function updateAISVessel(
  mmsi: string,
  paths: Record<string, DataPoint>,
) {
  const existing = aisBuffer[mmsi];
  if (existing) {
    for (const [path, dp] of Object.entries(paths)) {
      if (shouldAccept(existing.paths[path], dp)) {
        existing.paths[path] = dp;
      }
    }
    existing.lastSeen = Date.now();
  } else {
    aisBuffer[mmsi] = { paths: { ...paths }, lastSeen: Date.now() };
  }
  scheduleAISFlush();
}

/** Family label for a vessel's most-recent data source, shown in the detail sheet. */
export type SourceFamily = "signalk" | "nmea" | "aisstream" | "unknown";

/**
 * Return the family of the source whose `DataPoint.timestamp` is most recent
 * across all of the vessel's paths. Used purely for display — the merge rule
 * is timestamp-only and doesn't consult source identity.
 */
export function vesselPrimarySource(vessel: AISVessel): SourceFamily {
  let bestTimestamp = -Infinity;
  let bestSource: string | undefined;
  for (const dp of Object.values(vessel.data)) {
    if (dp.timestamp > bestTimestamp) {
      bestTimestamp = dp.timestamp;
      bestSource = dp.source;
    }
  }
  if (!bestSource) return "unknown";
  if (bestSource.startsWith("signalk.")) return "signalk";
  if (bestSource.startsWith("nmea.")) return "nmea";
  if (bestSource === "aisstream") return "aisstream";
  return "unknown";
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
