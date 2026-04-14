import {
  cancelDownload,
  downloadMBTiles,
  type DownloadProgress,
} from "@/lib/charts/download";
import { regenerateStyle } from "@/lib/charts/style";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadState = {
  status: "downloading" | "complete" | "error";
  progress?: DownloadProgress;
  error?: string;
};

interface DownloadsStoreState {
  /** Active and recently completed downloads, keyed by "chartId:sourceId" */
  downloads: Record<string, DownloadState>;
}

// ---------------------------------------------------------------------------
// Store (ephemeral — not persisted)
// ---------------------------------------------------------------------------

export const useDownloads = create<DownloadsStoreState>()(() => ({
  downloads: {},
}));

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function downloadKey(chartId: string, sourceId: string): string {
  return `${chartId}:${sourceId}`;
}

function setDownloadState(key: string, state: DownloadState): void {
  useDownloads.setState((s) => ({
    downloads: { ...s.downloads, [key]: state },
  }));
}

function clearDownloadState(key: string): void {
  useDownloads.setState((s) => {
    const { [key]: _, ...rest } = s.downloads;
    return { downloads: rest };
  });
}

/**
 * Start downloading an MBTiles source for a chart.
 * Updates the store with progress as the download proceeds.
 * On completion, records the local path and regenerates the style.
 */
export async function startDownload(
  chartId: string,
  sourceId: string,
  url: string,
): Promise<void> {
  const key = downloadKey(chartId, sourceId);

  setDownloadState(key, { status: "downloading" });

  try {
    await downloadMBTiles(chartId, sourceId, url, {
      onProgress: (progress) => {
        setDownloadState(key, { status: "downloading", progress });
      },
    });

    // Record the download and regenerate the style
    await regenerateStyle(chartId);

    setDownloadState(key, { status: "complete" });

    // Clear the completed state after a brief delay
    setTimeout(() => clearDownloadState(key), 2000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Download was cancelled") {
      clearDownloadState(key);
    } else {
      setDownloadState(key, { status: "error", error: message });
    }
  }
}

/**
 * Cancel an active download.
 */
export async function stopDownload(
  chartId: string,
  sourceId: string,
): Promise<void> {
  await cancelDownload(chartId, sourceId);
  clearDownloadState(downloadKey(chartId, sourceId));
}

/**
 * Delete a downloaded MBTiles file and regenerate the style.
 */
export { deleteDownload } from "@/lib/charts/style";

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Get the download state for a specific source */
export function getDownloadState(
  chartId: string,
  sourceId: string,
): DownloadState | undefined {
  return useDownloads.getState().downloads[downloadKey(chartId, sourceId)];
}
