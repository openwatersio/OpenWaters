import SheetView from "@/components/ui/SheetView";
import { toDistance } from "@/hooks/usePreferredUnits";
import {
  getActiveRoute,
  handleDeleteRoute,
  handleRenameRoute,
  RouteMode,
  useActiveRoute,
  useRoutes,
} from "@/hooks/useRoutes";
import useTheme from "@/hooks/useTheme";
import { type Route, type RoutesOrder } from "@/lib/database";
import { exportRouteAsGPX } from "@/lib/export";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  List,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
  monospacedDigit,
  onTapGesture,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { router, Stack, StackToolbarMenuActionProps } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

export function routeDisplayName(route: Route): string {
  return route.name || `Route ${route.id}`;
}

export default function RouteList() {
  const [sort, setSort] = useState<RoutesOrder>("recent");
  const routes = useRoutes({ order: sort });
  const activeRouteId = useActiveRoute((a) => (a?.mode === RouteMode.Navigating ? a.id : null));
  const theme = useTheme();

  const sortOptions: {
    label: string;
    value: RoutesOrder;
    icon: StackToolbarMenuActionProps["icon"];
  }[] = [
      { label: "Recent", value: "recent", icon: "clock" },
      { label: "Name", value: "name", icon: "character" },
      { label: "Distance", value: "distance", icon: "lines.measurement.vertical" },
    ];

  /**
   * Open a route, prompting if there's already an active route in the store.
   * Custom destructive copy if the active route has unsaved edits.
   */
  function openRoute(route: Route) {
    console.log("Opening route", route.id);
    const active = getActiveRoute();
    const targetPath = { pathname: "/route/[id]" as const, params: { id: String(route.id) } };

    if (!active || active.id === route.id) {
      router.dismissTo(targetPath);
      return;
    }

    const activeName = active.name || (active.id != null ? `Route ${active.id}` : "the new route");
    const newName = routeDisplayName(route);

    if (active.mode === RouteMode.Editing) {
      Alert.alert(
        "Discard Changes?",
        `You have unsaved changes to "${activeName}". Discard and open "${newName}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              router.dismissAll();
              router.push(targetPath);
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "Replace Route?",
        `Replace the currently open route ("${activeName}")?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open",
            onPress: () => {
              router.dismissAll();
              router.push(targetPath);
            },
          },
        ],
      );
    }
  }

  function confirmDelete(route: Route) {
    Alert.alert(
      "Delete Route",
      `Delete "${routeDisplayName(route)}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteRoute(route.id) },
      ],
    );
  }

  function promptRename(route: Route) {
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
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <List modifiers={[listStyle("plain")]}>
          <List.ForEach>
            {routes.map((route) => {
              const isNavigating = activeRouteId === route.id;
              const dist = route.distance > 0 ? toDistance(route.distance) : null;

              return (
                <ContextMenu key={route.id}>
                  <ContextMenu.Trigger>
                    <HStack
                      alignment="center"
                      spacing={12}
                      modifiers={[
                        onTapGesture(() => openRoute(route)),
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
                        {dist && (
                          <Text
                            modifiers={[
                              font({ size: 13 }),
                              monospacedDigit(),
                              foregroundStyle("secondary"),
                            ]}
                          >
                            {dist.value} {dist.abbr}
                          </Text>
                        )}
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
