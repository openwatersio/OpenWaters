import { useNavigation } from "@/hooks/useNavigation";
import { isInsideBounds } from "@/lib/geo";
import type {
  InitialViewState,
  LngLatBounds,
  StyleSpecification,
} from "@maplibre/maplibre-react-native";
import { Camera, Map } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import type { ViewStyle } from "react-native";

type ChartPreviewProps = {
  mapStyle: StyleSpecification | string;
  /** Bounds of the source coverage [west, south, east, north] */
  bounds?: LngLatBounds;
  /** Zoom level for center-based views, default 6 */
  zoom?: number;
  style?: ViewStyle;
};

/**
 * A small, non-interactive map preview for chart listings and catalog entries.
 *
 * Centers on the user's current location if available and within the source
 * bounds. Otherwise falls back to the center of the source bounds.
 */
export default function ChartPreview({
  mapStyle,
  bounds,
  zoom = 6,
  style,
}: ChartPreviewProps) {
  const { latitude, longitude } = useNavigation.getState();

  const initialViewState = useMemo((): InitialViewState => {
    if (
      latitude != null &&
      longitude != null &&
      (!bounds || isInsideBounds({ latitude, longitude }, bounds))
    ) {
      return { center: [longitude, latitude], zoom };
    }

    if (bounds) return { bounds };

    return { center: [0, 0], zoom: 2 };
  }, [latitude, longitude, bounds, zoom]);

  return (
    <Map
      style={[{ width: "100%", height: "100%", borderRadius: 8 }, style]}
      mapStyle={mapStyle}
      dragPan={false}
      touchZoom={false}
      doubleTapZoom={false}
      doubleTapHoldZoom={false}
      touchRotate={false}
      touchPitch={false}
      attribution={false}
      logo={false}
      compass={false}
    >
      <Camera initialViewState={initialViewState} />
    </Map>
  );
}
