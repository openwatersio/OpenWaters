import { useNavigation } from "@/hooks/useNavigation";
import useTheme from "@/hooks/useTheme";
import { projectPosition } from "@/lib/geo";
import { Layer, Animated as MLAnimated } from "@maplibre/maplibre-react-native";
import { memo, useEffect, useMemo, useRef } from "react";
import { Easing, Animated as RNAnimated } from "react-native";

const COG_PROJECTION_SECONDS = 15 * 60; // 5 minutes
const MIN_SOG_FOR_COG_LINE = 0.25; // m/s (~0.5 knots)
const EXTENDED_DISTANCE_METERS = 400 * 1852; // 400 nm
// Slightly longer than the GPS update interval (~1s) so animations overlap
// rather than completing and pausing before the next update.
const ANIMATION_DURATION = 1500;
const EASING = Easing.linear;

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
 * `Animated.GeoJSONSource`. Each GPS update kicks off a parallel `timing`
 * animation against these stable animated nodes; the React tree here renders
 * only once per GPS fix.
 *
 * Heading rotation is carried as a feature property and read on the native
 * side via `icon-rotate: ["get", "heading"]`, so the symbol layer itself is
 * static — no layout-spec churn per frame.
 */
export const NavigationPuck = memo(function NavigationPuck() {
  const { latitude, longitude, heading, course, speed } = useNavigation();
  const theme = useTheme();

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
  // First fix snaps instantly instead of sweeping from [0,0].
  const isFirstFixRef = useRef(true);

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
            properties: { heading: headingValue },
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

  // --- Drive animations when GPS state changes ---
  useEffect(() => {
    if (latitude == null || longitude == null) return;

    const duration = isFirstFixRef.current ? 0 : ANIMATION_DURATION;
    isFirstFixRef.current = false;

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
      const target = shortestRotation(cumulativeHeadingRef.current, heading);
      cumulativeHeadingRef.current = target;
      headingValue.stopAnimation();
      animations.push(
        RNAnimated.timing(headingValue, {
          toValue: target,
          duration,
          easing: EASING,
          useNativeDriver: false,
        }),
      );
    }

    // COG line endpoints — projected (5 min) and extended (400 nm).
    // When speed drops below threshold, collapse both segments onto the puck
    // so the line visually disappears without a pop.
    const showCog = course != null && (speed ?? 0) > MIN_SOG_FOR_COG_LINE;
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
  }, [latitude, longitude, heading, course, speed, puckPoint, projCoords, extCoords, headingValue]);

  if (latitude == null || longitude == null) return null;

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
            "icon-size": 0.5,
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.userLocation,
            "icon-halo-color": theme.surface,
            "icon-halo-width": 1.5,
          }}
        />
      </MLAnimated.GeoJSONSource>
    </>
  );
});
