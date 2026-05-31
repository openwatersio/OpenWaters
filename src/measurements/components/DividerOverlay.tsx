import { formatBearing } from "@/geo";
import { toDistance, usePreferredUnits } from "@/hooks/usePreferredUnits";
import { createStyles } from "@/hooks/useStyles";
import useTheme from "@/hooks/useTheme";
import { iconSize } from "@/map/iconSize";
import { resolveSnapRefs } from "@/measurements/snapTargets";
import { ringCoords } from "@/measurements/units";
import {
  dividerState,
  dragLiveState,
  setDividerEndpoint,
  useDivider,
} from "@/measurements/useDivider";
import {
  Layer,
  Animated as MLAnimated,
  ViewAnnotation,
} from "@maplibre/maplibre-react-native";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useEffect, useMemo, useState } from "react";
import { Easing, Animated as RNAnimated, Text, View } from "react-native";
import { subscribe } from "valtio";

/** How often to re-resolve snapped endpoint positions to follow moving
 *  targets (AIS vessels, the user's own puck, etc.). 500 ms is responsive
 *  for sub-knot motion without flooding queryRenderedFeatures. */
const SNAP_POLL_INTERVAL_MS = 500;

/** Pixel distance from the radius marker to the distance/bearing label,
 *  along the line direction (past the marker, away from center). */
const LABEL_OFFSET_PX = 32;

/** Rendered size of each endpoint marker (the scope reticle), in CSS px. */
const MARKER_CSS_PX = 36;

/**
 * Renders the divider tool on the chart: line between two endpoints, faint
 * circle around `center` at the line's length, scope reticle at each
 * endpoint, and a label past the radius with distance + bearing.
 *
 * Geometry (line, circle, both endpoint markers) lives in MapLibre's
 * animated pipeline — `AnimatedCoordinatesArray` + `AnimatedPoint` nodes
 * mutated imperatively from a valtio subscription. The component itself
 * re-renders only when `active` toggles. The label `ViewAnnotation` and
 * its `<View>` still re-render at the drag's update frequency (no
 * throttle — animated values can't be threaded through ViewAnnotation).
 */
export function DividerOverlay() {
  const { active, center, radius } = useDivider();
  const { distance: distanceUnit } = usePreferredUnits();
  const theme = useTheme();
  const styles = useStyles();

  // --- Persistent animated nodes (created once; native bindings attach,
  // so identity must be stable for the component's life). ---

  const lineCoords = useMemo(
    () => new MLAnimated.CoordinatesArray([[0, 0], [0, 0]]),
    [],
  );
  const circleCoords = useMemo(
    () => new MLAnimated.CoordinatesArray([[0, 0], [0, 0]]),
    [],
  );
  const centerPoint = useMemo(
    () => new MLAnimated.Point({ type: "Point", coordinates: [0, 0] }),
    [],
  );
  const radiusPoint = useMemo(
    () => new MLAnimated.Point({ type: "Point", coordinates: [0, 0] }),
    [],
  );
  /** Line bearing (degrees, true), carried as an animated feature property
   *  so the scope reticle can rotate via `icon-rotate: ["get","bearing"]`
   *  without re-rendering the source. */
  const bearingValue = useMemo(() => new RNAnimated.Value(0), []);

  const lineData = useMemo(
    () =>
      new MLAnimated.GeoJSON({
        type: "LineString",
        coordinates: lineCoords,
      }),
    [lineCoords],
  );
  const circleData = useMemo(
    () =>
      new MLAnimated.GeoJSON({
        type: "LineString",
        coordinates: circleCoords,
      }),
    [circleCoords],
  );
  const pointsData = useMemo(
    () =>
      new MLAnimated.GeoJSON({
        // The TS signature only admits bare Point / LineString, but the
        // runtime walker accepts FeatureCollection with animated geometry —
        // same approach as NavigationPuck. The animated `bearing` property
        // is read natively via `icon-rotate: ["get","bearing"]`.
        // @ts-expect-error
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "divider-center",
            properties: { bearing: bearingValue },
            geometry: centerPoint,
          },
          {
            type: "Feature",
            id: "divider-radius",
            properties: { bearing: bearingValue },
            geometry: radiusPoint,
          },
        ],
      }),
    [centerPoint, radiusPoint, bearingValue],
  );

  // --- Label state (text + position + rotation). ---

  interface LabelState {
    distanceLabel: string;
    bearingLabel: string;
    lngLat: [number, number];
    offset: [number, number];
    rotation: number;
  }
  const [labelState, setLabelState] = useState<LabelState | null>(null);

  // --- Geometry update: write to animated values whenever either proxy
  // mutates. No React render involved per tick (except the label). ---

  useEffect(() => {
    if (!active) {
      // Clear the label when inactive; the proxy subscription below must be
      // set up synchronously. RC healthcheck compiles this cleanly.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLabelState(null);
      return;
    }

    const update = () => {
      const c = dividerState.center;
      const r = dividerState.radius;
      const live = dragLiveState;
      const effectiveCenter =
        live.kind === "center" && live.point ? live.point : c;
      const effectiveRadius =
        live.kind === "radius" && live.point ? live.point : r;
      if (!effectiveCenter || !effectiveRadius) return;

      centerPoint.setValue({
        type: "Point",
        coordinates: [effectiveCenter.longitude, effectiveCenter.latitude],
      });
      radiusPoint.setValue({
        type: "Point",
        coordinates: [effectiveRadius.longitude, effectiveRadius.latitude],
      });

      // CoordinatesArray has no setValue — timing(duration:0) snaps the
      // value and auto-cancels any in-flight animation.
      lineCoords
        .timing({
          toValue: [
            [effectiveCenter.longitude, effectiveCenter.latitude],
            [effectiveRadius.longitude, effectiveRadius.latitude],
          ],
          duration: 0,
          easing: Easing.linear,
        })
        .start();

      const distanceMeters = getDistance(effectiveCenter, effectiveRadius);
      circleCoords
        .timing({
          toValue: ringCoords(effectiveCenter, distanceMeters),
          duration: 0,
          easing: Easing.linear,
        })
        .start();

      const bearingDeg = getGreatCircleBearing(
        effectiveCenter,
        effectiveRadius,
      );
      bearingValue.setValue(bearingDeg);
      const distance = toDistance(distanceMeters);
      const bearingRad = (bearingDeg * Math.PI) / 180;
      // Rotate the label to read along the line, flipped into [-90, 90]
      // so it never appears upside-down.
      const rotation = ((bearingDeg + 90) % 180) - 90;
      setLabelState({
        distanceLabel: `${distance.value} ${distance.abbr}`,
        bearingLabel: formatBearing(bearingDeg),
        lngLat: [effectiveRadius.longitude, effectiveRadius.latitude],
        offset: [
          Math.sin(bearingRad) * LABEL_OFFSET_PX,
          -Math.cos(bearingRad) * LABEL_OFFSET_PX,
        ],
        rotation,
      });
    };

    update();
    const unsubDivider = subscribe(dividerState, update);
    const unsubDrag = subscribe(dragLiveState, update);
    return () => {
      unsubDivider();
      unsubDrag();
    };
  }, [
    active,
    distanceUnit,
    centerPoint,
    radiusPoint,
    lineCoords,
    circleCoords,
    bearingValue,
  ]);

  // --- Snap target tracking: when an endpoint is glued to a moving feature
  // (AIS, user puck, etc.), poll its rendered position and write back to
  // persisted state. The geometry effect picks it up. ---

  const centerSnapId = center?.snapTo?.id ?? null;
  const radiusSnapId = radius?.snapTo?.id ?? null;
  useEffect(() => {
    if (!active) return;
    if (!centerSnapId && !radiusSnapId) return;
    let cancelled = false;
    const ids = [centerSnapId, radiusSnapId].filter(
      (id): id is string => id != null,
    );
    const tick = async () => {
      const positions = await resolveSnapRefs(ids);
      if (cancelled) return;
      for (const kind of ["center", "radius"] as const) {
        const id = kind === "center" ? centerSnapId : radiusSnapId;
        if (!id) continue;
        const next = positions[id];
        const prev = dividerState[kind];
        if (!next || !prev) continue;
        if (next.latitude !== prev.latitude || next.longitude !== prev.longitude) {
          setDividerEndpoint(kind, next);
        }
      }
    };
    tick();
    const interval = setInterval(tick, SNAP_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active, centerSnapId, radiusSnapId]);

  if (!active) return null;

  return (
    <>
      <MLAnimated.GeoJSONSource id="divider-line" data={lineData}>
        <Layer
          id="divider-line-layer"
          type="line"
          paint={{
            "line-width": 2,
            "line-opacity": 0.75,
            "line-color": theme.measurements,
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </MLAnimated.GeoJSONSource>

      <MLAnimated.GeoJSONSource id="divider-circle" data={circleData}>
        <Layer
          id="divider-circle-layer"
          type="line"
          paint={{
            "line-width": 1,
            "line-opacity": 0.5,
            "line-color": theme.measurements,
            "line-dasharray": [0.01, 4],
          }}
          layout={{ "line-cap": "round" }}
        />
      </MLAnimated.GeoJSONSource>

      <MLAnimated.GeoJSONSource id="divider-points" data={pointsData}>
        <Layer
          id="divider-points-fill"
          type="circle"
          paint={{
            "circle-radius": 3,
            "circle-color": theme.measurements,
            "circle-opacity": 0.75,
          }}
        />
        <Layer
          id="divider-points-scope"
          type="symbol"
          layout={{
            "icon-image": "divider-scope",
            "icon-size": iconSize(MARKER_CSS_PX),
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.measurements,
            "icon-opacity": 0.75,
          }}
        />
      </MLAnimated.GeoJSONSource>

      {labelState && (
        <ViewAnnotation
          id="divider-label"
          lngLat={labelState.lngLat}
          offset={labelState.offset}
        >
          <View
            style={[
              styles.labelBubble,
              { transform: [{ rotate: `${labelState.rotation}deg` }] },
            ]}
          >
            <Text style={styles.labelText}>
              {labelState.distanceLabel} • {labelState.bearingLabel}
            </Text>
          </View>
        </ViewAnnotation>
      )}
    </>
  );
}

const useStyles = createStyles((theme) => ({
  labelBubble: {
    alignItems: "center",
  },
  labelText: {
    alignSelf: "stretch",
    textAlign: "center",
    backgroundColor: theme.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    opacity: 0.75,
    fontSize: 14,
    fontWeight: "700",
    color: theme.label,
  },
}));
