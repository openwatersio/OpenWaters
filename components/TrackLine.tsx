import { useCameraView } from "@/hooks/useCameraView";
import useTheme from "@/hooks/useTheme";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";

type Coord = [number, number];

type TrackLineProps = {
  id: string;
  coords: Coord[];
  color: string;
};

/**
 * Renders a line on the map from an array of coordinates.
 * Automatically clips to the visible viewport for performance.
 */
export default function TrackLine({ id, coords, color }: TrackLineProps) {
  const bounds = useCameraView((s) => s.bounds);
  const theme = useTheme();

  const data = useMemo(() => {
    const visible = bounds ? clipToViewport(coords, bounds) : coords;
    return JSON.stringify({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: visible },
    });
  }, [coords, bounds]);

  if (!data) return null;

  return (
    <GeoJSONSource id={id} data={data}>
      <Layer
        id={`${id}-line-halo`}
        type="line"
        paint={{
          "line-width": 7,
          "line-opacity": 0.5,
          "line-color": theme.background,
        }}
        layout={{
          "line-cap": "round",
          "line-join": "round",
        }}
      />
      <Layer
        id={`${id}-line`}
        type="line"
        paint={{
          "line-width": 4,
          "line-opacity": 1,
          "line-color": color,
        }}
        layout={{
          "line-cap": "round",
          "line-join": "round",
        }}
      />
    </GeoJSONSource>
  );
}

/**
 * Clip coordinates to the visible viewport with a generous margin,
 * preserving connectivity by including one point outside each edge.
 */
function clipToViewport(coords: Coord[], bounds: LngLatBounds): Coord[] {
  if (coords.length === 0) return coords;

  const [west, south, east, north] = bounds;
  const marginLng = (east - west) * 0.5;
  const marginLat = (north - south) * 0.5;
  const w = west - marginLng;
  const s = south - marginLat;
  const e = east + marginLng;
  const n = north + marginLat;

  let firstVisible = -1;
  let lastVisible = -1;
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    if (c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n) {
      if (firstVisible === -1) firstVisible = i;
      lastVisible = i;
    }
  }

  if (firstVisible === -1) return [];

  const start = Math.max(0, firstVisible - 1);
  const end = Math.min(coords.length - 1, lastVisible + 1);
  return coords.slice(start, end + 1);
}
