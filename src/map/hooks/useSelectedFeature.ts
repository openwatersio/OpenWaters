import type { Feature } from "geojson";
import { proxy, useSnapshot } from "valtio";

/**
 * The currently selected chart feature, resolved to real GeoJSON so the map can
 * draw a highlight for it. Published by the detail sheet (which already recovers
 * the geometry via `groupFeatures`) and consumed by `SelectedChartHighlight`
 * inside `<Map>` — the two live in separate React trees, so this store bridges
 * them.
 */
export type SelectedFeature = {
  /** Stable id of the primary (structure) feature. */
  lnam: string;
  /** The structure plus any related features (light, daymark, fog signal, …),
   *  primary first — drawn together so a buoy highlights with its light. */
  features: Feature[];
};

export const selectedFeatureState = proxy<{ current: SelectedFeature | null }>({
  current: null,
});

/** Publish the resolved selected feature group. */
export function setSelectedFeature(feature: SelectedFeature): void {
  selectedFeatureState.current = feature;
}

/**
 * Clear the highlight. Pass the `lnam` it was set with so a late unmount of a
 * previous selection doesn't clobber a newer one (only clears if still current).
 */
export function clearSelectedFeature(lnam?: string): void {
  if (!lnam || selectedFeatureState.current?.lnam === lnam) {
    selectedFeatureState.current = null;
  }
}

export function useSelectedFeature(): SelectedFeature | null {
  return useSnapshot(selectedFeatureState).current as SelectedFeature | null;
}
