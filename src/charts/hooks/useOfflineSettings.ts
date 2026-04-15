import { persistProxy } from "@/persistProxy";
import { OfflineManager } from "@maplibre/maplibre-react-native";
import { proxy, useSnapshot } from "valtio";

interface OfflineSettingsState {
  /** Maximum ambient cache size in bytes. MapLibre default is 50 MB. */
  ambientCacheSize: number;
  /** Maximum tiles per pack. Infinity = unlimited. */
  tileCountLimit: number;
}

const DEFAULT_AMBIENT_CACHE = 250 * 1024 * 1024; // 250 MB
const DEFAULT_TILE_LIMIT = Infinity;

export const offlineSettingsState = proxy<OfflineSettingsState>({
  ambientCacheSize: DEFAULT_AMBIENT_CACHE,
  tileCountLimit: DEFAULT_TILE_LIMIT,
});

persistProxy(offlineSettingsState, {
  name: "offline-settings",
  hydrate: (state, persisted) => {
    if (persisted) Object.assign(state, persisted);
    applyOfflineSettings(state);
  },
});

export function useOfflineSettings() {
  return useSnapshot(offlineSettingsState);
}

/** Apply settings to MapLibre's OfflineManager */
function applyOfflineSettings(state: OfflineSettingsState): void {
  OfflineManager.setMaximumAmbientCacheSize(state.ambientCacheSize);
  OfflineManager.setTileCountLimit(
    Number.isFinite(state.tileCountLimit)
      ? state.tileCountLimit
      : Number.MAX_SAFE_INTEGER,
  );
}

export function setAmbientCacheSize(bytes: number): void {
  offlineSettingsState.ambientCacheSize = bytes;
  OfflineManager.setMaximumAmbientCacheSize(bytes);
}

export function setTileCountLimit(limit: number): void {
  offlineSettingsState.tileCountLimit = limit;
  OfflineManager.setTileCountLimit(
    Number.isFinite(limit) ? limit : Number.MAX_SAFE_INTEGER,
  );
}

/** Ambient cache size options in bytes */
export const AMBIENT_CACHE_OPTIONS = [
  { label: "50 MB", value: 50 * 1024 * 1024 },
  { label: "100 MB", value: 100 * 1024 * 1024 },
  { label: "250 MB", value: 250 * 1024 * 1024 },
  { label: "500 MB", value: 500 * 1024 * 1024 },
  { label: "1 GB", value: 1024 * 1024 * 1024 },
];

/** Tile count limit options */
export const TILE_LIMIT_OPTIONS = [
  { label: "10,000", value: 10_000 },
  { label: "50,000", value: 50_000 },
  { label: "100,000", value: 100_000 },
  { label: "Unlimited", value: Infinity },
];
