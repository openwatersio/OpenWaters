import type { CatalogSource } from "@/catalog/types";
import { File } from "expo-file-system";
import { generateStyle } from "@/lib/charts/install";
import {
  chartDirectory,
  readCatalog,
  writeStyle,
  setChart,
  getChart,
  type InstalledChart,
} from "@/lib/charts/store";

/** Map of source ID → local MBTiles path for a given chart */
export type LocalPaths = Record<string, string>;

/**
 * Read the stored local paths for a chart's downloaded MBTiles.
 * Stored as a simple JSON file alongside style.json and catalog.json.
 */
export function readLocalPaths(chartId: string): LocalPaths {
  const file = new File(chartDirectory(chartId), "local-paths.json");
  if (!file.exists) return {};
  return JSON.parse(file.textSync()) as LocalPaths;
}

/** Write the local paths file for a chart */
function writeLocalPaths(chartId: string, paths: LocalPaths): void {
  const file = new File(chartDirectory(chartId), "local-paths.json");
  file.write(JSON.stringify(paths));
}

/**
 * Record a downloaded MBTiles file for a source ID, then regenerate the style.
 */
export async function recordDownload(
  chartId: string,
  sourceId: string,
  localPath: string,
): Promise<void> {
  const paths = readLocalPaths(chartId);
  paths[sourceId] = localPath;
  writeLocalPaths(chartId, paths);
  await regenerateStyle(chartId);
}

/**
 * Remove a downloaded MBTiles record for a source ID, then regenerate the style.
 * Does NOT delete the MBTiles file — caller is responsible for that.
 */
export async function removeDownloadRecord(
  chartId: string,
  sourceId: string,
): Promise<void> {
  const paths = readLocalPaths(chartId);
  delete paths[sourceId];
  writeLocalPaths(chartId, paths);
  await regenerateStyle(chartId);
}

/**
 * Regenerate style.json for a chart by reading catalog.json and local-paths.json,
 * merging downloaded MBTiles into the source list, and writing a new style.
 *
 * Updates the chart store so the map re-renders.
 */
export async function regenerateStyle(chartId: string): Promise<void> {
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

  const style = await generateStyle(sources);
  const styleUri = writeStyle(chartId, style);

  // Update the store so the map re-renders
  const existing = getChart(chartId);
  if (existing) {
    const updated: InstalledChart = { ...existing, styleUri };
    setChart(updated);
  }
}
