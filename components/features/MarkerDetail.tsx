import DistanceAndBearingText from "@/components/DistanceAndBearingText";
import RouteButton from "@/components/toolbar/RouteButton";
import SheetBottomToolbar from "@/components/toolbar/SheetBottomToolbar";
import SheetHeader from "@/components/ui/SheetHeader";
import { deleteMarker, useMarkers } from "@/hooks/useMarkers";
import { exportMarkerAsGPX } from "@/lib/export";
import {
  Button,
  Form,
  Host,
  Section,
  Text
} from "@expo/ui/swift-ui";
import { CoordinateFormat } from "coordinate-format";
import { router, Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { showLocation } from "react-native-map-link";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

export default function MarkerDetail({ id }: { id: string }) {
  const markerId = Number(id);
  const marker = useMarkers((s) => s.markers.find((m) => m.id === markerId) ?? null);

  const [latStr, lonStr] = useMemo(
    () => marker ? formatCoords(marker.latitude, marker.longitude) : ["—", "—"],
    [marker],
  );

  const handleShare = useCallback(async () => {
    if (!marker) return;
    try {
      await exportMarkerAsGPX(marker);
    } catch (e) {
      Alert.alert("Export Failed", String(e));
    }
  }, [marker]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete Marker",
      `Delete "${marker?.name ?? `Marker ${markerId}`}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMarker(markerId);
            router.dismiss();
          },
        },
      ],
    );
  }, [markerId, marker?.name]);

  return (
    <>
      <SheetHeader
        title={marker?.name ?? "Marker"}
        subtitle={[latStr, lonStr,].join(", ")}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Menu icon="square.and.arrow.up" title="Share">
          <Stack.Toolbar.MenuAction
            icon="square.and.arrow.up"
            onPress={handleShare}
          >
            Export GPX…
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="map"
            onPress={() => showLocation({
              latitude: marker?.latitude,
              longitude: marker?.longitude,
              title: `${latStr} ${lonStr}`,
            })}
          >
            Open in…
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      {marker && (
        <SheetBottomToolbar>
          <RouteButton latitude={marker.latitude} longitude={marker.longitude} />
        </SheetBottomToolbar>
      )}
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            {marker && (
              <DistanceAndBearingText
                latitude={marker.latitude}
                longitude={marker.longitude}
              />
            )}
            {/* Notes */}
            {marker?.notes && (
              <Text>
                {marker.notes}
              </Text>
            )}
          </Section>
          <Section>
            <Button
              label="Edit"
              onPress={() => router.push({ pathname: "/marker/edit", params: { id: markerId } })}
            />
            <Button
              label="Delete"
              role="destructive"
              onPress={confirmDelete}
            />
          </Section>
        </Form>
      </Host>
    </>
  );
}
