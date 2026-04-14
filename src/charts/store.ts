import type { CatalogEntry } from "@/charts/catalog/types";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
// Zustand store
// ---------------------------------------------------------------------------

interface ChartStoreState {
  /** Map from chart ID to installed chart metadata */
  charts: Record<string, InstalledChart>;
  /** Currently selected chart ID */
  selectedChartId?: string;
}

export const useChartStore = create<ChartStoreState>()(
  persist(
    (): ChartStoreState => ({
      charts: {},
      selectedChartId: undefined,
    }),
    {
      name: "chart-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the selectedChartId — charts are rebuilt from disk
      partialize: (state) => ({ selectedChartId: state.selectedChartId }),
      onRehydrateStorage: () => {
        return (_state?: ChartStoreState, error?: unknown) => {
          if (!error) {
            initializeCharts();
          }
        };
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Actions (external, following project convention)
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

  const { selectedChartId } = useChartStore.getState();
  useChartStore.setState({
    charts,
    selectedChartId:
      selectedChartId && charts[selectedChartId]
        ? selectedChartId
        : undefined,
  });
}

/** Add or update a chart in the index */
export function setChart(chart: InstalledChart): void {
  useChartStore.setState((state) => ({
    charts: { ...state.charts, [chart.id]: chart },
  }));
}

/** Remove a chart from the index */
export function removeChart(chartId: string): void {
  useChartStore.setState((state) => {
    const { [chartId]: _, ...rest } = state.charts;
    return {
      charts: rest,
      selectedChartId:
        state.selectedChartId === chartId
          ? undefined
          : state.selectedChartId,
    };
  });
}

/** Set the selected chart */
export function selectChart(chartId: string | undefined): void {
  useChartStore.setState({ selectedChartId: chartId });
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Get all installed charts as an array, ordered by name */
export function getCharts(): InstalledChart[] {
  return Object.values(useChartStore.getState().charts).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Get a single chart by ID */
export function getChart(chartId: string): InstalledChart | undefined {
  return useChartStore.getState().charts[chartId];
}
