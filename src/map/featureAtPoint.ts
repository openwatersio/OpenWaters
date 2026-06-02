import { groupFeatures } from "@/charts/s57/relations";
import { describeChartFeature } from "@/charts/translators";
import { Coordinates, flattenCoordinates, metersPerPixel } from "@/geo";
import type { Feature, Geometry, Position as GeoPosition } from "geojson";
import { getDistance, getDistanceFromLine } from "geolib";

/** Half-size (px) of the box queried around a tap to count as "on" a feature. */
const TAP_TOLERANCE_PX = 22;

/** Centroid for areas/lines, the point itself for points; null if no coords. */
export function representativePoint(
  geometry: Geometry | null | undefined,
): Coordinates | null {
  if (!geometry || geometry.type === "GeometryCollection") return null;
  if (geometry.type === "Point") {
    const [lon, lat] = geometry.coordinates;
    return { latitude: lat, longitude: lon };
  }
  const coords = flattenCoordinates(geometry);
  if (coords.length === 0) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return { latitude: sumLat / coords.length, longitude: sumLon / coords.length };
}

/** Chart-feature detail-route id: "lon,lat,LNAM". Shared so ids built from a
 *  map tap match those the nearby list builds (and thus `exclude` works). */
export function chartFeatureId(rep: Coordinates, lnam: string): string {
  return `${rep.longitude},${rep.latitude},${lnam}`;
}

function lnamOf(f: Feature): string {
  return typeof f.properties?.LNAM === "string" ? f.properties.LNAM : "";
}

/** Geographic distance (m) from `target` to the nearest vertex/segment of a
 *  geometry, or null if it has no usable coordinates — lines measure to the
 *  nearest segment, not the centroid, so long contours aren't missed. */
function distanceToGeometry(geometry: Geometry, target: Coordinates): number | null {
  switch (geometry.type) {
    case "Point": {
      const [lon, lat] = geometry.coordinates;
      return getDistance(target, { latitude: lat, longitude: lon });
    }
    case "MultiPoint": {
      let min = Infinity;
      for (const [lon, lat] of geometry.coordinates) {
        min = Math.min(min, getDistance(target, { latitude: lat, longitude: lon }));
      }
      return Number.isFinite(min) ? min : null;
    }
    case "LineString":
      return minDistanceToLine(geometry.coordinates, target);
    case "MultiLineString": {
      let min = Infinity;
      for (const line of geometry.coordinates) {
        const d = minDistanceToLine(line, target);
        if (d != null) min = Math.min(min, d);
      }
      return Number.isFinite(min) ? min : null;
    }
    default:
      return null;
  }
}

function minDistanceToLine(coords: GeoPosition[], target: Coordinates): number | null {
  if (coords.length === 0) return null;
  if (coords.length === 1) {
    const [lon, lat] = coords[0];
    return getDistance(target, { latitude: lat, longitude: lon });
  }
  let min = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    // getDistanceFromLine is undefined for a zero-length segment; skip those.
    if (lon1 === lon2 && lat1 === lat2) continue;
    min = Math.min(
      min,
      getDistanceFromLine(
        target,
        { latitude: lat1, longitude: lon1 },
        { latitude: lat2, longitude: lon2 },
      ),
    );
  }
  return Number.isFinite(min) ? min : null;
}

/**
 * If a discrete chart feature (point or line) sits under — or within tolerance
 * of — `target`, return its detail-route id ("lon,lat,LNAM"), grouping a
 * structure with its equipment (a buoy with its light) so the id points at the
 * structure. Resolved from a coordinate alone (no screen point) against an
 * already-queried set of rendered features, so `LocationDetail` can resolve a
 * tapped/dragged coordinate without projecting back to a pixel.
 *
 * Returns null for open water and area-only taps; those fall back to the plain
 * location info. Areas (the sea, depth areas, zones) are deliberately not direct
 * tap targets — they stay reachable via the nearby list — so a tap on water
 * doesn't get hijacked into a "Depth area". Tolerance is the on-screen tap slop
 * (`TAP_TOLERANCE_PX`) converted to meters at the current zoom.
 */
export function chartFeatureIdAtCoordinate(
  features: Feature[],
  target: Coordinates,
  zoom: number,
): string | null {
  const tolerance = metersPerPixel(zoom, target.latitude) * TAP_TOLERANCE_PX;

  // Prefer points over lines, then nearest to the target.
  let best: { feature: Feature; rank: number; distance: number } | null = null;
  for (const feature of features) {
    const type = feature.geometry?.type;
    const isPoint = type === "Point" || type === "MultiPoint";
    const isLine = type === "LineString" || type === "MultiLineString";
    if (!isPoint && !isLine) continue;
    if (!describeChartFeature(feature.properties ?? {})) continue;
    const distance = feature.geometry
      ? distanceToGeometry(feature.geometry, target)
      : null;
    if (distance == null || distance > tolerance) continue;
    const rank = isPoint ? 0 : 1;
    if (
      !best ||
      rank < best.rank ||
      (rank === best.rank && distance < best.distance)
    ) {
      best = { feature, rank, distance };
    }
  }
  if (!best) return null;

  const lnam = lnamOf(best.feature);
  const group = lnam ? groupFeatures(lnam, features) : null;
  const primary = group?.primary ?? best.feature;
  const rep = representativePoint(primary.geometry);
  if (!rep) return null;
  return chartFeatureId(rep, lnamOf(primary));
}
