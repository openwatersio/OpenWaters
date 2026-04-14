import type { MBTilesSource, PMTilesSource } from "@/charts/catalog/types";
import { readCatalog } from "@/charts/store";
import { readLocalPaths } from "@/charts/style";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadableSource = (MBTilesSource | PMTilesSource) & {
  /** Whether this source has already been downloaded locally */
  downloaded: boolean;
  /** Local file path if downloaded */
  localPath?: string;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Given a chart ID, derive the list of sources available for download.
 *
 * Returns all mbtiles/pmtiles sources from the catalog, annotated with
 * whether they've been downloaded (by scanning the chart directory for .mbtiles files).
 */
export function useAvailableDownloads(chartId: string): DownloadableSource[] {
  // This hook currently reads from disk synchronously. The useMemo dep on
  // chartId ensures it recomputes when switching charts. For reactivity
  // after a download completes, the calling component should also depend
  // on the download store.
  return useMemo(() => getAvailableDownloads(chartId), [chartId]);
}

/** Non-hook version for use outside React components */
export function getAvailableDownloads(chartId: string): DownloadableSource[] {
  const catalog = readCatalog(chartId);
  if (!catalog) return [];

  const localPaths = readLocalPaths(chartId);

  return catalog.sources
    .filter(
      (s): s is MBTilesSource | PMTilesSource =>
        s.type === "mbtiles" || s.type === "pmtiles",
    )
    .map((source) => ({
      ...source,
      downloaded: source.id in localPaths,
      localPath: localPaths[source.id],
    }));
}

/**
 * Summary stats for a chart's offline data.
 */
export type OfflineSummary = {
  /** Total number of downloadable sources */
  totalRegions: number;
  /** Number of downloaded sources */
  downloadedRegions: number;
  /** Total size of downloaded files in bytes (estimated from catalog sizeBytes) */
  downloadedBytes: number;
  /** Total size of all available files in bytes */
  totalBytes: number;
};

export function getOfflineSummary(chartId: string): OfflineSummary {
  const sources = getAvailableDownloads(chartId);

  let downloadedRegions = 0;
  let downloadedBytes = 0;
  let totalBytes = 0;

  for (const source of sources) {
    const size = source.sizeBytes ?? 0;
    totalBytes += size;
    if (source.downloaded) {
      downloadedRegions++;
      downloadedBytes += size;
    }
  }

  return {
    totalRegions: sources.length,
    downloadedRegions,
    downloadedBytes,
    totalBytes,
  };
}
