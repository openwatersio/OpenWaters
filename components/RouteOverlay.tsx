import { Annotation, AnnotationProps } from "@/components/map/Annotation";
import { fitBounds } from "@/components/map/NavigationCamera";
import {
  removeRouteWaypoint,
  RouteMode,
  setActiveIndex,
  updateRouteWaypoint,
  useActiveRoute,
  type ActiveRoute,
  type ActiveWaypoint
} from "@/hooks/useRoutes";
import { useSheetStore } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { getBounds } from "geolib";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OverlayView from "./ui/OverlayView";

type Coord = [longitude: number, latitude: number];

/**
 * Renders the active route on the map. Reads from `useActiveRoute()` and
 * switches rendering based on `mode`:
 *  - editing   → dashed line + draggable waypoint annotations
 *  - navigating → completed/active/remaining segments + read-only waypoints
 */
export default function RouteOverlay() {
  const active = useActiveRoute();
  if (!active) return null;

  return active.mode === RouteMode.Navigating ? (
    <NavigatingOverlay active={active} />
  ) : (
    <EditingOverlay active={active} />
  );
}

// --- Editing overlay (in-memory, draggable) ---

function EditingOverlay({ active }: { active: ActiveRoute }) {
  const theme = useTheme();
  const points = active.points;
  const activeIndex = active.activeIndex;

  const sheetHeight = useSheetStore((s) => s.sheets["route"]?.height ?? 0);
  const insets = useSafeAreaInsets();

  const coords: Coord[] = useMemo(
    () => points.map((p) => [p.longitude, p.latitude]),
    [points],
  );

  // Fit camera to route bounds when the geometry changes.
  useEffect(() => {
    if (coords.length < 2) return;
    const { minLng, minLat, maxLng, maxLat } = getBounds(coords);
    const routeBounds: LngLatBounds = [minLng, minLat, maxLng, maxLat];
    // FIXME: this zooms way out and then back in. Figure out how to make the map movement minimal
    // FIXME: this should maybe only run on first load, not every coords change
    fitBounds(routeBounds, {
      padding: { top: insets.top + 16, right: 16, bottom: 16 + sheetHeight, left: 16 },
      duration: 300,
    });
  }, [coords, sheetHeight, insets]);

  const lineData = useMemo(() => {
    if (coords.length < 2) return null;
    return JSON.stringify({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    });
  }, [coords]);

  return (
    <>
      {lineData && (
        <GeoJSONSource id="route-edit-line" data={lineData}>
          <Layer
            id="route-edit-line-halo"
            type="line"
            paint={{ "line-width": 7, "line-opacity": 0.5, "line-color": theme.background }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="route-edit-line-dash"
            type="line"
            paint={{ "line-width": 3, "line-opacity": 1, "line-color": theme.primary, "line-dasharray": [2, 2] }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}

      {points.map((point, i) => (
        <WaypointAnnotation
          key={point.key}
          id={`route-wp-${point.key}`}
          point={point}
          index={i}
          color={theme.primary}
          selected={i === activeIndex}
          draggable
          onPress={() => setActiveIndex(i === activeIndex ? null : i)}
          onRemove={points.length > 1 ? () => removeRouteWaypoint(i) : undefined}
          onDragEnd={(e) => {
            const [longitude, latitude] = e.nativeEvent.lngLat;
            updateRouteWaypoint(i, { latitude, longitude });
          }}
        />
      ))}
    </>
  );
}

// --- Navigating overlay (segments + read-only waypoints) ---

function NavigatingOverlay({ active }: { active: ActiveRoute }) {
  const theme = useTheme();
  const points = active.points;
  const activePointIndex = active.activeIndex ?? 0;

  const sheetHeight = useSheetStore((s) => s.sheets["route-navigate"]?.height ?? 0);
  const insets = useSafeAreaInsets();

  const coords: Coord[] = useMemo(
    () => points.map((p) => [p.longitude, p.latitude]),
    [points],
  );

  // Fit bounds once when the route is loaded for navigation.
  useEffect(() => {
    if (coords.length < 2) return;
    const { minLng, minLat, maxLng, maxLat } = getBounds(coords);
    const routeBounds: LngLatBounds = [minLng, minLat, maxLng, maxLat];
    fitBounds(routeBounds, {
      padding: { top: insets.top + 16, right: 16, bottom: 16 + sheetHeight, left: 16 },
      duration: 300,
    });
  }, [coords, sheetHeight, insets]);

  const { completedLineData, activeLineData, remainingLineData } = useMemo(() => {
    if (coords.length < 2) {
      return { completedLineData: null, activeLineData: null, remainingLineData: null };
    }
    const completed = activePointIndex > 0 ? coords.slice(0, activePointIndex + 1) : null;
    const activeLeg =
      activePointIndex > 0
        ? [coords[activePointIndex - 1], coords[activePointIndex]]
        : null;
    const remaining = coords.slice(activePointIndex);

    return {
      completedLineData:
        completed && completed.length >= 2
          ? JSON.stringify({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: completed },
          })
          : null,
      activeLineData:
        activeLeg && activeLeg.length >= 2
          ? JSON.stringify({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: activeLeg },
          })
          : null,
      remainingLineData:
        remaining.length >= 2
          ? JSON.stringify({
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: remaining },
          })
          : null,
    };
  }, [coords, activePointIndex]);

  return (
    <>
      {completedLineData && (
        <GeoJSONSource id="route-completed" data={completedLineData}>
          <Layer
            id="route-completed-line"
            type="line"
            paint={{ "line-width": 3, "line-opacity": 0.3, "line-color": theme.primary }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}

      {activeLineData && (
        <GeoJSONSource id="route-active" data={activeLineData}>
          <Layer
            id="route-active-halo"
            type="line"
            paint={{ "line-width": 7, "line-opacity": 0.5, "line-color": theme.background }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="route-active-line"
            type="line"
            paint={{ "line-width": 4, "line-opacity": 1, "line-color": theme.primary }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}

      {remainingLineData && (
        <GeoJSONSource id="route-remaining" data={remainingLineData}>
          <Layer
            id="route-remaining-line"
            type="line"
            paint={{ "line-width": 3, "line-opacity": 0.7, "line-color": theme.primary, "line-dasharray": [2, 2] }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}

      {points.map((point, i) => {
        const isActive = i === activePointIndex;
        const isCompleted = i < activePointIndex;
        return (
          <WaypointAnnotation
            key={point.key}
            id={`route-wp-${point.key}`}
            point={point}
            index={i}
            color={isCompleted ? theme.textTertiary : theme.primary}
            selected={isActive}
          />
        );
      })}
    </>
  );
}

// --- Shared waypoint annotation ---

type WaypointAnnotationProps = Omit<AnnotationProps, "lngLat" | "accessory"> & {
  id: string;
  point: ActiveWaypoint;
  index: number;
  onRemove?: () => void;
};

function WaypointAnnotation({
  id,
  point,
  index,
  color,
  selected,
  draggable,
  onPress,
  onRemove,
  onDragEnd,
}: WaypointAnnotationProps) {
  const theme = useTheme();
  const lngLat: [number, number] = [point.longitude, point.latitude];

  const accessory = onRemove ? (
    <Pressable onPress={onRemove} style={waypointStyles.removeButton}>
      <OverlayView style={waypointStyles.removeButton}>
        <Text style={{ color: theme.danger, fontSize: 13, fontWeight: "600" }}>
          Remove
        </Text>
      </OverlayView>
    </Pressable>
  ) : null;

  return (
    <Annotation
      id={id}
      lngLat={lngLat}
      label={String(index + 1)}
      color={color}
      selected={selected}
      draggable={draggable}
      onPress={onPress}
      onDragEnd={onDragEnd}
      accessory={accessory}
    />
  );
}

const waypointStyles = StyleSheet.create({
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 30,
  },
});
