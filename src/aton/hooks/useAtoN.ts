import { proxy, useSnapshot } from "valtio";

import type { DataPoint } from "@/instruments/hooks/useInstruments";

export type AtoN = {
  id: string;
  /** Same shape as instrument/AIS store — flat path-keyed data points */
  data: Record<string, DataPoint>;
  /** When this AtoN was last updated (any path), for staleness pruning */
  lastSeen: number;
};

type State = { atons: Record<string, AtoN> };

export const atonState = proxy<State>({ atons: {} });

export function useAtoN() {
  return useSnapshot(atonState).atons;
}

/** Select a single AtoN by ID */
export function useAtoNById(id: string) {
  return useSnapshot(atonState).atons[id];
}

/** Create or update an AtoN entry with new data paths */
export function updateAtoN(id: string, paths: Record<string, DataPoint>) {
  const existing = atonState.atons[id];
  atonState.atons[id] = {
    id,
    data: { ...(existing?.data ?? {}), ...paths },
    lastSeen: Date.now(),
  };
}

/** Remove AtoNs not updated within maxAgeMs (default 1 hour) */
export function pruneStaleAtoNs(maxAgeMs: number = 60 * 60 * 1000) {
  const now = Date.now();
  for (const id of Object.keys(atonState.atons)) {
    if (now - atonState.atons[id].lastSeen >= maxAgeMs) {
      delete atonState.atons[id];
    }
  }
}

/** Clear all AtoN data */
export function clearAtoN() {
  atonState.atons = {};
}
