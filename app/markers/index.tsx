import SheetView from "@/components/ui/SheetView";
import { useNavigationState } from "@/hooks/useNavigationState";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { useMarkers } from "@/hooks/useMarkers";
import type { Marker } from "@/lib/database";
import { bearingDegrees, distanceMeters, formatBearing } from "@/lib/geo";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  List,
  Picker,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  labelsHidden,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  padding,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { CoordinateFormat } from "coordinate-format";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

type SortBy = "name" | "created" | "nearby";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): string {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return `${latStr}  ${lonStr}`;
}

export default function MarkerList() {
  const markers = useMarkers((s) => s.markers);
  const loadMarkers = useMarkers((s) => s.loadMarkers);
  const deleteMarker = useMarkers((s) => s.deleteMarker);
  const updateMarker = useMarkers((s) => s.updateMarker);

  const nav = useNavigationState();
  const units = usePreferredUnits();
  const theme = useTheme();
  const [sort, setSort] = useState<SortBy>("created");

  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  const proximityMap = useMemo(() => {
    if (sort !== "nearby" || !nav.coords) return null;
    const { latitude, longitude } = nav.coords;
    const map = new Map<number, number>();
    for (const m of markers) {
      map.set(m.id, distanceMeters(latitude, longitude, m.latitude, m.longitude));
    }
    return map;
  }, [sort, markers, nav.coords?.latitude, nav.coords?.longitude]);

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
    if (!nav.coords) return null;
    const dist = proximityMap?.get(marker.id)
      ?? distanceMeters(nav.coords.latitude, nav.coords.longitude, marker.latitude, marker.longitude);
    const formatted = units.toDistance(dist);
    const bearing = bearingDegrees(nav.coords.latitude, nav.coords.longitude, marker.latitude, marker.longitude);
    return `${formatted.value} ${formatted.abbr} ${formatBearing(bearing)}`;
  }

  return (
    <SheetView id="markers">
      <Host style={{ flex: 1 }}>
        <List>
          <Picker
            selection={sort}
            onSelectionChange={(s) => setSort(s as SortBy)}
            modifiers={[pickerStyle("segmented"), labelsHidden()]}
          >
            <Text modifiers={[tag("created")]}>Recent</Text>
            <Text modifiers={[tag("name")]}>Name</Text>
            <Text modifiers={[tag("nearby")]}>Nearby</Text>
          </Picker>

          <List.ForEach>
            {sortedMarkers.map((marker) => {
              const distLabel = getDistanceLabel(marker);
              const coordsLabel = formatCoords(marker.latitude, marker.longitude);

              return (
                <ContextMenu key={marker.id}>
                  <ContextMenu.Trigger>
                    <VStack
                      alignment="leading"
                      spacing={2}
                      modifiers={[
                        onTapGesture(() => {
                          router.push({ pathname: "/marker/[id]", params: { id: marker.id } });
                        }),
                        padding({ vertical: 4 }),
                      ]}
                    >
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
