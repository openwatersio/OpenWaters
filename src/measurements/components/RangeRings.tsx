import { metersPerPixel, projectPosition } from "@/geo";
import {
  distanceUnitDefs,
  usePreferredUnits,
} from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { useCameraPosition } from "@/map/hooks/useCameraPosition";
import { niceDistance, ringCoords } from "@/measurements/units";
import { useDivider } from "@/measurements/useDivider";
import { useMeasurements } from "@/measurements/useMeasurements";
import { useNavigation } from "@/navigation/hooks/useNavigation";
import {
  GeoJSONSource,
  Layer,
  ViewAnnotation,
} from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions } from "react-native";

/** Target ring count used to pick the nice-distance spacing. After
 *  snap-down, the actual ring count is whatever fills the viewport at
 *  that spacing — typically 4–8. */
const TARGET_RING_COUNT = 4;
/** Safety cap on the number of rings actually drawn. Prevents runaway
 *  feature counts if the snap-down rounds the spacing way below target. */
const MAX_RING_COUNT = 12;
/** Above this viewport half-extent, hide the rings entirely. The flat-earth
 *  `projectPosition` math doesn't behave for ring radii in the thousands of
 *  km (lat/lng escapes the valid range and MapLibre / ViewAnnotation crashes),
 *  and ocean-scale ranging isn't what rings are for anyway. */
const MAX_VIEWPORT_HALF_EXTENT_METERS = 200_000;
/** Bearing (radians) for the label position on each ring. π = due south,
 *  putting labels behind the boat when the camera is COG-up. */
const LABEL_BEARING_RAD = Math.PI;

/**
 * Concentric range rings centered on the user's vessel. Spacing is a
 * round-number distance picked so the inner rings stay readable and the
 * outer rings reach the viewport edge; ring count adapts so the viewport
 * is filled regardless of how much the spacing snap-down rounds off.
 *
 * Hidden when `useMeasurements().rangeRings` is false.
 */
export function RangeRings() {
  const { rangeRings } = useMeasurements();
  const { active: dividerActive } = useDivider();
  const { latitude, longitude } = useNavigation();
  const { zoom } = useCameraPosition();
  const { distance: unit } = usePreferredUnits();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();

  const rings = useMemo(() => {
    if (!rangeRings) return null;
    // Hide rings while the divider tool is active so they don't compete
    // visually with the divider's line + circle + labels.
    if (dividerActive) return null;
    if (latitude == null || longitude == null || zoom == null) return null;

    const mpp = metersPerPixel(zoom, latitude);
    const viewportHalfExtentMeters = mpp * Math.min(width, height) / 2;
    if (viewportHalfExtentMeters > MAX_VIEWPORT_HALF_EXTENT_METERS) return null;

    // Pick spacing as if we wanted TARGET_RING_COUNT rings, then snap down.
    // The snap-down often rounds the spacing well below the target, so we
    // emit `floor(viewportRadius / spacing)` rings to fill the chart.
    const spacing = niceDistance(viewportHalfExtentMeters / TARGET_RING_COUNT, unit);
    const ringCount = Math.min(
      MAX_RING_COUNT,
      Math.max(1, Math.floor(viewportHalfExtentMeters / spacing.meters)),
    );

    const center = { latitude, longitude };
    const abbr = distanceUnitDefs[unit].abbr;

    return Array.from({ length: ringCount }, (_, i) => {
      const ringIndex = i + 1;
      const radiusMeters = spacing.meters * ringIndex;
      // Round to 3 decimals to drop floating-point noise from products like
      // `0.1 * 3` so labels read "0.3 nm" rather than "0.30000000000000004".
      const value = Math.round(spacing.value * ringIndex * 1000) / 1000;
      const label = `${value} ${abbr}`;
      const labelLngLat = projectPosition(
        latitude,
        longitude,
        LABEL_BEARING_RAD,
        radiusMeters,
      );
      return {
        ringIndex,
        radiusMeters,
        label,
        labelLngLat,
        coordinates: ringCoords(center, radiusMeters),
      };
    });
  }, [rangeRings, dividerActive, latitude, longitude, zoom, unit, width, height]);

  const data = useMemo(() => {
    if (!rings) return null;
    return JSON.stringify({
      type: "FeatureCollection",
      features: rings.map((r) => ({
        type: "Feature",
        properties: { distanceMeters: r.radiusMeters },
        geometry: { type: "LineString", coordinates: r.coordinates },
      })),
    });
  }, [rings]);

  if (!data || !rings) return null;

  return (
    <>
      <GeoJSONSource id="range-rings" data={data}>
        <Layer
          id="range-rings-line"
          type="line"
          paint={{
            "line-width": 1,
            "line-opacity": 0.33,
            "line-color": theme.measurements,
            "line-dasharray": [0.01, 4],
          }}
          layout={{ "line-cap": "round" }}
        />
      </GeoJSONSource>
      {rings.map((r) => (
        <ViewAnnotation
          key={`range-rings-label-${r.ringIndex}`}
          id={`range-rings-label-${r.ringIndex}`}
          lngLat={r.labelLngLat}
        >
          <Text style={[styles.labelText, { color: theme.labelSecondary, textShadowColor: theme.background }]}>
            {r.label}
          </Text>
        </ViewAnnotation>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  labelText: {
    fontSize: 11,
    fontWeight: "600",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3
  },
});
