import useTheme from "@/hooks/useTheme";
import { Annotation } from "@/map/components/Annotation";
import { useBounds } from "@/map/hooks/useCameraView";
import { useSelection, useSelectionHandler } from "@/map/hooks/useSelection";
import { updateMarker, useMarkers } from "@/markers/hooks/useMarkers";
import type { SFSymbol } from "expo-symbols";

const DEFAULT_ICON: SFSymbol = "mappin";

export default function MarkerOverlay() {
  const bounds = useBounds({ buffer: 0.5, hysteresis: 0.1 });
  const markers = useMarkers({ bounds });
  const selection = useSelection();
  const selectedId = selection?.type === "marker" ? Number(selection.id) : null;
  const theme = useTheme();
  const navigate = useSelectionHandler();

  return (
    <>
      {markers.map((marker) => {
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
