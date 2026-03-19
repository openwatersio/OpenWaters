import SheetView from "@/components/ui/SheetView";
import { useNavigationState } from "@/hooks/useNavigationState";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { useWaypoints } from "@/hooks/useWaypoints";
import type { Waypoint } from "@/lib/database";
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

export default function WaypointList() {
  const waypoints = useWaypoints((s) => s.waypoints);
  const loadWaypoints = useWaypoints((s) => s.loadWaypoints);
  const deleteWaypoint = useWaypoints((s) => s.deleteWaypoint);
  const updateWaypoint = useWaypoints((s) => s.updateWaypoint);

  const nav = useNavigationState();
  const units = usePreferredUnits();
  const theme = useTheme();
  const [sort, setSort] = useState<SortBy>("created");

  useEffect(() => {
    loadWaypoints();
  }, [loadWaypoints]);

  const proximityMap = useMemo(() => {
    if (sort !== "nearby" || !nav.coords) return null;
    const { latitude, longitude } = nav.coords;
    const map = new Map<number, number>();
    for (const w of waypoints) {
      map.set(w.id, distanceMeters(latitude, longitude, w.latitude, w.longitude));
    }
    return map;
  }, [sort, waypoints, nav.coords?.latitude, nav.coords?.longitude]);

  const sortedWaypoints = useMemo(() => {
    return [...waypoints].sort((a, b) => {
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
  }, [waypoints, sort, proximityMap]);

  function confirmDelete(waypoint: Waypoint) {
    Alert.alert(
      "Delete Waypoint",
      `Delete "${waypoint.name ?? `Waypoint ${waypoint.id}`}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteWaypoint(waypoint.id) },
      ],
    );
  }

  function promptRename(waypoint: Waypoint) {
    Alert.prompt(
      "Rename Waypoint",
      undefined,
      (name: string) => updateWaypoint(waypoint.id, { name: name || null }),
      "plain-text",
      waypoint.name ?? "",
    );
  }

  function getDistanceLabel(waypoint: Waypoint): string | null {
    if (!nav.coords) return null;
    const dist = proximityMap?.get(waypoint.id)
      ?? distanceMeters(nav.coords.latitude, nav.coords.longitude, waypoint.latitude, waypoint.longitude);
    const formatted = units.toDistance(dist);
    const bearing = bearingDegrees(nav.coords.latitude, nav.coords.longitude, waypoint.latitude, waypoint.longitude);
    return `${formatted.value} ${formatted.abbr} ${formatBearing(bearing)}`;
  }

  return (
    <SheetView id="waypoints">
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
            {sortedWaypoints.map((waypoint) => {
              const distLabel = getDistanceLabel(waypoint);
              const coordsLabel = formatCoords(waypoint.latitude, waypoint.longitude);

              return (
                <ContextMenu key={waypoint.id}>
                  <ContextMenu.Trigger>
                    <VStack
                      alignment="leading"
                      spacing={2}
                      modifiers={[
                        onTapGesture(() => {
                          router.push({ pathname: "/waypoint/[id]", params: { id: waypoint.id } });
                        }),
                        padding({ vertical: 4 }),
                      ]}
                    >
                      <HStack spacing={6}>
                        <Text modifiers={[font({ size: 16, weight: "semibold" }), lineLimit(1)]}>
                          {waypoint.name ?? `Waypoint ${waypoint.id}`}
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
                      onPress={() => promptRename(waypoint)}
                    />
                    <Button
                      label="Delete"
                      systemImage="trash"
                      role="destructive"
                      onPress={() => confirmDelete(waypoint)}
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
