import { type Route } from "@/database";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { createStyles } from "@/hooks/useStyles";
import {
  getActiveRoute,
  handleDeleteRoute,
  handleRenameRoute,
  RouteMode,
} from "@/routes/hooks/useRoutes";
import { exportRouteAsGPX } from "@/tracks/export";
import { router } from "expo-router";
import { memo } from "react";
import {
  ActionSheetIOS,
  Alert,
  PlatformColor,
  Pressable,
  Text,
  View,
} from "react-native";

export function routeDisplayName(route: Route): string {
  return route.name || `Route ${route.id}`;
}

function openRoute(route: Route) {
  const active = getActiveRoute();
  const targetPath = {
    pathname: "/route/[id]" as const,
    params: { id: String(route.id) },
  };

  if (!active.isActive) {
    router.dismissTo(targetPath);
    return;
  }

  if (active.id === route.id) {
    router.dismissTo("/activity");
    return;
  }

  const currentName =
    active.name || (active.id != null ? `Route ${active.id}` : "the new route");
  const newName = routeDisplayName(route);

  if (active.mode === RouteMode.Editing) {
    Alert.alert(
      "Discard Changes?",
      `You have unsaved changes to "${currentName}". Discard and open "${newName}"?`,
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
      `Replace the currently open route ("${currentName}")?`,
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
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDeleteRoute(route.id),
      },
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

function showRouteActions(route: Route) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: routeDisplayName(route),
      options: ["Rename", "Export GPX", "Delete", "Cancel"],
      destructiveButtonIndex: 2,
      cancelButtonIndex: 3,
    },
    (index) => {
      if (index === 0) promptRename(route);
      else if (index === 1) exportRouteAsGPX(route.id);
      else if (index === 2) confirmDelete(route);
    },
  );
}

type Props = {
  route: Route;
  isNavigating: boolean;
};

const RouteListItem = memo(
  function RouteListItem({ route, isNavigating }: Props) {
    const theme = useTheme();
    const styles = useStyles();
    const dist = route.distance > 0 ? toDistance(route.distance) : null;

    return (
      <Pressable
        onPress={() => openRoute(route)}
        onLongPress={() => showRouteActions(route)}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: PlatformColor("systemFill") },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {routeDisplayName(route)}
          </Text>
          {isNavigating && (
            <Text style={{ color: theme.routes, fontSize: 12 }}>▶</Text>
          )}
        </View>
        {dist && (
          <Text style={styles.distance}>
            {dist.value} {dist.abbr}
          </Text>
        )}
      </Pressable>
    );
  },
  (prev, next) =>
    prev.isNavigating === next.isNavigating &&
    prev.route.id === next.route.id &&
    prev.route.name === next.route.name &&
    prev.route.distance === next.route.distance,
);

export default RouteListItem;

const useStyles = createStyles((theme) => ({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    gap: 2,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 16, fontWeight: "600", flexShrink: 1, color: theme.label },
  distance: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: theme.labelSecondary,
  },
}));
