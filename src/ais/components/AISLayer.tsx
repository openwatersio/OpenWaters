import { type AISVessel, useAIS } from "@/ais/hooks/useAIS";
import { projectPosition } from "@/geo";
import useTheme from "@/hooks/useTheme";
import { useSelection, useSelectionHandler } from "@/map/hooks/useSelection";
import { iconSize, iconSizeWithHalo } from "@/map/iconSize";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";

type Position = { latitude: number; longitude: number };

const STALE_AGE = 6 * 60 * 1000;   // 6 minutes
const EXPIRED_AGE = 9 * 60 * 1000;  // 9 minutes
const SOG_THRESHOLD = 0.25;         // m/s (~0.5 knots)
const COG_PROJECTION_SECONDS = 15 * 60; // 15 minutes

/** AIS ship type code → sprite icon ID */
function shipTypeIcon(code: number | undefined): string {
  if (code === undefined) return "vessel-unknown";
  if (code >= 80 && code <= 89) return "vessel-tanker";
  if (code >= 70 && code <= 79) return "vessel-cargo";
  if (code >= 60 && code <= 69) return "vessel-passenger";
  if (code === 52) return "vessel-tug";
  if (code >= 50 && code <= 59) return "vessel-default";
  if (code >= 40 && code <= 49) return "vessel-highspeed";
  if (code === 37) return "vessel-pleasure";
  if (code === 36) return "vessel-sailing";
  if (code === 31 || code === 32) return "vessel-tug";
  if (code === 30) return "vessel-fishing";
  return "vessel-unknown";
}

/** Combined navigation + freshness state */
function vesselState(vessel: AISVessel): string {
  const age = Date.now() - vessel.lastSeen;
  if (age > EXPIRED_AGE) return "expired";
  if (age > STALE_AGE) return "stale";
  const sog = vesselSOGmps(vessel);
  return sog > SOG_THRESHOLD ? "underway" : "moored";
}

function vesselPosition(vessel: AISVessel): Position | null {
  const pos = vessel.data["navigation.position"]?.value;
  if (pos && typeof pos === "object" && "latitude" in pos) {
    return pos as Position;
  }
  return null;
}

function vesselRotation(vessel: AISVessel): number {
  const heading = vessel.data["navigation.headingTrue"]?.value;
  if (typeof heading === "number") return (heading * 180) / Math.PI;
  const cog = vessel.data["navigation.courseOverGroundTrue"]?.value;
  if (typeof cog === "number") return (cog * 180) / Math.PI;
  return 0;
}

function vesselName(vessel: AISVessel): string {
  const name = vessel.data["name"]?.value;
  return typeof name === "string" ? name : vessel.mmsi;
}

function vesselSOG(vessel: AISVessel): number {
  const sog = vessel.data["navigation.speedOverGround"]?.value;
  return typeof sog === "number" ? sog * 1.9438 : 0;
}

function vesselSOGmps(vessel: AISVessel): number {
  const sog = vessel.data["navigation.speedOverGround"]?.value;
  return typeof sog === "number" ? sog : 0;
}

function vesselCOGrad(vessel: AISVessel): number | null {
  const cog = vessel.data["navigation.courseOverGroundTrue"]?.value;
  return typeof cog === "number" ? cog : null;
}

function vesselShipType(vessel: AISVessel): number | undefined {
  const t = vessel.data["design.aisShipType"]?.value;
  return typeof t === "number" ? t : undefined;
}

export default function AISLayer() {
  const vessels = useAIS();
  const theme = useTheme();

  // Tick every 30s to re-evaluate staleness even when vessel data hasn't changed
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const cogLines = useMemo((): GeoJSON.FeatureCollection => {
    void tick;
    const features: GeoJSON.Feature[] = Object.values(vessels)
      .map((vessel): GeoJSON.Feature | null => {
        if (vesselState(vessel) !== "underway") return null;
        const pos = vesselPosition(vessel);
        const cog = vesselCOGrad(vessel);
        const sog = vesselSOGmps(vessel);
        if (!pos || cog === null) return null;
        const dist = sog * COG_PROJECTION_SECONDS;
        const end = projectPosition(pos.latitude, pos.longitude, cog, dist);
        return {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[pos.longitude, pos.latitude], end],
          },
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null);
    return { type: "FeatureCollection", features };
  }, [vessels, tick]);

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    void tick;
    const features: GeoJSON.Feature[] = Object.values(vessels)
      .map((vessel): GeoJSON.Feature | null => {
        const state = vesselState(vessel);
        if (state === "expired") return null;
        const pos = vesselPosition(vessel);
        if (!pos) return null;
        return {
          type: "Feature",
          properties: {
            mmsi: vessel.mmsi,
            name: vesselName(vessel),
            rotation: vesselRotation(vessel),
            sog: vesselSOG(vessel),
            state,
            icon: shipTypeIcon(vesselShipType(vessel)),
          },
          geometry: {
            type: "Point",
            coordinates: [pos.longitude, pos.latitude],
          },
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null);

    return { type: "FeatureCollection", features };
  }, [vessels, tick]);

  const selection = useSelection();
  const navigate = useSelectionHandler();

  const handlePress = useCallback((e: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
    const mmsi = e.nativeEvent.features?.[0]?.properties?.mmsi;
    if (mmsi) {
      e.stopPropagation();
      navigate("vessel", mmsi);
    }
  }, [navigate]);

  const selectedMmsi = selection?.type === "vessel" ? selection.id : "";

  return (
    <>
      <GeoJSONSource id="ais-cog-lines" data={cogLines}>
        <Layer
          id="ais-cog-lines-layer"
          type="line"
          paint={{
            "line-color": theme.ais,
            "line-width": 1.5,
            "line-opacity": 0.5,
          }}
          layout={{
            "line-cap": "round",
          }}
        />
      </GeoJSONSource>
      <GeoJSONSource
        id="ais-vessels"
        data={geojson}
        hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }}
        onPress={handlePress}
      >
        {/* Halo (drawn first, underneath the fill) */}
        <Layer
          id="ais-vessels-halo"
          type="symbol"
          layout={{
            "icon-image": ["get", "icon"],
            "icon-size": ["interpolate", ["linear"], ["zoom"],
              6, ["case", ["==", ["get", "mmsi"], selectedMmsi], iconSizeWithHalo(22, 2), iconSizeWithHalo(10, 0.25)],
              18, ["case", ["==", ["get", "mmsi"], selectedMmsi], iconSizeWithHalo(64, 4), iconSizeWithHalo(44, 4)],
            ],
            "icon-rotate": ["get", "rotation"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.contrast,
            "icon-opacity": ["match", ["get", "state"], "stale", 0.3, "moored", 0.6, 1.0],
          }}
        />
        {/* Vessel fill */}
        <Layer
          id="ais-vessels-symbol"
          type="symbol"
          layout={{
            "icon-image": ["get", "icon"],
            "icon-size": ["interpolate", ["linear"], ["zoom"],
              6, ["case", ["==", ["get", "mmsi"], selectedMmsi], iconSize(22), iconSize(10)],
              18, ["case", ["==", ["get", "mmsi"], selectedMmsi], iconSize(64), iconSize(44)],
            ],
            "icon-rotate": ["get", "rotation"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
          paint={{
            "icon-color": theme.ais,
            "icon-opacity": ["case",
              ["==", ["get", "mmsi"], selectedMmsi],
              ["match", ["get", "state"], "stale", 0.3, "moored", 0.6, 1.0],
              ["match", ["get", "state"], "stale", 0.2, "moored", 0.5, 1.0],
            ],
          }}
        />
      </GeoJSONSource>
    </>
  );
}
