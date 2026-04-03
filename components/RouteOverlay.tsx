import { Annotation } from "@/components/map/Annotation";
import { fitBounds } from "@/components/map/NavigationCamera";
import {
  removeDraftPoint,
  selectDraftPoint,
  updateDraftPoint,
  useRouteDraft,
  type DraftWaypoint
} from "@/hooks/useRouteDraft";
import { useRouteNavigation } from "@/hooks/useRouteNavigation";
import { useSelection } from "@/hooks/useSelection";
import { useSheetStore } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { getRoutePoints, type RoutePoint } from "@/lib/database";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { getBounds } from "geolib";
import { useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Coord = [longitude: number, latitude: number];

export default function RouteOverlay() {
  const selection = useSelection();
  const selectedId = selection?.type === "route" ? Number(selection.id) : null;
  const activeRouteId = useRouteNavigation((s) => s.activeRouteId);
  const draftPoints = useRouteDraft((s) => s.points);

  const displayId = selectedId ?? activeRouteId;

  return (
    <>
      {displayId && <RouteDisplay routeId={displayId} isNavigation={displayId === activeRouteId} />}
      {draftPoints.length > 0 && <DraftRouteOverlay />}
    </>
  );
}

// --- Draft route overlay (in-memory, not yet saved) ---

function DraftRouteOverlay() {
  const theme = useTheme();
  const points = useRouteDraft((s) => s.points);
  const selectedIndex = useRouteDraft((s) => s.selectedIndex);
  const sheetHeight = useSheetStore((s) => {
    const entry = s.sheets["route-new"];
    return entry?.height ?? 0;
  });
  const insets = useSafeAreaInsets();

  const coords: Coord[] = useMemo(
    () => points.map((p) => [p.longitude, p.latitude]),
    [points],
  );

  // Fit camera to draft route bounds
  useEffect(() => {
    if (coords.length < 2) return;
    const { minLng, minLat, maxLng, maxLat } = getBounds(coords);
    const routeBounds: LngLatBounds = [minLng, minLat, maxLng, maxLat];
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
        <GeoJSONSource id="draft-route-line" data={lineData}>
          <Layer
            id="draft-route-line-halo"
            type="line"
            paint={{ "line-width": 7, "line-opacity": 0.5, "line-color": theme.background }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="draft-route-line-dash"
            type="line"
            paint={{ "line-width": 3, "line-opacity": 1, "line-color": theme.primary, "line-dasharray": [2, 2] }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}

      {points.map((point, i) => (
        <WaypointAnnotation
          key={i}
          id={`draft-wp-${i}`}
          point={point}
          color={theme.primary}
          selected={i === selectedIndex}
          draggable
          onPress={() => selectDraftPoint(i === selectedIndex ? null : i)}
          onRemove={points.length > 1 ? () => removeDraftPoint(i) : undefined}
          onDragEnd={(lngLat) => {
            updateDraftPoint(i, { latitude: lngLat[1], longitude: lngLat[0] });
          }}
        />
      ))}
    </>
  );
}

// --- Persisted route display ---

function RouteDisplay({ routeId, isNavigation }: { routeId: number; isNavigation: boolean }) {
  const theme = useTheme();
  const activePointIndex = useRouteNavigation((s) => s.activePointIndex);
  const sheetHeight = useSheetStore((s) => {
    const entry = s.sheets["feature"] ?? s.sheets["route-navigate"];
    return entry?.height ?? 0;
  });
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getRoutePoints(routeId).then(setPoints);
  }, [routeId]);

  const coords: Coord[] = useMemo(
    () => points.map((p) => [p.longitude, p.latitude]),
    [points],
  );

  // Fit camera to route bounds (only for selected, not navigation)
  useEffect(() => {
    if (isNavigation || coords.length < 2) return;
    const { minLng, minLat, maxLng, maxLat } = getBounds(coords);
    const routeBounds: LngLatBounds = [minLng, minLat, maxLng, maxLat];
    fitBounds(routeBounds, {
      padding: { top: insets.top + 16, right: 16, bottom: 16 + sheetHeight, left: 16 },
      duration: 300,
    });
  }, [coords, sheetHeight, insets, isNavigation]);

  // Route line data
  const { completedLineData, activeLineData, remainingLineData, fullLineData } = useMemo(() => {
    if (coords.length < 2) return { completedLineData: null, activeLineData: null, remainingLineData: null, fullLineData: null };

    if (!isNavigation) {
      return {
        completedLineData: null,
        activeLineData: null,
        remainingLineData: null,
        fullLineData: JSON.stringify({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        }),
      };
    }

    const completed = activePointIndex > 0
      ? coords.slice(0, activePointIndex + 1)
      : null;
    const active = activePointIndex > 0
      ? [coords[activePointIndex - 1], coords[activePointIndex]]
      : coords.length > 0 ? [coords[0]] : null;
    const remaining = coords.slice(activePointIndex);

    return {
      completedLineData: completed && completed.length >= 2
        ? JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: completed } })
        : null,
      activeLineData: active && active.length >= 2
        ? JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: active } })
        : null,
      remainingLineData: remaining.length >= 2
        ? JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: remaining } })
        : null,
      fullLineData: null,
    };
  }, [coords, isNavigation, activePointIndex]);

  return (
    <>
      {/* Full route line (non-navigation) */}
      {fullLineData && (
        <GeoJSONSource id="route-line" data={fullLineData}>
          <Layer
            id="route-line-halo"
            type="line"
            paint={{ "line-width": 7, "line-opacity": 0.5, "line-color": theme.background }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="route-line-dash"
            type="line"
            paint={{ "line-width": 3, "line-opacity": 1, "line-color": theme.primary, "line-dasharray": [2, 2] }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </GeoJSONSource>
      )}

      {/* Completed legs (dimmed) */}
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

      {/* Active leg (solid, bright) */}
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

      {/* Remaining legs (dashed) */}
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

      {/* Waypoint annotations */}
      {points.map((point, i) => {
        const isActive = isNavigation && i === activePointIndex;
        const isCompleted = isNavigation && i < activePointIndex;
        return (
          <WaypointAnnotation
            key={point.id}
            id={`route-wp-${point.id}`}
            point={point}
            color={isCompleted ? theme.textTertiary : theme.primary}
            selected={isActive}
          />
        );
      })}
    </>
  );
}

// --- Shared waypoint annotation ---

function WaypointAnnotation({
  id,
  point,
  color,
  selected,
  draggable,
  onPress,
  onRemove,
  onDragEnd,
}: {
  id: string;
  point: DraftWaypoint | RoutePoint;
  color: string;
  selected?: boolean;
  draggable?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  onDragEnd?: (lngLat: [number, number]) => void;
}) {
  return (
    <Annotation
      id={id}
      lngLat={[point.longitude, point.latitude]}
      icon="point"
      color={color}
      selected={selected}
      draggable={draggable}
      onPress={onPress}
      label={selected && onRemove ? "Remove" : undefined}
      onLabelPress={onRemove}
      onDragEnd={onDragEnd ? (e) => onDragEnd(e.nativeEvent.lngLat) : undefined}
    />
  );
}
