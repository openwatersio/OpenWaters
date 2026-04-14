import { chartDirectory } from "@/lib/charts/store";
import { readMBTilesMetadata } from "@/lib/charts/mbtiles";
import {
  createDownloadResumable,
  type DownloadProgressData,
  type DownloadResumable,
} from "expo-file-system/legacy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DownloadProgress = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
};

export type DownloadCallbacks = {
  onProgress?: (progress: DownloadProgress) => void;
};

// ---------------------------------------------------------------------------
// Active downloads — keyed by source ID
// ---------------------------------------------------------------------------

const activeDownloads = new Map<string, DownloadResumable>();

/**
 * Download an MBTiles file from a remote URL.
 *
 * Returns the local absolute path to the downloaded file.
 * Throws if the download fails or is cancelled.
 */
export async function downloadMBTiles(
  chartId: string,
  sourceId: string,
  url: string,
  callbacks?: DownloadCallbacks,
): Promise<string> {
  const dir = chartDirectory(chartId);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  const filename = `${sourceId}.mbtiles`;
  const localUri = `${dir.uri}/${filename}`;

  const download = createDownloadResumable(
    url,
    localUri,
    {},
    (data: DownloadProgressData) => {
      callbacks?.onProgress?.({
        totalBytesWritten: data.totalBytesWritten,
        totalBytesExpectedToWrite: data.totalBytesExpectedToWrite,
      });
    },
  );

  const downloadKey = `${chartId}:${sourceId}`;
  activeDownloads.set(downloadKey, download);

  try {
    const result = await download.downloadAsync();
    if (!result) {
      throw new Error("Download was cancelled");
    }

    // Strip file:// scheme and normalize /var -> /private/var for MapLibre
    let path = result.uri;
    if (path.startsWith("file://")) {
      path = path.slice("file://".length);
    }
    if (path.startsWith("/var/")) {
      path = `/private${path}`;
    }

    // Verify the file is a valid MBTiles by reading its metadata
    await readMBTilesMetadata(path);

    // TODO: flag with NSURLIsExcludedFromBackupKey to prevent iCloud backup

    return path;
  } finally {
    activeDownloads.delete(downloadKey);
  }
}

/**
 * Cancel an active download.
 * No-ops if no download is active.
 */
export async function cancelDownload(chartId: string, sourceId: string): Promise<void> {
  const key = `${chartId}:${sourceId}`;
  const download = activeDownloads.get(key);
  if (download) {
    await download.cancelAsync();
    activeDownloads.delete(key);
  }
}

/** Check whether a download is active */
export function isDownloading(chartId: string, sourceId: string): boolean {
  return activeDownloads.has(`${chartId}:${sourceId}`);
}

/** Cancel all active downloads. Called on app teardown to prevent orphaned native tasks. */
export async function cancelAllDownloads(): Promise<void> {
  const entries = [...activeDownloads.entries()];
  activeDownloads.clear();
  for (const [, download] of entries) {
    try {
      await download.cancelAsync();
    } catch {
      // Best-effort cleanup
    }
  }
}
