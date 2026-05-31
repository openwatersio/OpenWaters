import { readStyle, useChartStore } from "@/charts/store";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";

/**
 * The on-disk style + id for the currently selected chart, for rendering
 * feature thumbnails. Read and parsed once per chart so a list of thumbnails
 * doesn't re-read the style file per row; the id is returned alongside as a
 * cache discriminator (feature ids overlap across charts).
 */
export function useChartThumbnailStyle(): {
  style: StyleSpecification | null;
  chartId?: string;
} {
  const { selectedChartId } = useChartStore();
  const style = useMemo(
    () => (selectedChartId ? readStyle(selectedChartId) : null),
    [selectedChartId],
  );
  return { style, chartId: selectedChartId };
}
