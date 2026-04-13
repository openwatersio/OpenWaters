import {
  OfflineManager,
  type LngLatBounds,
  type OfflinePack,
  type OfflinePackStatus,
} from "@maplibre/maplibre-react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PackMetadata = {
  chartId: string;
  downloadedAt: number;
};

export type PackInfo = {
  pack: OfflinePack;
  metadata: PackMetadata;
  status: OfflinePackStatus | null;
};

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let initialized = false;

/** Call once at app startup to configure OfflineManager defaults */
export function initOfflineManager(): void {
  if (initialized) return;
  initialized = true;
  // Remove the default 6,000 tile cap (Mapbox ToS holdover — doesn't apply to our sources)
  OfflineManager.setTileCountLimit(Infinity);
}

// ---------------------------------------------------------------------------
// Pack CRUD
// ---------------------------------------------------------------------------

/**
 * Download tiles for a chart's style within the given bounds and zoom range.
 * Returns the created OfflinePack.
 */
export async function createTilePack(
  chartId: string,
  styleUri: string,
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
  onProgress: (pack: OfflinePack, status: OfflinePackStatus) => void,
  onError: (pack: OfflinePack, error: { id: string; message: string }) => void,
): Promise<OfflinePack> {
  initOfflineManager();

  const metadata: PackMetadata = {
    chartId,
    downloadedAt: Date.now(),
  };

  return OfflineManager.createPack(
    {
      mapStyle: styleUri,
      bounds,
      minZoom,
      maxZoom,
      metadata,
    },
    onProgress,
    onError,
  );
}

/** Delete a tile pack by ID */
export async function deleteTilePack(packId: string): Promise<void> {
  await OfflineManager.deletePack(packId);
}

/** Get all tile packs, optionally filtered by chartId */
export async function getTilePacks(chartId?: string): Promise<PackInfo[]> {
  initOfflineManager();

  const packs = await OfflineManager.getPacks();
  const results: PackInfo[] = [];

  for (const pack of packs) {
    const metadata = pack.metadata as PackMetadata;
    if (chartId && metadata.chartId !== chartId) continue;

    let status: OfflinePackStatus | null = null;
    try {
      status = await pack.status();
    } catch {
      // Pack may be in an invalid state
    }

    results.push({ pack, metadata, status });
  }

  return results;
}

/** Delete all tile packs associated with a chart */
export async function deletePacksForChart(chartId: string): Promise<void> {
  const packs = await getTilePacks(chartId);
  for (const { pack } of packs) {
    try {
      await OfflineManager.deletePack(pack.id);
    } catch {
      // Best-effort cleanup
    }
  }
}
