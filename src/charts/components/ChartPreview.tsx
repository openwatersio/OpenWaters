import { cameraViewState } from "@/map/hooks/useCameraView";
import { isInsideBounds } from "@/geo";
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
  style?: ViewStyle;
};

/**
 * A small, non-interactive map preview for chart listings and catalog entries.
 *
 * Shows the current camera view if it falls within the source bounds.
 * Otherwise falls back to the source bounds.
 */
export default function ChartPreview({
  mapStyle,
  bounds,
  style,
}: ChartPreviewProps) {
  const cameraBounds = cameraViewState.bounds;

  const initialViewState = useMemo((): InitialViewState => {
    if (cameraBounds) {
      const [west, south, east, north] = cameraBounds;
      const latitude = (south + north) / 2;
      const longitude = (west + east) / 2;
      if (!bounds || isInsideBounds({ latitude, longitude }, bounds)) {
        return { bounds: cameraBounds };
      }
    }

    if (bounds) return { bounds };

    return { center: [0, 0], zoom: 2 };
  }, [cameraBounds, bounds]);

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
