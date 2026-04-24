import { type AtoN, useAtoN } from "@/aton/hooks/useAtoN";
import { useSelection, useSelectionHandler } from "@/map/hooks/useSelection";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useCallback, useMemo } from "react";
import type { NativeSyntheticEvent } from "react-native";

type Position = { latitude: number; longitude: number };

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

const ATON_COLOR = "#f59e0b"; // amber
const ATON_ICON = "aton-default";

export default function AtoNLayer() {
  const atons = useAtoN();

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = Object.values(atons)
      .map((aton): GeoJSON.Feature | null => {
        const pos = atonPosition(aton);
        if (!pos) return null;
        return {
          type: "Feature",
          properties: {
            id: aton.id,
            name: atonName(aton),
            icon: ATON_ICON,
            color: ATON_COLOR,
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

  const handlePress = useCallback(
    (e: NativeSyntheticEvent<{ features: GeoJSON.Feature[] }>) => {
      const id = e.nativeEvent.features?.[0]?.properties?.id;
      if (id) {
        e.stopPropagation();
        navigate("aton", id);
      }
    },
    [navigate],
  );

  const selectedId = selection?.type === "aton" ? selection.id : "";

  return (
    <GeoJSONSource
      id="atons"
      data={geojson}
      hitbox={{ top: 22, right: 22, bottom: 22, left: 22 }}
      onPress={handlePress}
    >
      <Layer
        id="atons-symbol"
        type="symbol"
        layout={{
          "icon-image": ["get", "icon"],
          "icon-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6, ["case", ["==", ["get", "id"], selectedId], 0.25, 0.15],
            18, ["case", ["==", ["get", "id"], selectedId], 1, 0.6],
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        }}
        paint={{
          "icon-color": ["get", "color"],
          "icon-opacity": ["case", ["==", ["get", "id"], selectedId], 1.0, 0.9],
          "icon-halo-color": [
            "case",
            ["==", ["get", "id"], selectedId],
            "rgba(255, 255, 255, 0.3)",
            "rgba(0, 0, 0, 0.3)",
          ],
          "icon-halo-width": ["case", ["==", ["get", "id"], selectedId], 2, 1],
        }}
      />
    </GeoJSONSource>
  );
}
