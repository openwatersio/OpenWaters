import {
  useChartStore,
  type InstalledChart,
} from "@/lib/charts/store";
import { useMemo } from "react";

export type { InstalledChart };

/** Get all installed charts as a sorted array */
export function useCharts(): InstalledChart[] {
  const charts = useChartStore((s) => s.charts);
  return useMemo(
    () => Object.values(charts).sort((a, b) => a.name.localeCompare(b.name)),
    [charts],
  );
}

/** Get a single installed chart by ID */
export function useChart(chartId: string): InstalledChart | undefined {
  return useChartStore((s) => s.charts[chartId]);
}

/**
 * Get the style URI for the currently selected chart.
 *
 * Returns the file:// URI to the chart's style.json on disk.
 * Falls back to the first chart if none is selected.
 */
export function useMapStyle(): string {
  const charts = useCharts();
  const selectedChartId = useChartStore((s) => s.selectedChartId);

  return useMemo(() => {
    const chart =
      charts.find((c) => c.id === selectedChartId) ?? charts[0];

    if (!chart) {
      // No charts installed — return a minimal empty style as a data URI
      return "data:application/json," + encodeURIComponent(
        JSON.stringify({ version: 8, sources: {}, layers: [] }),
      );
    }

    return chart.styleUri;
  }, [charts, selectedChartId]);
}
