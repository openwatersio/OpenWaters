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

/** Create or update a vessel entry with new data paths */
export function updateAISVessel(
  mmsi: string,
  paths: Record<string, DataPoint>,
) {
  useAIS.setState((s) => {
    const existing = s.vessels[mmsi];
    return {
      vessels: {
        ...s.vessels,
        [mmsi]: {
          mmsi,
          data: { ...(existing?.data ?? {}), ...paths },
          lastSeen: Date.now(),
        },
      },
    };
  });
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
  useAIS.setState({ vessels: {} });
}
