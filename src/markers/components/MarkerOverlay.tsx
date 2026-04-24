import useTheme from "@/hooks/useTheme";
import { Annotation } from "@/map/components/Annotation";
import { useSelection, useSelectionHandler } from "@/map/hooks/useSelection";
import { updateMarker, useMarker, useMarkers } from "@/markers/hooks/useMarkers";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo } from "react";
import type { NativeSyntheticEvent } from "react-native";

/** Map AnnotationIcon names to MapLibre sprite image IDs. Icons without a
 *  sprite fall back to marker-pin (the default). */
function markerIconImage(icon: string | null): string {
  if (!icon) return "marker-pin";
  return `marker-${icon}`;
}

export default function MarkerOverlay() {
  const markers = useMarkers();
  const theme = useTheme();
  const selection = useSelection();
  const navigate = useSelectionHandler();

  const selectedId = selection?.type === "marker" ? Number(selection.id) : null;
  const selectedMarker = useMarker(selectedId ?? 0);
  const showSelectedAnnotation = selectedId != null && selectedMarker != null;

  // Build GeoJSON FeatureCollection from all markers.
  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = markers.map((marker) => ({
      type: "Feature" as const,
      properties: {
        id: marker.id,
        icon: markerIconImage(marker.icon),
        color: marker.color ? theme.adapt(marker.color) : theme.markers,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [marker.longitude, marker.latitude],
      },
    }));
    return { type: "FeatureCollection", features };
  }, [markers, theme.markers, theme.adapt]);

  const handlePress = useCallback(
    (e: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
      const id = e.nativeEvent.features?.[0]?.properties?.id;
      if (id != null) {
        e.stopPropagation();
        navigate("marker", String(id));
      }
    },
    [navigate],
  );

  return (
    <>
      <GeoJSONSource
        id="markers"
        data={geojson}
        hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }}
        onPress={handlePress}
      >
        {/* Unselected: colored circle with white halo */}
        <Layer
          id="markers-circle"
          type="circle"
          filter={
            selectedId != null
              ? ["!=", ["get", "id"], selectedId]
              : undefined
          }
          paint={{
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              4, 4,
              18, 12,
            ],
            "circle-color": ["get", "color"],
            "circle-stroke-width": [
              "interpolate", ["linear"], ["zoom"],
              4, 0.2,
              18, 2,
            ],
            "circle-stroke-color": theme.contrast,
          }}
        />
        {/* Unselected: contrast-colored icon on top of circle */}
        <Layer
          id="markers-symbol"
          type="symbol"
          filter={
            selectedId != null
              ? ["!=", ["get", "id"], selectedId]
              : undefined
          }
          layout={{
            "icon-image": ["get", "icon"],
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              4, 0.1,
              18, 0.4,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.contrast,
          }}
        />
      </GeoJSONSource>

      {/* Single interactive Annotation for the selected marker only.
          Provides drag support and the detail accessory. One UIView is
          negligible; the perf issue was 300 of them. */}
      {showSelectedAnnotation && (
        <Annotation
          id="selected-marker"
          lngLat={[selectedMarker.longitude, selectedMarker.latitude]}
          icon={selectedMarker.icon ?? "pin"}
          color={selectedMarker.color ? theme.adapt(selectedMarker.color) : theme.markers}
          selected
          draggable
          onPress={() => navigate("marker", String(selectedMarker.id))}
          onDragEnd={(e) => {
            const [longitude, latitude] = e.nativeEvent.lngLat;
            updateMarker(selectedMarker.id, { latitude, longitude });
          }}
        />
      )}
    </>
  );
}
