import type { CatalogSource } from "@/charts/catalog/types";
import { generateStyle } from "@/charts/install";
import type { SourceFilters } from "@/charts/sources";
import {
  chartDirectory,
  getChart,
  readCatalog,
  setChart,
  writeStyle,
  type InstalledChart,
} from "@/charts/store";
import { File } from "expo-file-system";

/** Map of source ID → local MBTiles path for a given chart */
export type LocalPaths = Record<string, string>;

/**
 * Derive local paths by scanning the chart directory for `.mbtiles` files.
 * Filenames are `${sourceId}.mbtiles`, so the source ID is the stem.
 */
export function readLocalPaths(chartId: string): LocalPaths {
  const dir = chartDirectory(chartId);
  if (!dir.exists) return {};

  const paths: LocalPaths = {};
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.name.endsWith(".mbtiles")) {
      const sourceId = entry.name.slice(0, -".mbtiles".length);
      // Normalize to the absolute path form MapLibre expects
      let path = entry.uri;
      if (path.startsWith("file://")) {
        path = path.slice("file://".length);
      }
      if (path.startsWith("/var/")) {
        path = `/private${path}`;
      }
      paths[sourceId] = path;
    }
  }
  return paths;
}

/**
 * Delete a downloaded MBTiles file and regenerate the style.
 */
export async function deleteDownload(
  chartId: string,
  sourceId: string,
): Promise<void> {
  const file = new File(chartDirectory(chartId), `${sourceId}.mbtiles`);
  if (file.exists) {
    file.delete();
  }
  await regenerateStyle(chartId);
}

/**
 * Regenerate style.json for a chart by reading catalog.json and scanning
 * the chart directory for downloaded MBTiles, then writing a new style.
 *
 * Updates the chart store so the map re-renders.
 */
export async function regenerateStyle(
  chartId: string,
  filters: SourceFilters = {},
): Promise<void> {
  const catalog = readCatalog(chartId);
  if (!catalog) return;

  const localPaths = readLocalPaths(chartId);

  // Build a modified source list where downloaded MBTiles have local paths
  const sources: CatalogSource[] = catalog.sources.map((source) => {
    if (
      (source.type === "mbtiles" || source.type === "pmtiles") &&
      localPaths[source.id]
    ) {
      return { ...source, url: localPaths[source.id] };
    }
    return source;
  });

  const style = await generateStyle(sources, filters);
  const styleUri = writeStyle(chartId, style);

  // Update the store so the map re-renders
  const existing = getChart(chartId);
  if (existing) {
    const updated: InstalledChart = { ...existing, styleUri };
    setChart(updated);
  }
}
