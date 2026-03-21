import SheetView from "@/components/ui/SheetView";
import { toDistance } from "@/hooks/usePreferredUnits";
import { useRouteNavigation } from "@/hooks/useRouteNavigation";
import {
  handleDeleteRoute,
  handleRenameRoute,
  loadRoutes,
  useLoadRoutes,
  useRoutes,
} from "@/hooks/useRoutes";
import useTheme from "@/hooks/useTheme";
import { insertRoute, type RouteWithStats } from "@/lib/database";
import { exportRouteAsGPX } from "@/lib/export";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  List,
  Menu,
  Text,
  Toggle,
  VStack
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
  labelStyle,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  padding,
  tint
} from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Alert, TouchableOpacity } from "react-native";

type SortBy = "recent" | "name" | "distance";

export function routeDisplayName(route: RouteWithStats): string {
  return route.name || `Route ${route.id}`;
}

export default function RouteList() {
  const routes = useRoutes((s) => s.routes);
  useLoadRoutes();
  const activeRouteId = useRouteNavigation((s) => s.activeRouteId);
  const theme = useTheme();
  const [sort, setSort] = useState<SortBy>("recent");

  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      switch (sort) {
        case "name":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "distance":
          return b.total_distance - a.total_distance;
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [routes, sort]);

  function confirmDelete(route: RouteWithStats) {
    Alert.alert(
      "Delete Route",
      `Delete "${routeDisplayName(route)}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteRoute(route.id) },
      ],
    );
  }

  function promptRename(route: RouteWithStats) {
    Alert.prompt(
      "Rename Route",
      undefined,
      (name: string) => handleRenameRoute(route.id, name),
      "plain-text",
      route.name || "",
    );
  }

  return (
    <SheetView id="routes">
      <Stack.Screen options={{
        headerLeft: () => (
          <Host matchContents>
            <Menu
              systemImage="line.3.horizontal.decrease"
              label="Sort"
              modifiers={[
                tint("primary"),
                labelStyle("iconOnly"),
                buttonStyle("borderless"),
              ]}>
              <Toggle
                systemImage="clock"
                isOn={sort === "recent"}
                onIsOnChange={(isOn) => isOn && setSort("recent")}
                label="Recent"
              />
              <Toggle
                systemImage="character"
                isOn={sort === "name"}
                onIsOnChange={(isOn) => isOn && setSort("name")}
                label="Name"
              />
              <Toggle
                systemImage="lines.measurement.vertical"
                isOn={sort === "distance"}
                onIsOnChange={(isOn) => isOn && setSort("distance")}
                label="Distance"
              />
            </Menu>
          </Host>
        ),
        headerRight: () => (
          <TouchableOpacity onPress={async () => {
            const route = await insertRoute();
            await loadRoutes();
            router.push({ pathname: "/route/edit", params: { id: route.id } });
          }}>
            <SymbolView name="plus" tintColor={theme.textPrimary} />
          </TouchableOpacity>
        )
      }} />
      <Host style={{ flex: 1 }}>
        <List>
          <List.ForEach>
            {sortedRoutes.map((route) => {
              const isNavigating = activeRouteId === route.id;
              const dist = route.total_distance > 0 ? toDistance(route.total_distance) : null;

              return (
                <ContextMenu key={route.id}>
                  <ContextMenu.Trigger>
                    <HStack
                      alignment="center"
                      spacing={12}
                      modifiers={[
                        onTapGesture(() => {
                          router.dismissAll();
                          router.push({ pathname: "/feature/[type]/[id]", params: { type: "route", id: String(route.id) } });
                        }),
                        padding({ vertical: 4 }),
                      ]}
                    >
                      <VStack alignment="leading" spacing={2}>
                        <HStack spacing={6}>
                          <Text modifiers={[font({ size: 16, weight: "semibold" }), lineLimit(1)]}>
                            {routeDisplayName(route)}
                          </Text>
                          {isNavigating && (
                            <Text modifiers={[foregroundStyle(theme.primary), font({ size: 12 })]}>
                              ▶
                            </Text>
                          )}
                        </HStack>
                        <HStack spacing={6}>
                          <Text
                            modifiers={[
                              font({ size: 13 }),
                              monospacedDigit(),
                              foregroundStyle("secondary"),
                            ]}
                          >
                            {route.point_count} {route.point_count === 1 ? "waypoint" : "waypoints"}
                          </Text>
                          {dist && (
                            <Text
                              modifiers={[
                                font({ size: 13 }),
                                monospacedDigit(),
                                foregroundStyle("secondary"),
                              ]}
                            >
                              · {dist.value} {dist.abbr}
                            </Text>
                          )}
                        </HStack>
                      </VStack>
                    </HStack>
                  </ContextMenu.Trigger>

                  <ContextMenu.Items>
                    <Button
                      label="Rename"
                      systemImage="pencil"
                      onPress={() => promptRename(route)}
                    />
                    <Button
                      label="Export GPX"
                      systemImage="square.and.arrow.up"
                      onPress={() => exportRouteAsGPX(route.id)}
                    />
                    <Button
                      label="Delete"
                      systemImage="trash"
                      role="destructive"
                      onPress={() => confirmDelete(route)}
                    />
                  </ContextMenu.Items>
                </ContextMenu>
              );
            })}
          </List.ForEach>
        </List>
      </Host >
    </SheetView >
  );
}
