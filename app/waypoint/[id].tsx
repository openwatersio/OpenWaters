import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useNavigationState } from "@/hooks/useNavigationState";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useSheetDetents } from "@/hooks/useSheetDetents";
import useTheme from "@/hooks/useTheme";
import { useWaypoints } from "@/hooks/useWaypoints";
import { exportWaypointAsGPX } from "@/lib/exportTrack";
import { bearingDegrees, distanceMeters, formatBearing } from "@/lib/geo";
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
  padding,
  tint
} from "@expo/ui/swift-ui/modifiers";
import { useHeaderHeight } from "@react-navigation/elements";
import { CoordinateFormat } from "coordinate-format";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import { showLocation } from "react-native-map-link";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

export default function WaypointScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const waypointId = Number(id);

  const waypoint = useWaypoints((s) => s.waypoints.find((w) => w.id === waypointId) ?? null);
  const setSelected = useWaypoints((s) => s.setSelected);
  const deleteWaypoint = useWaypoints((s) => s.deleteWaypoint);

  const nav = useNavigationState();
  const units = usePreferredUnits();
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const { setDetentHeight } = useSheetDetents([0.4, 1]);

  useEffect(() => {
    setDetentHeight(headerHeight);
  }, [headerHeight, setDetentHeight]);

  useEffect(() => {
    setSelected(waypointId);
    return () => setSelected(null);
  }, [waypointId, setSelected]);

  const distBearing = useMemo(() => {
    if (!nav.coords?.latitude || !nav.coords?.longitude || !waypoint) return null;
    const dist = distanceMeters(nav.coords.latitude, nav.coords.longitude, waypoint.latitude, waypoint.longitude);
    const bearing = bearingDegrees(nav.coords.latitude, nav.coords.longitude, waypoint.latitude, waypoint.longitude);
    return { dist, bearing };
  }, [waypoint?.latitude, waypoint?.longitude, nav.coords?.latitude, nav.coords?.longitude]);

  const distFormatted = distBearing ? units.toDistance(distBearing.dist) : null;
  const bearingFormatted = distBearing ? formatBearing(distBearing.bearing) : null;

  const [latStr, lonStr] = useMemo(
    () => waypoint ? formatCoords(waypoint.latitude, waypoint.longitude) : ["—", "—"],
    [waypoint?.latitude, waypoint?.longitude],
  );

  const handleShare = useCallback(async () => {
    if (!waypoint) return;
    try {
      await exportWaypointAsGPX(waypoint);
    } catch (e) {
      Alert.alert("Export Failed", String(e));
    }
  }, [waypoint]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete Waypoint",
      `Delete "${waypoint?.name ?? `Waypoint ${waypointId}`}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteWaypoint(waypointId);
            router.dismiss();
          },
        },
      ],
    );
  }, [waypointId, waypoint?.name, deleteWaypoint]);

  return (
    <SheetView id="waypoint" style={{ flex: 1 }}>
      <SheetHeader
        title={waypoint?.name ?? "Waypoint"}
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
                  latitude: waypoint?.latitude,
                  longitude: waypoint?.longitude,
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
          <Section modifiers={[padding({ horizontal: 20, vertical: 16 })]}>
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
            {waypoint?.notes && (
              <Text>
                {waypoint.notes}
              </Text>
            )}
          </Section>
          <Section>
            <Button
              label="Edit"
              onPress={() => router.push({ pathname: "/waypoint/edit", params: { id: waypointId } })}
            />
            <Button
              label="Delete"
              role="destructive"
              onPress={confirmDelete}
            />
          </Section>
        </Form>
      </Host>
    </SheetView>
  );
}
