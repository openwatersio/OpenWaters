import { flyTo } from "@/components/map/NavigationCamera";
import CloseButton from "@/components/ui/CloseButton";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useNavigation } from "@/hooks/useNavigation";
import { toDistance } from "@/hooks/usePreferredUnits";
import {
  addDraftPoint,
  clearDraft,
  initDraft,
  initDraftFromRoute,
  moveDraftPoint,
  removeDraftPoint,
  selectDraftPoint,
  setDraftName,
  useRouteDraft,
} from "@/hooks/useRouteDraft";
import { loadRoutes } from "@/hooks/useRoutes";
import { useSheetDetents } from "@/hooks/useSheetDetents";
import {
  deleteRoutePoint,
  getRoutePoints,
  insertRoute,
  insertRoutePoint,
  updateRoute,
} from "@/lib/database";
import { formatBearing } from "@/lib/geo";
import {
  Button,
  Host,
  HStack,
  List,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  environment,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  listStyle,
  monospacedDigit,
  onTapGesture,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useHeaderHeight } from "@react-navigation/elements";
import { CoordinateFormat } from "coordinate-format";
import { router, useLocalSearchParams } from "expo-router";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";

const coordFormat = new CoordinateFormat("minutes");

/**
 * Unified route editor. When `id` is provided, edits an existing route.
 * Without `id`, creates a new route (optionally seeded with `to` coordinates).
 *
 * Usage:
 *   router.navigate({ pathname: "/route/edit" })                        // new
 *   router.navigate({ pathname: "/route/edit", params: { id: "123" } }) // edit
 *   router.navigate({ pathname: "/route/edit", params: { to: "lon,lat" } }) // new with destination
 */
export default function EditRouteScreen() {
  const { id, to } = useLocalSearchParams<{ id?: string; to?: string }>();
  const routeId = id ? Number(id) : null;
  const isNew = routeId === null;

  const points = useRouteDraft((s) => s.points);
  const name = useRouteDraft((s) => s.name);
  const selectedIndex = useRouteDraft((s) => s.selectedIndex);
  const headerHeight = useHeaderHeight();
  const { setDetentHeight } = useSheetDetents([0.5, 1]);

  useEffect(() => {
    setDetentHeight(headerHeight);
  }, [headerHeight, setDetentHeight]);

  // Initialize draft on mount
  useEffect(() => {
    if (routeId !== null) {
      initDraftFromRoute(routeId);
    } else {
      initDraft([]);

      const { latitude, longitude } = useNavigation.getState();
      if (latitude && longitude) {
        addDraftPoint({ latitude, longitude });
      }

      if (to) {
        const [toLon, toLat] = to.split(",").map(Number) as [number, number];
        addDraftPoint({ latitude: toLat, longitude: toLon });
      }
    }

    return () => clearDraft();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const legs = useMemo(() => {
    if (points.length < 2) return [];
    return points.slice(1).map((point, i) => {
      const prev = points[i];
      const dist = getDistance(prev, point);
      const bearing = getGreatCircleBearing(prev, point);
      return { from: prev, to: point, dist, bearing };
    });
  }, [points]);

  const totalDistance = useMemo(
    () => legs.reduce((sum, leg) => sum + leg.dist, 0),
    [legs],
  );

  const handleSelect = useCallback((index: number, point: { longitude: number; latitude: number }) => {
    selectDraftPoint(index);
    flyTo({
      center: [point.longitude, point.latitude],
      duration: 600,
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (points.length > 0) {
      Alert.alert(
        isNew ? "Discard Route?" : "Discard Changes?",
        isNew
          ? "You have unsaved waypoints that will be lost."
          : "Your changes will be lost.",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              clearDraft();
              router.dismiss();
            },
          },
        ],
      );
    } else {
      clearDraft();
      router.dismiss();
    }
  }, [points.length, isNew]);

  const handleSave = useCallback(async () => {
    if (isNew && points.length === 0) {
      clearDraft();
      router.dismiss();
      return;
    }

    if (isNew) {
      // Create new route
      const route = await insertRoute(name ?? undefined);
      for (let i = 0; i < points.length; i++) {
        await insertRoutePoint(route.id, {
          latitude: points[i].latitude,
          longitude: points[i].longitude,
          order: i,
        });
      }
      clearDraft();
      await loadRoutes();
      router.replace({ pathname: "/feature/[type]/[id]", params: { type: "route", id: String(route.id) } });
    } else {
      // Update existing route: replace name and all points
      await updateRoute(routeId!, { name: name || null });

      // Delete existing points and re-insert
      const existingPoints = await getRoutePoints(routeId!);
      for (const point of existingPoints) {
        await deleteRoutePoint(point.id);
      }
      for (let i = 0; i < points.length; i++) {
        await insertRoutePoint(routeId!, {
          latitude: points[i].latitude,
          longitude: points[i].longitude,
          order: i,
        });
      }
      clearDraft();
      await loadRoutes();
      router.dismiss();
    }
  }, [isNew, routeId, name, points]);

  const dist = toDistance(totalDistance);

  const handleRename = useCallback(() => {
    Alert.prompt(
      "Route Name",
      undefined,
      (value) => setDraftName(value.trim() || null),
      "plain-text",
      name ?? "",
    );
  }, [name]);

  return (
    <SheetView id="route-edit" style={{ flex: 1 }}>
      <SheetHeader
        title={name || "New Route"}
        subtitle={points.length > 0
          ? `${points.length} ${points.length === 1 ? "waypoint" : "waypoints"} · ${dist.value} ${dist.abbr}`
          : undefined
        }
        onPressTitle={handleRename}
        headerLeft={() => (<CloseButton onPress={handleCancel} />)}
        headerRight={() => (
          <Host matchContents>
            <Button
              systemImage="checkmark"
              label="Save"
              onPress={handleSave}
              modifiers={[
                labelStyle("iconOnly"),
                tint("primary"),
                font({ weight: "semibold" }),
              ]}
            />
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <List modifiers={[
          listStyle("automatic"),
          environment("editMode", "active"),
        ]}>
          {points.length > 0 ? (
            <List.ForEach
              onDelete={(indices) => {
                for (const i of indices) removeDraftPoint(i);
              }}
              onMove={(sourceIndices, destination) => {
                moveDraftPoint(sourceIndices[0], destination);
              }}
            >
              {points.map((point, i) => {
                const leg = i > 0 ? legs[i - 1] : null;
                const legDist = leg ? toDistance(leg.dist) : null;
                const legBearing = leg ? formatBearing(leg.bearing) : null;
                const isSelected = selectedIndex === i;

                return (
                  <HStack
                    key={point.key}
                    alignment="center"
                    spacing={8}
                    modifiers={[
                      onTapGesture(() => { handleSelect(i, point); }),
                    ]}
                  >
                    <Text modifiers={[
                      font({ size: 13, weight: "medium" }),
                      foregroundStyle(isSelected ? "primary" : "secondary"),
                      frame({ width: 20 }),
                    ]}>
                      {i + 1}
                    </Text>
                    <VStack alignment="leading" spacing={2}>
                      <Text modifiers={[monospacedDigit()]}>
                        {coordFormat.latitude(point.latitude)}
                        {" • "}
                        {coordFormat.longitude(point.longitude)}
                      </Text>
                      {leg && (
                        <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle("secondary")]}>
                          {legDist?.value} {legDist?.abbr} at {legBearing}
                        </Text>
                      )}
                    </VStack>
                    <Spacer />
                  </HStack>
                );
              })}
            </List.ForEach>
          ) : (
            <VStack alignment="center" spacing={8} modifiers={[padding({ all: 40 })]}>
              <Text modifiers={[font({ size: 15 }), foregroundStyle("secondary")]}>
                No waypoints yet
              </Text>
            </VStack>
          )}
        </List>
      </Host>
    </SheetView>
  );
}
