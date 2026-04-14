import { Annotation } from "@/components/map/Annotation";
import { useCameraView } from "@/hooks/useCameraView";
import { loadMarkers, updateMarker, useMarkers } from "@/hooks/useMarkers";
import { useSelection, useSelectionHandler } from "@/hooks/useSelection";
import useTheme from "@/hooks/useTheme";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import type { SFSymbol } from "expo-symbols";
import { useEffect, useMemo } from "react";

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
  useEffect(() => {
    loadMarkers();
  }, []);

  const markers = useMarkers((s) => s.markers);
  const selection = useSelection();
  const selectedId = selection?.type === "marker" ? Number(selection.id) : null;
  const bounds = useCameraView((s) => s.bounds);
  const theme = useTheme();
  const navigate = useSelectionHandler();

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
            onPress={() => navigate("marker", String(marker.id))}
            onDragEnd={(e) => {
              const [longitude, latitude] = e.nativeEvent.lngLat;
              updateMarker(marker.id, { latitude, longitude });
            }}
          />
        );
      })}
    </>
  );
}
