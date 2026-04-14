import { create } from "zustand";

import type { DataPoint } from "@/hooks/useInstruments";

export type AtoN = {
  id: string;
  /** Same shape as instrument/AIS store — flat path-keyed data points */
  data: Record<string, DataPoint>;
  /** When this AtoN was last updated (any path), for staleness pruning */
  lastSeen: number;
};

interface State {
  atons: Record<string, AtoN>;
}

export const useAtoN = create<State>()(() => ({
  atons: {},
}));

/** Select a single AtoN by ID */
export function useAtoNById(id: string) {
  return useAtoN((s) => s.atons[id]);
}

/** Create or update an AtoN entry with new data paths */
export function updateAtoN(
  id: string,
  paths: Record<string, DataPoint>,
) {
  useAtoN.setState((s) => {
    const existing = s.atons[id];
    return {
      atons: {
        ...s.atons,
        [id]: {
          id,
          data: { ...(existing?.data ?? {}), ...paths },
          lastSeen: Date.now(),
        },
      },
    };
  });
}

/** Remove AtoNs not updated within maxAgeMs (default 1 hour) */
export function pruneStaleAtoNs(maxAgeMs: number = 60 * 60 * 1000) {
  const now = Date.now();
  useAtoN.setState((s) => ({
    atons: Object.fromEntries(
      Object.entries(s.atons).filter(([, a]) => now - a.lastSeen < maxAgeMs),
    ),
  }));
}

/** Clear all AtoN data */
export function clearAtoN() {
  useAtoN.setState({ atons: {} });
}
