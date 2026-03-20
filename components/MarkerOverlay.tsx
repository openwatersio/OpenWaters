import { Annotation } from "@/components/map/Annotation";
import { useCameraView } from "@/hooks/useCameraView";
import { updateMarker, useMarkers } from "@/hooks/useMarkers";
import { useSelection } from "@/hooks/useSelection";
import useTheme from "@/hooks/useTheme";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { useMemo } from "react";

const DEFAULT_ICON: SFSymbol = "mappin";
// Fraction of the viewport to extend bounds by, to avoid pop-in while panning
const BOUNDS_BUFFER = 0.5;

function isInBounds(lat: number, lng: number, bounds: LngLatBounds): boolean {
  const [west, south, east, north] = bounds;
  const latBuf = (north - south) * BOUNDS_BUFFER;
  const lngBuf = (east - west) * BOUNDS_BUFFER;
  return lat >= south - latBuf && lat <= north + latBuf
    && lng >= west - lngBuf && lng <= east + lngBuf;
}

export default function MarkerOverlay() {
  const markers = useMarkers((s) => s.markers);
  const selection = useSelection();
  const selectedId = selection?.type === "marker" ? selection.id : null;
  const bounds = useCameraView((s) => s.bounds);
  const theme = useTheme();

  const visible = useMemo(() => {
    if (!bounds) return markers;
    return markers.filter((m) => isInBounds(m.latitude, m.longitude, bounds));
  }, [markers, bounds]);

  return (
    <>
      {visible.map((marker) => {
        const isSelected = marker.id === selectedId;
        return (
          <Annotation
            key={marker.id}
            id={`marker-${marker.id}`}
            lngLat={[marker.longitude, marker.latitude]}
            icon={(marker.icon as SFSymbol | null) ?? DEFAULT_ICON}
            color={marker.color ?? theme.primary}
            selected={isSelected}
            draggable={isSelected}
            onPress={isSelected ? undefined : () => {
              const href = { pathname: "/marker/[id]" as const, params: { id: marker.id } };
              if (selection?.type === "marker") {
                router.setParams({ id: marker.id });
              } else if (selection) {
                router.replace(href);
              } else {
                router.navigate(href);
              }
            }}
            onDragEnd={(e) => {
              const [lng, lat] = e.nativeEvent.lngLat;
              updateMarker(marker.id, { latitude: lat, longitude: lng });
            }}
          />
        );
      })}
    </>
  );
}
