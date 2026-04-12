import { useDbQuery } from "@/hooks/useDbQuery";
import { useCameraView } from "@/hooks/useCameraView";
import {
  buildMapStyle,
  parseChart,
  type Chart,
} from "@/lib/charts/sources";
import { selectSources } from "@/lib/charts/provider";
import { getAllChartsWithSources, getChartWithSources } from "@/lib/database";
import { useViewOptions } from "@/hooks/useViewOptions";
import { useCallback, useMemo } from "react";

export type { Chart };

export function useChart(id: number): Chart | undefined {
  const fetch = useCallback(() => getChartWithSources(id), [id]);
  const row = useDbQuery(["charts", "sources"], fetch);
  return useMemo(
    () => (row ? parseChart(row, row.sources) : undefined),
    [row],
  );
}

export function useCharts(): Chart[] {
  const fetch = useCallback(() => getAllChartsWithSources(), []);
  const rows = useDbQuery(["charts", "sources"], fetch);
  return useMemo(
    () => (rows ?? []).map((r) => parseChart(r, r.sources)),
    [rows],
  );
}

export function useMapStyle() {
  const charts = useCharts();
  const mapStyleId = useViewOptions((s) => s.mapStyleId);
  const bounds = useCameraView((s) => s.bounds);

  return useMemo(() => {
    const chart =
      charts.find((c) => c.id === mapStyleId) ?? charts[0];
    if (!chart || chart.sources.length === 0) {
      return { version: 8 as const, sources: {}, layers: [] };
    }

    const viewport = bounds ? { bounds } : undefined;
    const active = selectSources(chart.sources, viewport);

    if (active.length === 0) {
      // All sources were filtered out — fall back to full set
      return buildMapStyle(chart.sources);
    }

    return buildMapStyle(active);
  }, [charts, mapStyleId, bounds]);
}
