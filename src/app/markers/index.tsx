import { AnnotationIcon } from "@/components/map/AnnotationIcon";
import SheetView from "@/components/ui/SheetView";
import { deleteMarker, loadMarkers, updateMarker, useMarkers } from "@/hooks/useMarkers";
import { usePosition } from "@/hooks/useNavigation";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import type { Marker } from "@/lib/database";
import { formatBearing } from "@/lib/geo";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  List,
  RNHostView,
  Spacer,
  Text,
  VStack
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
  monospacedDigit,
  onTapGesture,
  padding
} from "@expo/ui/swift-ui/modifiers";
import { CoordinateFormat } from "coordinate-format";
import { router, Stack, StackToolbarMenuActionProps } from "expo-router";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";

type SortBy = "name" | "created" | "nearby";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): string {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return `${latStr}  ${lonStr}`;
}

export default function MarkerList() {
  const markers = useMarkers((s) => s.markers);
  const position = usePosition();
  const theme = useTheme();
  const [sort, setSort] = useState<SortBy>("created");

  const sortOptions: { label: string, value: SortBy, icon: StackToolbarMenuActionProps["icon"] }[] = [
    { label: "Recent", value: "created", icon: "clock" },
    { label: "Name", value: "name", icon: "character" },
    { label: "Nearby", value: "nearby", icon: "location" },
  ]

  useEffect(() => {
    loadMarkers();
  }, []);

  const proximityMap = useMemo(() => {
    if (sort !== "nearby" || !position) return null;
    const map = new Map<number, number>();
    for (const m of markers) {
      map.set(m.id, getDistance(position, m));
    }
    return map;
  }, [sort, markers, position]);

  const sortedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "nearby": {
          const distA = proximityMap?.get(a.id) ?? Infinity;
          const distB = proximityMap?.get(b.id) ?? Infinity;
          return distA - distB;
        }
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [markers, sort, proximityMap]);

  function confirmDelete(marker: Marker) {
    Alert.alert(
      "Delete Marker",
      `Delete "${marker.name ?? `Marker ${marker.id}`}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMarker(marker.id) },
      ],
    );
  }

  function promptRename(marker: Marker) {
    Alert.prompt(
      "Rename Marker",
      undefined,
      (name: string) => updateMarker(marker.id, { name: name || null }),
      "plain-text",
      marker.name ?? "",
    );
  }

  function getDistanceLabel(marker: Marker): string | null {
    if (!position) return null;
    const dist = proximityMap?.get(marker.id)
      ?? getDistance(position, marker);
    const formatted = toDistance(dist);
    const bearing = getGreatCircleBearing(position, marker);
    return `${formatted.value} ${formatted.abbr} ${formatBearing(bearing)}`;
  }

  return (
    <SheetView id="markers">
      <Stack.Screen options={{}} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease" title="Sort">
          {sortOptions.map(({ label, value, icon }) => (
            <Stack.Toolbar.MenuAction
              key={value}
              icon={icon}
              isOn={sort === value}
              onPress={() => setSort(value)}
            >
              {label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="xmark"
          onPress={() => router.dismissTo("/menu")}
        />
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <List modifiers={[listStyle("plain")]}>
          <List.ForEach>
            {sortedMarkers.map((marker) => {
              const distLabel = getDistanceLabel(marker);
              const coordsLabel = formatCoords(marker.latitude, marker.longitude);

              return (
                <ContextMenu key={marker.id}>
                  <ContextMenu.Trigger>
                    <HStack
                      alignment="center"
                      spacing={16}
                      modifiers={[
                        onTapGesture(() => {
                          router.dismissTo({ pathname: "/feature/[type]/[id]", params: { type: "marker", id: String(marker.id) } });
                        }),
                        padding({ vertical: 4 }),
                      ]}
                    >
                      <RNHostView matchContents>
                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: marker.color ?? theme.primary,
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <AnnotationIcon name={marker.icon ?? "pin"} color="white" size={18} />
                        </View>
                      </RNHostView>
                      <VStack alignment="leading" spacing={2}>
                        <HStack spacing={6}>
                          <Text modifiers={[font({ size: 16, weight: "semibold" }), lineLimit(1)]}>
                            {marker.name ?? `Marker ${marker.id}`}
                          </Text>
                          <Spacer />
                          {distLabel && (
                            <Text modifiers={[font({ size: 13 }), monospacedDigit(), foregroundStyle("secondary")]}>
                              {distLabel}
                            </Text>
                          )}
                        </HStack>
                        <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle(theme.textSecondary)]}>
                          {coordsLabel}
                        </Text>
                      </VStack>
                    </HStack>
                  </ContextMenu.Trigger>

                  <ContextMenu.Items>
                    <Button
                      label="Rename"
                      systemImage="pencil"
                      onPress={() => promptRename(marker)}
                    />
                    <Button
                      label="Delete"
                      systemImage="trash"
                      role="destructive"
                      onPress={() => confirmDelete(marker)}
                    />
                  </ContextMenu.Items>
                </ContextMenu>
              );
            })}
          </List.ForEach>
        </List>
      </Host>
    </SheetView>
  );
}
