import log from "@/logger";
import type { LngLatBounds, OfflinePack, OfflinePackStatus } from "@maplibre/maplibre-react-native";

const logger = log.extend("charts");
import {
  createTilePack,
  deleteTilePack,
  getTilePacks,
  pauseTilePack,
  resumeTilePack,
  type PackInfo,
} from "@/charts/offline";
import { useMemo } from "react";
import { proxy, useSnapshot } from "valtio";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TilePackState = {
  packId: string;
  chartId: string;
  downloadedAt: number;
  status: OfflinePackStatus | null;
};

interface OfflinePacksStoreState {
  packs: Record<string, TilePackState>;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Store (ephemeral)
// ---------------------------------------------------------------------------

export const offlinePacksState = proxy<OfflinePacksStoreState>({
  packs: {},
  loading: true,
});

export function useOfflinePacks() {
  return useSnapshot(offlinePacksState);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function packStateFromInfo(info: PackInfo): TilePackState {
  return {
    packId: info.pack.id,
    chartId: info.metadata.chartId,
    downloadedAt: info.metadata.downloadedAt,
    status: info.status,
  };
}

/** Load all packs from OfflineManager and populate the store */
export async function loadPacks(): Promise<void> {
  offlinePacksState.loading = true;
  const infos = await getTilePacks();
  const packs: Record<string, TilePackState> = {};
  for (const info of infos) {
    packs[info.pack.id] = packStateFromInfo(info);
  }
  offlinePacksState.packs = packs;
  offlinePacksState.loading = false;
}

// Throttle: pause every THROTTLE_BATCH tiles for THROTTLE_DELAY_MS to avoid 429s.
const THROTTLE_BATCH = 50;
const THROTTLE_DELAY_MS = 1000;

/** Start downloading tiles for the visible area of a chart */
export async function downloadVisibleArea(
  chartId: string,
  styleUri: string,
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
): Promise<void> {
  let lastThrottleTile = 0;

  const pack = await createTilePack(
    chartId,
    styleUri,
    bounds,
    minZoom,
    maxZoom,
    async (_pack: OfflinePack, status: OfflinePackStatus) => {
      const existing = offlinePacksState.packs[_pack.id];
      offlinePacksState.packs[_pack.id] = {
        ...existing,
        status,
      } as TilePackState;

      // Throttle: pause briefly every N tiles to avoid overwhelming tile servers
      if (
        status.state === "active" &&
        status.completedTileCount - lastThrottleTile >= THROTTLE_BATCH
      ) {
        lastThrottleTile = status.completedTileCount;
        await _pack.pause();
        setTimeout(() => _pack.resume(), THROTTLE_DELAY_MS);
      }
    },
    (_pack: OfflinePack, error) => {
      logger.warn(`Tile pack error for ${chartId}:`, error.message);
    },
  );

  // Add to store, preserving any status already recorded by the progress callback
  const existingStatus = offlinePacksState.packs[pack.id]?.status ?? null;
  offlinePacksState.packs[pack.id] = {
    packId: pack.id,
    chartId,
    downloadedAt: Date.now(),
    status: existingStatus,
  };
}

/** Pause a tile pack download */
export async function pausePack(packId: string): Promise<void> {
  await pauseTilePack(packId);
}

/** Resume a paused tile pack download */
export async function resumePack(packId: string): Promise<void> {
  await resumeTilePack(packId);
}

/** Delete a tile pack and remove from store */
export async function removePack(packId: string): Promise<void> {
  await deleteTilePack(packId);
  delete offlinePacksState.packs[packId];
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Get all packs for a specific chart */
export function usePacksForChart(chartId: string): TilePackState[] {
  const { packs } = useSnapshot(offlinePacksState);
  return useMemo(
    () => Object.values(packs).filter((p) => p.chartId === chartId) as TilePackState[],
    [packs, chartId],
  );
}
