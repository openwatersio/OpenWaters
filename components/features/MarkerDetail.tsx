import SheetHeader from "@/components/ui/SheetHeader";
import { deleteMarker, useMarkers } from "@/hooks/useMarkers";
import { usePosition } from "@/hooks/useNavigation";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { exportMarkerAsGPX } from "@/lib/export";
import { formatBearing } from "@/lib/geo";
import {
  Button,
  Form,
  Host,
  HStack,
  Image,
  Menu,
  Section,
  Spacer,
  Text
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
  labelStyle,
  monospacedDigit,
  offset,
  tint
} from "@expo/ui/swift-ui/modifiers";
import { CoordinateFormat } from "coordinate-format";
import { router } from "expo-router";
import { getDistance, getGreatCircleBearing } from "geolib";
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

  const position = usePosition();
  const theme = useTheme();

  const distBearing = useMemo(() => {
    if (!position || !marker) return null;
    const dist = getDistance(position, marker);
    const bearing = getGreatCircleBearing(position, marker);
    return { dist, bearing };
  }, [marker, position]);

  const distFormatted = distBearing ? toDistance(distBearing.dist) : null;
  const bearingFormatted = distBearing ? formatBearing(distBearing.bearing) : null;

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
        headerLeft={() => (
          <Host matchContents>
            <Menu
              systemImage="square.and.arrow.up"
              label="Share"
              modifiers={[
                labelStyle("iconOnly"),
                buttonStyle("borderless"),
              ]}>
              <Button
                onPress={handleShare}
                modifiers={[
                  tint("primary"),
                  offset({ y: -3 }),
                ]}
                label="Export GPX…"
              />
              <Button
                onPress={() => showLocation({
                  latitude: marker?.latitude,
                  longitude: marker?.longitude,
                  title: `${latStr} ${lonStr}`,
                })}
                modifiers={[
                  tint("primary"),
                  offset({ y: -3 }),
                ]}
                label="Open in…"
              />
            </Menu>
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            {/* Distance & Bearing */}
            {distBearing && (
              <HStack spacing={6}>
                <Spacer />
                <Image systemName="location.fill" size={14} color={theme.textSecondary} />
                <Text modifiers={[font({ size: 15, weight: "medium" }), monospacedDigit(), foregroundStyle("secondary")]}>
                  {`${distFormatted?.value} ${distFormatted?.abbr} at ${bearingFormatted}`}
                </Text>
                <Spacer />
              </HStack>
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
