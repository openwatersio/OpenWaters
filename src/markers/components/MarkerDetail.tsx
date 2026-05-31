import DistanceAndBearingText from "@/map/components/DistanceAndBearingText";
import NearbyList from "@/map/components/NearbyList";
import SheetMenu from "@/map/components/SheetMenu";
import { deleteMarker, useMarker } from "@/markers/hooks/useMarkers";
import { ensureVisible } from "@/navigation/components/NavigationCamera";
import { exportMarkerAsGPX } from "@/tracks/export";
import SheetHeader from "@/ui/SheetHeader";
import {
  Form,
  Host,
  Section,
  Text
} from "@expo/ui/swift-ui";
import { CoordinateFormat } from "coordinate-format";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

export default function MarkerDetail({ id }: { id: string }) {
  const markerId = Number(id);
  const marker = useMarker(markerId);

  const [latStr, lonStr] = useMemo(
    () => marker ? formatCoords(marker.latitude, marker.longitude) : ["—", "—"],
    [marker],
  );

  useFocusEffect(
    useCallback(() => {
      if (marker) ensureVisible(marker);
    }, [marker]),
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
      {marker && (
        <SheetMenu
          coordinate={marker}
          title={`${latStr} ${lonStr}`}
          showMarker={false}
        >
          <Stack.Toolbar.MenuAction icon="square.and.arrow.up" onPress={handleShare}>
            Export GPX…
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.Menu inline>
            <Stack.Toolbar.MenuAction
              icon="square.and.pencil"
              onPress={() => router.push({ pathname: "/marker/edit", params: { id: markerId } })}
            >
              Edit
            </Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction icon="trash" destructive onPress={confirmDelete}>
              Delete
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </SheetMenu>
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

          {marker && (
            <NearbyList
              center={{ latitude: marker.latitude, longitude: marker.longitude }}
              exclude={{ kind: "marker", id: String(markerId) }}
            />
          )}
        </Form>
      </Host>
    </>
  );
}
