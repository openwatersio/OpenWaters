import { useCameraView } from "@/hooks/useCameraView";
import { useNavigation } from "@/hooks/useNavigation";
import useTheme from "@/hooks/useTheme";
import type { LngLat } from "@maplibre/maplibre-react-native";
import {
  GeoJSONSource,
  Layer,
  Marker,
} from "@maplibre/maplibre-react-native";
import { memo, useEffect } from "react";
import Reanimated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

const PUCK_SIZE = 32;
const HALO_STROKE = 4; // svg stroke width for the halo outline, in viewBox units
const COG_PROJECTION_SECONDS = 15 * 60; // minutes
const MIN_SOG_FOR_COG_LINE = 0.25; // m/s (~0.5 knots)
const EXTENDED_DISTANCE_METERS = 400 * 1852; // 400 nm
// Slightly longer than the GPS update interval (~1s) so animations overlap
// rather than completing and pausing before the next update
const ANIMATION_DURATION = 1500;
const TIMING_CONFIG = { duration: ANIMATION_DURATION, easing: Easing.linear };

const AnimatedMarker = Reanimated.createAnimatedComponent(Marker);
const AnimatedGeoJSONSource = Reanimated.createAnimatedComponent(GeoJSONSource);

/** Normalize `to` so that (to - from) is the shortest path in [-180, 180]. */
function shortestRotationTarget(from: number, to: number): number {
  const delta = (((to - from) % 360) + 540) % 360 - 180;
  return from + delta;
}

export const NavigationPuck = memo(function NavigationPuck() {
  const theme = useTheme();
  const hasFix = useNavigation(
    (s) => s.latitude !== null && s.longitude !== null,
  );

  // Shared values driven imperatively from the navigation + camera stores.
  // This avoids re-rendering the component on every GPS tick or map movement.
  const latitude = useSharedValue(0);
  const longitude = useSharedValue(0);
  const headingDeg = useSharedValue(0); // unbounded, for shortest-path rotation
  const courseDeg = useSharedValue(0); // unbounded, for shortest-path rotation
  const speed = useSharedValue(0);
  const mapBearing = useSharedValue(0);

  // Initialize shared values from current store state on mount.
  useEffect(() => {
    const nav = useNavigation.getState();
    if (nav.latitude !== null) latitude.value = nav.latitude;
    if (nav.longitude !== null) longitude.value = nav.longitude;
    if (nav.heading !== null) headingDeg.value = nav.heading;
    if (nav.course !== null) courseDeg.value = (nav.course * 180) / Math.PI;
    if (nav.speed !== null) speed.value = nav.speed;
    mapBearing.value = useCameraView.getState().bearing;
  }, [latitude, longitude, headingDeg, courseDeg, speed, mapBearing]);

  // Subscribe to navigation updates and drive shared values with withTiming.
  useEffect(() => {
    return useNavigation.subscribe((nav) => {
      if (nav.latitude !== null) {
        latitude.value = withTiming(nav.latitude, TIMING_CONFIG);
      }
      if (nav.longitude !== null) {
        longitude.value = withTiming(nav.longitude, TIMING_CONFIG);
      }
      if (nav.heading !== null) {
        headingDeg.value = withTiming(
          shortestRotationTarget(headingDeg.value, nav.heading),
          TIMING_CONFIG,
        );
      }
      if (nav.course !== null) {
        const targetDeg = (nav.course * 180) / Math.PI;
        courseDeg.value = withTiming(
          shortestRotationTarget(courseDeg.value, targetDeg),
          TIMING_CONFIG,
        );
      }
      if (nav.speed !== null) {
        speed.value = withTiming(nav.speed, TIMING_CONFIG);
      }
    });
  }, [latitude, longitude, headingDeg, courseDeg, speed]);

  // Sync map bearing immediately (no interpolation — the map's own animation is
  // the source of truth).
  useEffect(() => {
    return useCameraView.subscribe((state) => {
      mapBearing.value = state.bearing;
    });
  }, [mapBearing]);

  // Marker position (lngLat) — drives native position updates without re-rendering React.
  const markerAnimatedProps = useAnimatedProps<{ lngLat: LngLat }>(() => {
    return { lngLat: [longitude.value, latitude.value] };
  });

  // Arrow rotation: heading in map-space, compensated for map bearing so the
  // puck visually rotates with the map like an icon-rotation-alignment="map".
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${headingDeg.value - mapBearing.value}deg` }],
  }));

  // COG line: compute both segments on the UI thread each frame from animated
  // position, course, and speed. Produces an empty collection when the vessel
  // is below the speed threshold. The native GeoJSONSource expects `data` as
  // a JSON string, so we serialize inside the worklet.
  const cogAnimatedProps = useAnimatedProps(() => {
    const lat = latitude.value;
    const lng = longitude.value;
    const sog = speed.value;
    if (sog <= MIN_SOG_FOR_COG_LINE) {
      return { data: '{"type":"FeatureCollection","features":[]}' };
    }
    const courseRad = (courseDeg.value * Math.PI) / 180;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const sinC = Math.sin(courseRad);
    const cosC = Math.cos(courseRad);

    const projDist = sog * COG_PROJECTION_SECONDS;
    const projLat = lat + (projDist * cosC) / 110540;
    const projLng = lng + (projDist * sinC) / (111320 * cosLat);

    const extLat = lat + (EXTENDED_DISTANCE_METERS * cosC) / 110540;
    const extLng = lng + (EXTENDED_DISTANCE_METERS * sinC) / (111320 * cosLat);

    return {
      data: JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { segment: "extended" },
            geometry: {
              type: "LineString",
              coordinates: [
                [projLng, projLat],
                [extLng, extLat],
              ],
            },
          },
          {
            type: "Feature",
            properties: { segment: "projected" },
            geometry: {
              type: "LineString",
              coordinates: [
                [lng, lat],
                [projLng, projLat],
              ],
            },
          },
        ],
      }),
    };
  });

  if (!hasFix) return null;

  return (
    <>
      {/* COG projection line — data is driven by useAnimatedProps on the UI thread. */}
      <AnimatedGeoJSONSource
        id="nav-puck-cog"
        data={{ type: "FeatureCollection", features: [] }}
        animatedProps={cogAnimatedProps}
      >
        <Layer
          id="nav-puck-cog-line"
          type="line"
          paint={{
            "line-color": theme.userLocation,
            "line-width": 3,
            "line-opacity": [
              "match",
              ["get", "segment"],
              "projected",
              0.75,
              "extended",
              0.25,
              0.5,
            ],
          }}
          layout={{ "line-cap": "round" }}
        />
      </AnimatedGeoJSONSource>

      {/* Puck — position is animated via animatedProps, rotation via animated style. */}
      <AnimatedMarker
        id="current-location"
        lngLat={[0, 0]}
        animatedProps={markerAnimatedProps}
      >
        <Reanimated.View style={arrowStyle}>
          <Svg width={PUCK_SIZE} height={PUCK_SIZE} viewBox="0 0 64 64">
            <Path
              d={PUCK_PATH}
              fill={theme.userLocation}
              stroke={theme.surface}
              strokeWidth={HALO_STROKE}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </Reanimated.View>
      </AnimatedMarker>
    </>
  );
});

// Puck arrow path — mirrors assets/vessels/svg/puck.svg (64×64 viewBox).
const PUCK_PATH =
  "M 32 6 L 53 48 Q 54 51 51 50 L 34 41 Q 32 40 30 41 L 13 50 Q 10 51 11 48 Z";
