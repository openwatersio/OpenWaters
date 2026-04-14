import { type AtoN, useAtoN } from "@/hooks/useAtoN";
import { useSelection, useSelectionHandler } from "@/hooks/useSelection";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo } from "react";
import type { NativeSyntheticEvent } from "react-native";

type Position = { latitude: number; longitude: number };

type AtoNStyle = { color: string; icon: string };

const DEFAULT_STYLE: AtoNStyle = { color: "#f59e0b", icon: "aton-default" }; // amber-500

/**
 * IALA AtoN type code → color and icon for map rendering.
 * Type codes from AIS Message Type 21.
 */
function atonTypeStyle(aton: AtoN): AtoNStyle {
  const isVirtual = aton.data["virtual"]?.value;
  if (isVirtual === 1) {
    return { color: "#a855f7", icon: "aton-virtual" }; // purple-500
  }

  const typeCode = aton.data["atonType"]?.value;
  if (typeof typeCode !== "number") return DEFAULT_STYLE;

  // Lighthouses and major lights
  if (typeCode >= 1 && typeCode <= 4) return { color: "#eab308", icon: "aton-lighthouse" }; // yellow-500
  // Light vessels, LANBY
  if (typeCode >= 5 && typeCode <= 8) return { color: "#ef4444", icon: "aton-buoy" }; // red-500
  // Beacons and fixed marks
  if (typeCode >= 9 && typeCode <= 15) return { color: "#22c55e", icon: "aton-beacon" }; // green-500
  // Buoys (lateral, cardinal, special, etc.)
  if (typeCode >= 16 && typeCode <= 30) return { color: "#f59e0b", icon: "aton-buoy" }; // amber-500

  return DEFAULT_STYLE;
}

function atonPosition(aton: AtoN): Position | null {
  const pos = aton.data["navigation.position"]?.value;
  if (pos && typeof pos === "object" && "latitude" in pos) {
    return pos as Position;
  }
  return null;
}

function atonName(aton: AtoN): string {
  const name = aton.data["name"]?.value;
  return typeof name === "string" ? name : aton.id;
}

export default function AtoNLayer() {
  const atons = useAtoN((s) => s.atons);

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = Object.values(atons)
      .map((aton): GeoJSON.Feature | null => {
        const pos = atonPosition(aton);
        if (!pos) return null;
        const style = atonTypeStyle(aton);
        const offPosition = aton.data["offPosition"]?.value;
        return {
          type: "Feature",
          properties: {
            id: aton.id,
            name: atonName(aton),
            icon: style.icon,
            color: style.color,
            offPosition: offPosition === 1,
          },
          geometry: {
            type: "Point",
            coordinates: [pos.longitude, pos.latitude],
          },
        };
      })
      .filter((f): f is GeoJSON.Feature => f !== null);

    return { type: "FeatureCollection", features };
  }, [atons]);

  const selection = useSelection();
  const navigate = useSelectionHandler();

  const handlePress = useCallback((e: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
    const id = e.nativeEvent.features?.[0]?.properties?.id;
    if (id) {
      e.stopPropagation();
      navigate("aton", id);
    }
  }, [navigate]);

  const selectedId = selection?.type === "aton" ? selection.id : "";

  return (
    <GeoJSONSource
      id="atons"
      data={geojson}
      hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }}
      onPress={handlePress}
    >
      {/* Unselected AtoNs */}
      <Layer
        id="atons-symbol"
        type="symbol"
        filter={["!=", ["get", "id"], selectedId]}
        layout={{
          "icon-image": ["get", "icon"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 6, 0.15, 10, 0.25, 14, 0.4, 18, 0.6],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        }}
        paint={{
          "icon-color": ["get", "color"],
          "icon-opacity": 0.9,
          "icon-halo-color": "rgba(0, 0, 0, 0.5)",
          "icon-halo-width": 1,
        }}
      />

      {/* Selected AtoN (larger icon) */}
      <Layer
        id="atons-selected"
        type="symbol"
        filter={["==", ["get", "id"], selectedId]}
        layout={{
          "icon-image": ["get", "icon"],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 6, 0.25, 10, 0.4, 14, 0.6, 18, 0.8],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        }}
        paint={{
          "icon-color": ["get", "color"],
          "icon-opacity": 1.0,
          "icon-halo-color": "rgba(255, 255, 255, 0.8)",
          "icon-halo-width": 2,
        }}
      />
    </GeoJSONSource>
  );
}
