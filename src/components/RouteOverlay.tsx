import { Annotation, AnnotationProps } from "@/components/map/Annotation";
import { useNavigationState } from "@/hooks/useNavigationState";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import {
  advanceToNext,
  clearActiveRoute,
  removeRouteWaypoint,
  RouteMode,
  setActiveIndex,
  stopNavigation,
  updateRouteWaypoint,
  useActiveRoute,
  type ActiveRoute,
  type ActiveWaypoint
} from "@/hooks/useRoutes";
import useTheme from "@/hooks/useTheme";
import { checkWaypointArrival } from "@/lib/waypointArrival";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
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
  useRouteCleanup();

  if (!active) return null;

  return active.mode === RouteMode.Navigating ? (
    <NavigatingOverlay active={active} />
  ) : (
    <EditingOverlay active={active} />
  );
}

/**
 * When the user lands back on "/" with a non-navigating active route,
 * either clear it (viewing) or re-present its editor (editing).
 * Uses a short delay to avoid racing with other navigation transitions.
 */
function useRouteCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    const timeout = setTimeout(() => {
      const route = useActiveRoute.getState();
      if (!route || route.mode === RouteMode.Navigating) return;

      if (route.mode === RouteMode.Viewing) {
        clearActiveRoute();
      } else if (route.mode === RouteMode.Editing) {
        router.navigate(route.id
          ? { pathname: "/route/[id]" as const, params: { id: route.id } }
          : "/route/new"
        );
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
    }
  }, [pathname]);
}

// --- Editing overlay (in-memory, draggable) ---

function EditingOverlay({ active }: { active: ActiveRoute }) {
  const theme = useTheme();
  const points = active.points;
  const activeIndex = active.activeIndex;

  const coords: Coord[] = useMemo(
    () => points.map((p) => [p.longitude, p.latitude]),
    [points],
  );



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

  useWaypointArrival(points, activePointIndex);

  const coords: Coord[] = useMemo(
    () => points.map((p) => [p.longitude, p.latitude]),
    [points],
  );

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

function useWaypointArrival(points: ActiveWaypoint[], activePointIndex: number) {
  const nav = useNavigationState();
  const arrivalRadius = usePreferredUnits((s) => s.arrivalRadius);
  const arriveOnCircleOnly = usePreferredUnits((s) => s.arriveOnCircleOnly);

  const targetPoint = points[activePointIndex] ?? null;
  const isLastPoint = activePointIndex >= points.length - 1;

  useEffect(() => {
    if (!nav.coords || !targetPoint) return;

    const arrival = checkWaypointArrival({
      position: nav.coords,
      previousWaypoint: activePointIndex > 0 ? points[activePointIndex - 1] : null,
      activeWaypoint: targetPoint,
      nextWaypoint:
        activePointIndex < points.length - 1 ? points[activePointIndex + 1] : null,
      arrivalRadius,
      arriveOnCircleOnly,
    });

    if (arrival.arrived) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isLastPoint) {
        stopNavigation();
      } else {
        advanceToNext();
      }
    }
  }, [
    nav.coords,
    targetPoint,
    isLastPoint,
    activePointIndex,
    points,
    arrivalRadius,
    arriveOnCircleOnly,
  ]);
}

const waypointStyles = StyleSheet.create({
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 30,
  },
});
