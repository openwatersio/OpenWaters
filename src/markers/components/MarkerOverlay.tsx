import { isInsideBounds } from "@/geo";
import useTheme from "@/hooks/useTheme";
import { Annotation } from "@/map/components/Annotation";
import { useCameraView } from "@/map/hooks/useCameraView";
import { useSelection, useSelectionHandler } from "@/map/hooks/useSelection";
import { updateMarker, useMarkers } from "@/markers/hooks/useMarkers";
import type { SFSymbol } from "expo-symbols";
import { useMemo } from "react";

const DEFAULT_ICON: SFSymbol = "mappin";
// Fraction of the viewport to extend bounds by, to avoid pop-in while panning
const BOUNDS_BUFFER = 0.5;

export default function MarkerOverlay() {
  const markers = useMarkers();
  const selection = useSelection();
  const selectedId = selection?.type === "marker" ? Number(selection.id) : null;
  const bounds = useCameraView().bounds;
  const theme = useTheme();
  const navigate = useSelectionHandler();

  const visible = useMemo(() => {
    if (!bounds) return markers;
    return markers.filter((m) => isInsideBounds(m, bounds, BOUNDS_BUFFER));
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
