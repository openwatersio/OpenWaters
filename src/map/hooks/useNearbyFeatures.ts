import { type AISVessel, useAIS } from "@/ais/hooks/useAIS";
import { type AtoN, useAtoN } from "@/aton/hooks/useAtoN";
import { groupFeatures } from "@/charts/s57/relations";
import { useChartStore } from "@/charts/store";
import { describeChartFeature } from "@/charts/translators";
import { flattenCoordinates } from "@/geo";
import { mapRef } from "@/map/hooks/useMapRef";
import { useMarkers } from "@/markers/hooks/useMarkers";
import type { Feature } from "geojson";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useEffect, useMemo, useState } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

export type NearbyKind = "chart" | "vessel" | "aton" | "marker";

export type NearbyItem = {
  kind: NearbyKind;
  /** Navigation id: chart = "lon,lat,LNAM"; vessel = mmsi; aton = id; marker = db id. */
  id: string;
  title: string;
  subtitle: string;
  icon: SFSymbol;
  /** Meters from the query center. */
  distance: number;
  bearing: number;
  /** GeoJSON features for the row (chart only): the structure plus any related
   *  features (light, fog signal, …), so the thumbnail can draw them together. */
  features?: Feature[];
};

type Position = { latitude: number; longitude: number };

/** Half-size of the chart query box, in pixels. Also sets the real-world radius
 *  used for the state-based providers (via unproject), so "nearby" tracks zoom. */
const NEARBY_RADIUS_PX = 80;
/** Radius used before the first async measurement resolves. */
const FALLBACK_RADIUS_M = 2000;
const MAX_ITEMS = 20;

/** SF Symbol shown for a chart feature when its thumbnail can't render. Chart
 *  features almost always render real symbology, so this is rarely seen. */
const CHART_ICON: SFSymbol = "mappin";

type ChartState = { chartItems: NearbyItem[]; radiusM: number };

export function useNearbyFeatures(
  center: Position,
  options?: { exclude?: { kind: NearbyKind; id: string } },
): NearbyItem[] {
  const { selectedChartId } = useChartStore();
  const vessels = useAIS();
  const atons = useAtoN();
  const markers = useMarkers();

  const [{ chartItems, radiusM }, setChartState] = useState<ChartState>({
    chartItems: [],
    radiusM: 0,
  });

  const { latitude, longitude } = center;
  const excludeKind = options?.exclude?.kind;
  const excludeId = options?.exclude?.id;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;

    (async () => {
      const [x, y] = await map.project([longitude, latitude]);
      const edge = await map.unproject([x + NEARBY_RADIUS_PX, y]);
      const radius = getDistance(
        { latitude, longitude },
        { latitude: edge[1], longitude: edge[0] },
      );

      const items: NearbyItem[] = [];

      if (selectedChartId) {
        const raw = ((await map.queryRenderedFeatures([
          [x - NEARBY_RADIUS_PX, y - NEARBY_RADIUS_PX],
          [x + NEARBY_RADIUS_PX, y + NEARBY_RADIUS_PX],
        ])) ?? []) as unknown as Feature[];

        // LNAMs already folded into an emitted group (so a buoy and its light
        // produce one row, not two); and emitted row keys (dedups the no-LNAM
        // features that repeat across style layers).
        const grouped = new Set<string>();
        const seen = new Set<string>();
        for (const feature of raw) {
          const props = feature.properties ?? {};
          const lnam = typeof props.LNAM === "string" ? props.LNAM : "";

          // Collapse related features into their structure (S-57 master/slave
          // via LNAM); a feature without an LNAM stands alone.
          let primary = feature;
          let members: Feature[] = [feature];
          if (lnam) {
            if (grouped.has(lnam)) continue;
            const group = groupFeatures(lnam, raw);
            if (group) {
              primary = group.primary;
              members = [group.primary, ...group.related];
              for (const member of members) {
                const id = member.properties?.LNAM;
                if (typeof id === "string" && id) grouped.add(id);
              }
            } else {
              grouped.add(lnam);
            }
          }

          // Detect the feature's schema and describe it; non-chart features
          // (our own overlays — vessels, markers, …) aren't recognized.
          const described = describeChartFeature(primary.properties ?? {});
          if (!described) continue;
          const rep = representativePoint(primary.geometry);
          if (!rep) continue;
          const key =
            described.lnam ||
            `${described.objl}@${rep.latitude.toFixed(5)},${rep.longitude.toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const sub =
            described.title === described.class.label
              ? (described.subtitle ?? "")
              : [described.class.label, described.subtitle]
                  .filter(Boolean)
                  .join(" · ");

          items.push({
            kind: "chart",
            id: `${rep.longitude},${rep.latitude},${described.lnam}`,
            title: described.title,
            subtitle: sub,
            icon: CHART_ICON,
            distance: getDistance({ latitude, longitude }, rep),
            bearing: getGreatCircleBearing({ latitude, longitude }, rep),
            features: members,
          });
        }
      }

      if (!cancelled) setChartState({ chartItems: items, radiusM: radius });
    })();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, selectedChartId]);

  return useMemo(() => {
    const here: Position = { latitude, longitude };
    const radius = radiusM || FALLBACK_RADIUS_M;
    const items: NearbyItem[] = [...chartItems];

    const within = (pos: Position) => getDistance(here, pos) <= radius;
    const excluded = (kind: NearbyKind, id: string) =>
      excludeKind === kind && excludeId === id;

    for (const vessel of Object.values(vessels)) {
      const pos = vesselPosition(vessel);
      if (!pos || !within(pos) || excluded("vessel", vessel.mmsi)) continue;
      items.push({
        kind: "vessel",
        id: vessel.mmsi,
        title: vesselName(vessel),
        subtitle: vesselTypeLabel(vesselShipType(vessel)),
        icon: "ferry.fill",
        distance: getDistance(here, pos),
        bearing: getGreatCircleBearing(here, pos),
      });
    }

    for (const aton of Object.values(atons)) {
      const pos = atonPosition(aton);
      if (!pos || !within(pos) || excluded("aton", aton.id)) continue;
      items.push({
        kind: "aton",
        id: aton.id,
        title: atonName(aton) ?? "Aid to Navigation",
        subtitle: "Aid to Navigation",
        icon: "triangle.fill",
        distance: getDistance(here, pos),
        bearing: getGreatCircleBearing(here, pos),
      });
    }

    for (const marker of markers) {
      const pos = { latitude: marker.latitude, longitude: marker.longitude };
      if (!within(pos) || excluded("marker", String(marker.id))) continue;
      items.push({
        kind: "marker",
        id: String(marker.id),
        title: marker.name ?? "Marker",
        subtitle: "Marker",
        icon: "mappin.circle.fill",
        distance: getDistance(here, pos),
        bearing: getGreatCircleBearing(here, pos),
      });
    }

    return items.sort((a, b) => a.distance - b.distance).slice(0, MAX_ITEMS);
  }, [
    chartItems,
    radiusM,
    vessels,
    atons,
    markers,
    latitude,
    longitude,
    excludeKind,
    excludeId,
  ]);
}

// --- helpers ---

function isPosition(value: unknown): value is Position {
  return (
    !!value &&
    typeof value === "object" &&
    "latitude" in value &&
    "longitude" in value
  );
}

function vesselPosition(vessel: AISVessel): Position | null {
  const pos = vessel.data["navigation.position"]?.value;
  return isPosition(pos) ? pos : null;
}

function vesselName(vessel: AISVessel): string {
  const name = vessel.data["name"]?.value;
  return typeof name === "string" ? name : vessel.mmsi;
}

function vesselShipType(vessel: AISVessel): number | undefined {
  const type = vessel.data["design.aisShipType"]?.value;
  return typeof type === "number" ? type : undefined;
}

function vesselTypeLabel(code: number | undefined): string {
  if (code === undefined) return "Vessel";
  if (code >= 80 && code <= 89) return "Tanker";
  if (code >= 70 && code <= 79) return "Cargo";
  if (code >= 60 && code <= 69) return "Passenger";
  if (code >= 40 && code <= 49) return "High-speed craft";
  if (code === 36) return "Sailing";
  if (code === 37) return "Pleasure craft";
  if (code === 30) return "Fishing";
  if (code === 31 || code === 32 || code === 52) return "Tug";
  return "Vessel";
}

function atonPosition(aton: AtoN): Position | null {
  const pos = aton.data["navigation.position"]?.value;
  return isPosition(pos) ? pos : null;
}

function atonName(aton: AtoN): string | undefined {
  const name = aton.data["name"]?.value;
  return typeof name === "string" ? name : undefined;
}

/** Centroid for areas/lines, the point itself for points. */
function representativePoint(
  geometry: GeoJSON.Geometry | null | undefined,
): Position | null {
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
  return {
    latitude: sumLat / coords.length,
    longitude: sumLon / coords.length,
  };
}
