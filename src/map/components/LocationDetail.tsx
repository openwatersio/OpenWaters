import DistanceAndBearingText from "@/map/components/DistanceAndBearingText";
import NearbyList from "@/map/components/NearbyList";
import SheetBottomToolbar from "@/map/components/SheetBottomToolbar";
import MarkerButton from "@/markers/components/MarkerButton";
import RouteButton from "@/routes/components/RouteButton";
import SheetHeader from "@/ui/SheetHeader";
import { Form, Host, Section } from "@expo/ui/swift-ui";
import { CoordinateFormat } from "coordinate-format";
import { Stack } from "expo-router";
import { useMemo } from "react";
import { showLocation } from "react-native-map-link";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

export default function LocationDetail({ id }: { id: string }) {
  const [lon, lat] = id.split(",").map(Number) as [number, number];

  const [latStr, lonStr] = useMemo(() => formatCoords(lat, lon), [lat, lon]);

  return (
    <>
      <SheetHeader title="Location" subtitle={[latStr, lonStr].join(", ")} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="square.and.arrow.up"
          onPress={() =>
            showLocation({
              latitude: lat,
              longitude: lon,
              title: `${latStr} ${lonStr}`,
            })
          }
        >
          Open In…
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <SheetBottomToolbar>
        <MarkerButton latitude={lat} longitude={lon} />
        <RouteButton latitude={lat} longitude={lon} />
      </SheetBottomToolbar>
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <DistanceAndBearingText latitude={lat} longitude={lon} />
          </Section>
          <NearbyList center={{ latitude: lat, longitude: lon }} />
        </Form>
      </Host>
    </>
  );
}
