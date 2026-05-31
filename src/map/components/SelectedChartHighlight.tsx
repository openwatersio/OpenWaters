import useTheme from "@/hooks/useTheme";
import { useSelectedFeature } from "@/map/hooks/useSelectedFeature";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import type { Feature, FeatureCollection } from "geojson";

/**
 * Traces the selected chart feature's geometry on the map: a fill tints areas
 * and a casing traces lines (and area outlines). Point features need no overlay
 * — the draggable selection pin (`SelectedLocationAnnotation`) sits on the
 * coordinate and occludes the live symbol. The fill/line layers simply no-op on
 * point geometry, so no branching is needed. The geometry is resolved by the
 * detail sheet and shared via `useSelectedFeature`.
 *
 * TODO: replace the line/area overlay (and the selection pin's occlusion trick)
 * with MapLibre `feature-state` once it ships for iOS and is bridged in
 * maplibre-react-native (set a `selected` state on the feature and drive the
 * chart layers' own paint/visibility via `["feature-state", "selected"]`).
 * Tracking: maplibre-native #3858 (iOS, approved draft) and maplibre-react-native
 * #1491 (binding, deferred until native ships). Requires `promoteId: "LNAM"` on
 * the chart source for stable keys (tile-local ids vary by zoom; `["id"]` in
 * queries crashes v11.2). Note `global-state` is likewise unbridged (no runtime
 * setter on the map ref), so it isn't an alternative today.
 */
export default function SelectedChartHighlight() {
  const selected = useSelectedFeature();
  const theme = useTheme();

  if (!selected || selected.features.length === 0) return null;

  const features = selected.features as Feature[];
  const data: FeatureCollection = { type: "FeatureCollection", features };
  return (
    <GeoJSONSource id="selected-chart-highlight" data={data}>
      <Layer
        id="selected-chart-highlight-fill"
        type="fill"
        paint={{ "fill-color": theme.accent, "fill-opacity": 0.18 }}
      />
      <Layer
        id="selected-chart-highlight-line"
        type="line"
        paint={{
          "line-color": theme.accent,
          "line-width": 6,
          "line-opacity": 0.5,
        }}
        layout={{ "line-cap": "round", "line-join": "round" }}
      />
    </GeoJSONSource>
  );
}
