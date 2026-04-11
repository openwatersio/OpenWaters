import { useDbQuery } from "@/hooks/useDbQuery";
import {
  buildMapStyle,
  parseChartSource,
  type ChartSource,
} from "@/lib/chartSources";
import { getAllChartSources } from "@/lib/database";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface State {
  mapStyleId?: number;
}

export const useViewOptions = create<State>()(
  persist(
    (): State => ({}),
    {
      name: "view-options",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function setViewOptions(options: Partial<State>) {
  useViewOptions.setState(options);
}

export function useChartSources(): ChartSource[] {
  const fetch = useCallback(() => getAllChartSources(), []);
  const rows = useDbQuery(["chart_sources"], fetch);
  return useMemo(() => (rows ?? []).map(parseChartSource), [rows]);
}

export function useMapStyle() {
  const sources = useChartSources();
  const mapStyleId = useViewOptions((s) => s.mapStyleId);

  return useMemo(() => {
    const source =
      sources.find((s) => s.id === mapStyleId) ?? sources[0];
    if (!source) return { version: 8 as const, sources: {}, layers: [] };
    return buildMapStyle(source);
  }, [sources, mapStyleId]);
}
