import type { LngLatBounds, OfflinePack, OfflinePackStatus } from "@maplibre/maplibre-react-native";
import {
  createTilePack,
  deleteTilePack,
  getTilePacks,
  pauseTilePack,
  resumeTilePack,
  type PackInfo,
} from "@/charts/offline";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

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

export const useOfflinePacks = create<OfflinePacksStoreState>()(() => ({
  packs: {},
  loading: true,
}));

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
  useOfflinePacks.setState({ loading: true });
  const infos = await getTilePacks();
  const packs: Record<string, TilePackState> = {};
  for (const info of infos) {
    packs[info.pack.id] = packStateFromInfo(info);
  }
  useOfflinePacks.setState({ packs, loading: false });
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
      useOfflinePacks.setState((s) => ({
        packs: {
          ...s.packs,
          [_pack.id]: {
            ...s.packs[_pack.id],
            status,
          },
        },
      }));

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
      console.warn(`Tile pack error for ${chartId}:`, error.message);
    },
  );

  // Add to store, preserving any status already recorded by the progress callback
  useOfflinePacks.setState((s) => ({
    packs: {
      ...s.packs,
      [pack.id]: {
        packId: pack.id,
        chartId,
        downloadedAt: Date.now(),
        status: s.packs[pack.id]?.status ?? null,
      },
    },
  }));
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
  useOfflinePacks.setState((s) => {
    const { [packId]: _, ...rest } = s.packs;
    return { packs: rest };
  });
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Get all packs for a specific chart */
export function usePacksForChart(chartId: string): TilePackState[] {
  return useOfflinePacks(
    useShallow((s) =>
      Object.values(s.packs).filter((p) => p.chartId === chartId),
    ),
  );
}
