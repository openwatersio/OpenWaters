import {
  createDownloadResumable,
  documentDirectory,
  type DownloadProgressData,
  type DownloadResumable,
} from "expo-file-system/legacy";
import { ensureMBTilesDirectory, readMBTilesMetadata } from "@/lib/charts/mbtiles";

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
  sourceId: string,
  url: string,
  callbacks?: DownloadCallbacks,
): Promise<string> {
  // Ensure the mbtiles directory exists
  const dir = ensureMBTilesDirectory();

  // Generate a unique filename
  const filename = `${sourceId}-${Date.now().toString(36)}.mbtiles`;
  const localUri = `${documentDirectory}mbtiles/${filename}`;

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

  activeDownloads.set(sourceId, download);

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
    activeDownloads.delete(sourceId);
  }
}

/**
 * Cancel an active download for the given source ID.
 * No-ops if no download is active.
 */
export async function cancelDownload(sourceId: string): Promise<void> {
  const download = activeDownloads.get(sourceId);
  if (download) {
    await download.cancelAsync();
    activeDownloads.delete(sourceId);
  }
}

/** Check whether a download is active for the given source ID */
export function isDownloading(sourceId: string): boolean {
  return activeDownloads.has(sourceId);
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
