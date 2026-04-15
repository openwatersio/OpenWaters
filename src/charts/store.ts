import type { CatalogEntry } from "@/charts/catalog/types";
import { persistProxy } from "@/persistProxy";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { Directory, File, Paths } from "expo-file-system";
import { proxy, useSnapshot } from "valtio";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstalledChart = {
  /** Directory name under charts/, e.g. "noaa-raster" */
  id: string;
  /** Human-readable name */
  name: string;
  /** file:// URI to style.json */
  styleUri: string;
  /** Catalog entry if installed from catalog (undefined for manual charts) */
  catalogEntry?: CatalogEntry;
};

// ---------------------------------------------------------------------------
// Filesystem layout
// ---------------------------------------------------------------------------

const CHARTS_DIR = "charts";

function chartsDirectory(): Directory {
  return new Directory(Paths.document, CHARTS_DIR);
}

export function ensureChartsDirectory(): Directory {
  const dir = chartsDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

export function chartDirectory(chartId: string): Directory {
  return new Directory(ensureChartsDirectory(), chartId);
}

function styleFile(chartId: string): File {
  return new File(chartDirectory(chartId), "style.json");
}

function catalogFile(chartId: string): File {
  return new File(chartDirectory(chartId), "catalog.json");
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

/** Read and parse a style.json from disk. Returns null if the file is missing. */
export function readStyle(chartId: string): StyleSpecification | null {
  const file = styleFile(chartId);
  if (!file.exists) return null;
  return JSON.parse(file.textSync()) as StyleSpecification;
}

/** Read and parse a catalog.json from disk. Returns undefined if missing. */
export function readCatalog(chartId: string): CatalogEntry | undefined {
  const file = catalogFile(chartId);
  if (!file.exists) return undefined;
  return JSON.parse(file.textSync()) as CatalogEntry;
}

/**
 * Write a style.json atomically (write to .tmp, then rename).
 * Creates the chart directory if it doesn't exist.
 */
export function writeStyle(
  chartId: string,
  style: StyleSpecification,
): string {
  const dir = chartDirectory(chartId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  const tmp = new File(dir, "style.tmp.json");
  const dest = styleFile(chartId);
  tmp.write(JSON.stringify(style));
  if (dest.exists) dest.delete();
  tmp.move(dest);
  return dest.uri;
}

/** Write a catalog.json. Creates the chart directory if it doesn't exist. */
export function writeCatalog(chartId: string, entry: CatalogEntry): void {
  const dir = chartDirectory(chartId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  const file = catalogFile(chartId);
  file.write(JSON.stringify(entry));
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ChartStoreState {
  /** Map from chart ID to installed chart metadata */
  charts: Record<string, InstalledChart>;
  /** Currently selected chart ID */
  selectedChartId?: string;
}

export const chartStoreState = proxy<ChartStoreState>({
  charts: {},
  selectedChartId: undefined,
});

persistProxy<ChartStoreState, { selectedChartId?: string }>(chartStoreState, {
  name: "chart-store",
  // Only persist the selectedChartId — `charts` is rebuilt from disk on launch.
  partialize: (state) => ({ selectedChartId: state.selectedChartId }),
  hydrate: (state, persisted) => {
    if (persisted?.selectedChartId) {
      state.selectedChartId = persisted.selectedChartId;
    }
    initializeCharts();
  },
});

export function useChartStore() {
  return useSnapshot(chartStoreState);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Scan the charts directory and rebuild the index */
export function initializeCharts(): void {
  const dir = ensureChartsDirectory();
  const charts: Record<string, InstalledChart> = {};

  for (const entry of dir.list()) {
    if (!(entry instanceof Directory)) continue;

    const chartId = entry.uri.split("/").filter(Boolean).pop()!;
    const style = styleFile(chartId);
    if (!style.exists) continue;

    const catalog = readCatalog(chartId);

    charts[chartId] = {
      id: chartId,
      name: catalog?.title ?? chartId,
      styleUri: style.uri,
      catalogEntry: catalog,
    };
  }

  chartStoreState.charts = charts;
  if (chartStoreState.selectedChartId && !charts[chartStoreState.selectedChartId]) {
    chartStoreState.selectedChartId = undefined;
  }
}

/** Add or update a chart in the index */
export function setChart(chart: InstalledChart): void {
  chartStoreState.charts[chart.id] = chart;
}

/** Remove a chart from the index */
export function removeChart(chartId: string): void {
  delete chartStoreState.charts[chartId];
  if (chartStoreState.selectedChartId === chartId) {
    chartStoreState.selectedChartId = undefined;
  }
}

/** Set the selected chart */
export function selectChart(chartId: string | undefined): void {
  chartStoreState.selectedChartId = chartId;
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Get all installed charts as an array, ordered by name */
export function getCharts(): InstalledChart[] {
  return Object.values(chartStoreState.charts).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Get a single chart by ID */
export function getChart(chartId: string): InstalledChart | undefined {
  return chartStoreState.charts[chartId];
}
