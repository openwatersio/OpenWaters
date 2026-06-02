import { projectPosition } from "@/geo";
import useTheme from "@/hooks/useTheme";
import { iconSize } from "@/map/iconSize";
import { NavigationState, navigationState } from "@/navigation/hooks/useNavigation";
import { Layer, Animated as MLAnimated } from "@maplibre/maplibre-react-native";
import { getDistance } from "geolib";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Easing, Animated as RNAnimated } from "react-native";
import { subscribe } from "valtio";

const COG_PROJECTION_SECONDS = 15 * 60; // 15 minutes
const EXTENDED_DISTANCE_METERS = 400 * 1852; // 400 nm
// Slightly longer than the GPS update interval (~1s) so animations overlap
// rather than completing and pausing before the next update.
const ANIMATION_DURATION = 1500;
const EASING = Easing.linear;

// Idle-gating thresholds. When the vessel isn't making way, 1 Hz GPS still
// arrives with sub-meter jitter; re-running the 1.5s animation on that jitter
// never lets the pipeline settle, keeping the entire map rendering at ~60fps
// for no visible benefit. Below these thresholds we skip re-animating so the
// in-flight animation finishes and the map idles. Gating only applies while
// moored (state !== Underway), so motion stays perfectly smooth whenever the
// vessel is actually underway.
const IDLE_POSITION_EPSILON_M = 3;
const IDLE_HEADING_EPSILON_DEG = 1.5;

/** Choose the shortest-path target for a heading animation (handles 359°→0° wrap). */
function shortestRotation(from: number, to: number): number {
  const delta = (((to - from) % 360) + 540) % 360 - 180;
  return from + delta;
}

/**
 * Animated vessel puck with course-over-ground projection line.
 *
 * All per-frame work happens inside maplibre-react-native's Animated pipeline:
 * persistent `AnimatedPoint` / `AnimatedCoordinatesArray` / `Animated.Value`
 * instances are embedded in `AnimatedGeoJSON` trees, which feed into
 * `Animated.GeoJSONSource`. GPS updates are read via an imperative `subscribe`
 * (not `useNavigation`) and kick off a parallel `timing` animation against
 * these stable animated nodes — so this component renders once, never per fix.
 *
 * Heading rotation is carried as a feature property and read on the native
 * side via `icon-rotate: ["get", "heading"]`, so the symbol layer itself is
 * static — no layout-spec churn per frame.
 */
export const NavigationPuck = memo(function NavigationPuck() {
  const theme = useTheme();
  // Render once; gate visibility on the first fix. GPS values are read
  // imperatively in the effect below (not via useNavigation) so a 1–5 Hz feed
  // doesn't re-render this component — and re-commit its theme-only layers —
  // on every fix. Mirrors NavigationCamera's imperative subscription.
  const [ready, setReady] = useState(
    () => navigationState.latitude != null && navigationState.longitude != null,
  );

  // --- Persistent animated nodes (created once, never replaced) ---
  // These hold native bindings through AnimatedGeoJSON's __attach, so they
  // must have stable identity for the lifetime of the component.

  const puckPoint = useMemo(
    () => new MLAnimated.Point({ type: "Point", coordinates: [0, 0] }),
    [],
  );
  const projCoords = useMemo(
    () => new MLAnimated.CoordinatesArray([[0, 0], [0, 0]]),
    [],
  );
  const extCoords = useMemo(
    () => new MLAnimated.CoordinatesArray([[0, 0], [0, 0]]),
    [],
  );
  const headingValue = useMemo(() => new RNAnimated.Value(0), []);

  // Cumulative (unwrapped) heading so the arrow never spins the long way.
  const cumulativeHeadingRef = useRef(0);
  // Last position/COG-state we actually animated to. Idle-gating compares the
  // incoming fix against these (not the previous reading) so sub-threshold
  // jitter coalesces instead of restarting the animation every second.
  const lastAnimatedRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const stateRef = useRef<NavigationState>(NavigationState.Moored);

  // --- AnimatedGeoJSON trees (built once) ---

  const puckData = useMemo(
    () =>
      new MLAnimated.GeoJSON({
        // The TS signature for AnimatedGeoJSON only admits bare Point / LineString, but the runtime walker
        // handles arbitrarystructures — including animated values nested in feature properties, which is
        // what lets us carry `heading` through to a `["get","heading"]` expression.
        // @ts-expect-error
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "current-location",
            properties: { heading: headingValue, snappable: true },
            // AnimatedPoint slots in at `geometry`, not `coordinates`:
            // its __getValue() returns `{type:"Point", coordinates:[...]}`,
            // a full geometry object.
            geometry: puckPoint,
          },
        ],
      }),
    [puckPoint, headingValue],
  );

  const projData = useMemo(
    () =>
      new MLAnimated.GeoJSON({
        type: "LineString",
        coordinates: projCoords,
      }),
    [projCoords],
  );

  const extData = useMemo(
    () =>
      new MLAnimated.GeoJSON({
        type: "LineString",
        coordinates: extCoords,
      }),
    [extCoords],
  );

  // --- Drive animations imperatively on every nav update ---
  // Subscribe to navigationState directly (not via useNavigation) so the
  // 1–5 Hz feed drives the animation pipeline without re-rendering this
  // component or re-committing its layers each fix.
  useEffect(() => {
    const drive = () => {
      const { latitude, longitude, heading, course, speed, state } = navigationState;
      if (latitude == null || longitude == null) return;
      setReady(true);

      const isUnderway = state === NavigationState.Underway;
      const showCog = isUnderway && course != null && speed != null;
      const headingTarget =
        heading != null
          ? shortestRotation(cumulativeHeadingRef.current, heading)
          : cumulativeHeadingRef.current;

      // Idle-gate: while moored, skip re-animating on sub-threshold jitter so
      // the in-flight animation settles and the map can idle. A moored/underway
      // transition (state !== stateRef) or movement past the threshold is never
      // gated; the first fix has distance === Infinity, so it always animates.
      const last = lastAnimatedRef.current;
      const distance = last
        ? getDistance(last, { latitude, longitude })
        : Infinity;
      const headingDelta = Math.abs(headingTarget - cumulativeHeadingRef.current);
      const gated =
        !isUnderway &&
        state === stateRef.current &&
        distance < IDLE_POSITION_EPSILON_M &&
        headingDelta < IDLE_HEADING_EPSILON_DEG;
      if (gated) return;

      // First fix (no prior animated position) snaps instantly rather than
      // sweeping from [0,0].
      const duration = last === null ? 0 : ANIMATION_DURATION;
      lastAnimatedRef.current = { latitude, longitude };
      stateRef.current = state;
      cumulativeHeadingRef.current = headingTarget;

      const animations: RNAnimated.CompositeAnimation[] = [];

      // Puck position
      puckPoint.stopAnimation();
      animations.push(
        puckPoint.timing({
          toValue: { type: "Point", coordinates: [longitude, latitude] },
          duration,
          easing: EASING,
        }),
      );

      // Heading (shortest path against a cumulative/unwrapped target)
      if (heading != null) {
        headingValue.stopAnimation();
        animations.push(
          RNAnimated.timing(headingValue, {
            toValue: headingTarget,
            duration,
            easing: EASING,
            useNativeDriver: false,
          }),
        );
      }

      // COG line endpoints — projected (15 min) and extended (400 nm).
      // When not underway (course/speed unavailable), collapse both segments
      // onto the puck so the line visually disappears without a pop.
      const projectedEnd: [number, number] = showCog
        ? projectPosition(latitude, longitude, course!, speed! * COG_PROJECTION_SECONDS)
        : [longitude, latitude];
      const extendedEnd: [number, number] = showCog
        ? projectPosition(latitude, longitude, course!, EXTENDED_DISTANCE_METERS)
        : [longitude, latitude];

      // AnimatedCoordinatesArray auto-stops any in-flight animation when a new
      // one starts (see AbstractAnimatedCoordinates.onAnimationStart), so no
      // explicit stop is needed — and it doesn't expose one.
      animations.push(
        projCoords.timing({
          toValue: [[longitude, latitude], projectedEnd],
          duration,
          easing: EASING,
        }) as unknown as RNAnimated.CompositeAnimation,
        extCoords.timing({
          toValue: [projectedEnd, extendedEnd],
          duration,
          easing: EASING,
        }) as unknown as RNAnimated.CompositeAnimation,
      );

      RNAnimated.parallel(animations).start();
    };

    drive(); // seed from current state
    return subscribe(navigationState, drive);
  }, [puckPoint, projCoords, extCoords, headingValue]);

  if (!ready) return null;

  return (
    <>
      {/* Extended COG — faint far segment */}
      <MLAnimated.GeoJSONSource id="nav-puck-cog-ext" data={extData}>
        <Layer
          id="nav-puck-cog-ext-line"
          type="line"
          paint={{
            "line-color": theme.userLocation,
            "line-width": 3,
            "line-opacity": 0.25,
          }}
          layout={{ "line-cap": "round" }}
        />
      </MLAnimated.GeoJSONSource>

      {/* Projected COG — prominent 5-minute look-ahead */}
      <MLAnimated.GeoJSONSource id="nav-puck-cog-proj" data={projData}>
        <Layer
          id="nav-puck-cog-proj-line"
          type="line"
          paint={{
            "line-color": theme.userLocation,
            "line-width": 3,
            "line-opacity": 0.75,
          }}
          layout={{ "line-cap": "round" }}
        />
      </MLAnimated.GeoJSONSource>

      {/* Puck arrow — rotation read natively from feature properties */}
      <MLAnimated.GeoJSONSource id="nav-puck" data={puckData}>
        <Layer
          id="nav-puck-arrow"
          type="symbol"
          layout={{
            "icon-image": "nav-puck",
            "icon-size": iconSize(28),
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.userLocation,
            "icon-halo-color": theme.contrast,
            "icon-halo-width": 2,
          }}
        />
      </MLAnimated.GeoJSONSource>
    </>
  );
});
