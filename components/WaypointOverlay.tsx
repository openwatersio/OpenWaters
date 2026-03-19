import { Annotation } from "@/components/map/Annotation";
import { useCameraView } from "@/hooks/useCameraView";
import useTheme from "@/hooks/useTheme";
import { useWaypoints } from "@/hooks/useWaypoints";
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

export default function WaypointOverlay() {
  const waypoints = useWaypoints((s) => s.waypoints);
  const selectedId = useWaypoints((s) => s.selectedWaypointId);
  const updateWaypoint = useWaypoints((s) => s.updateWaypoint);
  const bounds = useCameraView((s) => s.bounds);
  const theme = useTheme();

  const visible = useMemo(() => {
    if (!bounds) return waypoints;
    return waypoints.filter((w) => isInBounds(w.latitude, w.longitude, bounds));
  }, [waypoints, bounds]);

  return (
    <>
      {visible.map((waypoint) => {
        const isSelected = waypoint.id === selectedId;
        return (
          <Annotation
            key={waypoint.id}
            id={`waypoint-${waypoint.id}`}
            lngLat={[waypoint.longitude, waypoint.latitude]}
            icon={(waypoint.icon as SFSymbol | null) ?? DEFAULT_ICON}
            color={waypoint.color ?? theme.primary}
            selected={isSelected}
            draggable={isSelected}
            onSelected={() => console.log("SELECTED")}
            onDeselected={() => console.log("DESELECTED")}
            snippet="What does this do?"
            onPress={isSelected ? undefined : () => {
              selectedId ?
                router.setParams({ id: waypoint.id }) :
                router.navigate({ pathname: "/waypoint/[id]", params: { id: waypoint.id } });
            }}
            onDragEnd={(e) => {
              const [lng, lat] = e.nativeEvent.lngLat;
              updateWaypoint(waypoint.id, { latitude: lat, longitude: lng });
            }}
          />
        );
      })}
    </>
  );
}
