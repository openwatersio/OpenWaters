import useTheme from "@/hooks/useTheme";
import { GeoJSONSource, Layer } from "@maplibre/maplibre-react-native";

type Coord = [number, number];

type TrackLineProps = {
  id: string;
  coordinates: Coord[];
  color: string;
};

/**
 * Renders a line on the map from an array of coordinates.
 * Automatically clips to the visible viewport for performance.
 */
export default function TrackLine({ id, coordinates, color }: TrackLineProps) {
  const theme = useTheme();

  return (
    <GeoJSONSource id={id} data={{
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    }}>
      <Layer
        id={`${id}-line-halo`}
        type="line"
        paint={{
          "line-width": 6,
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
          "line-width": 3,
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
