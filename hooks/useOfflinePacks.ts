import type { OfflinePack, OfflinePackStatus } from "@maplibre/maplibre-react-native";
import {
  createTilePack,
  deleteTilePack,
  getTilePacks,
  type PackInfo,
  type PackMetadata,
} from "@/lib/charts/offline";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
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

/** Start downloading tiles for the visible area of a chart */
export async function downloadVisibleArea(
  chartId: string,
  styleUri: string,
  bounds: LngLatBounds,
  minZoom: number,
  maxZoom: number,
): Promise<void> {
  const pack = await createTilePack(
    chartId,
    styleUri,
    bounds,
    minZoom,
    maxZoom,
    (_pack: OfflinePack, status: OfflinePackStatus) => {
      useOfflinePacks.setState((s) => ({
        packs: {
          ...s.packs,
          [_pack.id]: {
            ...s.packs[_pack.id],
            status,
          },
        },
      }));
    },
    (_pack: OfflinePack, error) => {
      console.warn(`Tile pack error for ${chartId}:`, error.message);
    },
  );

  // Add to store immediately
  useOfflinePacks.setState((s) => ({
    packs: {
      ...s.packs,
      [pack.id]: {
        packId: pack.id,
        chartId,
        downloadedAt: Date.now(),
        status: null,
      },
    },
  }));
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
