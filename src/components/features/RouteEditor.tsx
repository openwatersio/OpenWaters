import { flyTo } from "@/components/map/NavigationCamera";
import SheetHeader from "@/components/ui/SheetHeader";
import { useNavigationState } from "@/hooks/useNavigationState";
import { toDistance } from "@/hooks/usePreferredUnits";
import {
  clearActiveRoute,
  handleDeleteRoute,
  moveRouteWaypoint,
  removeRouteWaypoint,
  RouteMode,
  saveActiveRoute,
  setActiveIndex,
  setActiveRoute,
  setRouteName,
  startNavigation,
  useActiveRoute,
  type ActiveRoute,
} from "@/hooks/useRoutes";
import useTheme from "@/hooks/useTheme";
import { exportRouteAsGPX } from "@/lib/export";
import { calculateRouteLegs, formatBearing } from "@/lib/geo";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  buttonStyle,
  controlSize,
  environment,
  font,
  foregroundStyle,
  listStyle,
  monospacedDigit,
  onTapGesture,
  padding,
  tint
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { CoordinateFormat } from "coordinate-format";
import { router, Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import WaypointBadge from "../routes/WaypointBadge";

const coordFormat = new CoordinateFormat("minutes");

function routeDisplayName(active: ActiveRoute): string {
  if (active.name) return active.name;
  if (active.id != null) return `Route ${active.id}`;
  return "New Route";
}

/**
 * Unified route view + edit screen body. Reads from the active-route store
 * and renders the editable waypoint list, save/cancel toolbar, and the
 * detail-screen actions (Navigate, Share, Rename, Delete).
 *
 * Used by both `/route/[id].tsx` (existing) and `/route/new.tsx` (new).
 * Both screens are responsible for loading/initializing the active route
 * before mounting this component.
 */
export default function RouteEditor() {
  const active = useActiveRoute();

  // While the active route is being loaded (between screen mount and the
  // useRoute(id) effect resolving), render nothing.
  if (!active) return null;

  return <RouteEditorContent active={active} />;
}

function RouteEditorContent({ active }: { active: ActiveRoute }) {
  const { points, name, id, mode } = active;
  const isExisting = id != null;
  const isEditing = mode === RouteMode.Editing;
  const theme = useTheme();

  const legs = useMemo(() => calculateRouteLegs(points), [points]);

  const totalDistance = useMemo(
    () => legs.reduce((sum, leg) => sum + leg.distance, 0),
    [legs],
  );

  const handleSelect = useCallback(
    (index: number, point: { latitude: number; longitude: number }) => {
      setActiveIndex(index);
      flyTo({
        center: [point.longitude, point.latitude],
        duration: 600,
      });
    },
    [],
  );

  const handleCancel = useCallback(() => {
    if (isEditing && points.length > 0) {
      Alert.alert(
        isExisting ? "Discard Changes?" : "Discard Route?",
        isExisting
          ? "Your changes will be lost."
          : "You have unsaved waypoints that will be lost.",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              if (isExisting) {
                // Reload the route to discard unsaved changes
                setActiveRoute(id)
              } else {
                clearActiveRoute();
                router.dismiss();
              }
            },
          },
        ],
      );
    } else {
      clearActiveRoute();
      router.dismiss();
    }
  }, [isEditing, points.length, isExisting, id]);

  const handleSave = useCallback(async () => {
    if (!isExisting && points.length === 0) {
      clearActiveRoute();
      router.dismiss();
      return;
    }
    const savedId = await saveActiveRoute();
    if (!isExisting) {
      // New route: replace the route into history under its real id.
      router.replace({ pathname: "/route/[id]", params: { id: String(savedId) } });
    }
  }, [isExisting, points.length]);

  const handleRename = useCallback(() => {
    Alert.prompt(
      "Route Name",
      undefined,
      (value) => setRouteName(value.trim() || null),
      "plain-text",
      name ?? "",
    );
  }, [name]);

  const promptDelete = useCallback(() => {
    if (id == null) return;
    Alert.alert(
      "Delete Route",
      `Delete "${routeDisplayName(active)}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await handleDeleteRoute(id);
            router.dismiss();
          },
        },
      ],
    );
  }, [id, active]);

  const handleNavigate = useCallback(async () => {
    if (id == null) return;
    // Snap the starting waypoint to the leg the vessel is currently on, so
    // resuming mid-route picks up where you actually are.
    const coords = useNavigationState.getState().coords;
    const from =
      coords?.latitude != null && coords?.longitude != null
        ? { latitude: coords.latitude, longitude: coords.longitude }
        : undefined;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await startNavigation(id, { from });
    router.dismissAll();
  }, [id]);

  const distance = toDistance(totalDistance);

  return (
    <>
      <SheetHeader
        title={routeDisplayName(active)}
        onPressTitle={handleRename}
      />
      {isEditing ?
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={handleCancel} />
        </Stack.Toolbar>
        :
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="square.and.arrow.up"
            onPress={() => exportRouteAsGPX(active.id!)}
          />
        </Stack.Toolbar>
      }
      <Stack.Toolbar placement="right">
        {isEditing ?
          <Stack.Toolbar.Button icon="checkmark"
            variant="prominent"
            onPress={handleSave}
          />
          :
          <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
            Close
          </Stack.Toolbar.Button>
        }
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <List modifiers={[
          listStyle("automatic"),
          environment("editMode", active.mode === RouteMode.Editing ? "active" : "inactive"),
          animation(Animation.default, isEditing),
        ]}
        >
          {!isEditing && (
            <Section>
              <HStack>
                <Text modifiers={[
                  font({ size: 24, weight: "bold" }),
                ]}>
                  {distance.value} {distance.abbr}
                </Text>
                <Spacer />
                <Button
                  onPress={handleNavigate}
                  modifiers={[
                    buttonStyle("glassProminent"),
                    controlSize("large"),
                    tint(theme.success),
                  ]}
                >
                  <HStack spacing={4}>
                    <Text>Start</Text>
                    <Image systemName="chevron.right" />
                  </HStack>
                </Button>
              </HStack>
            </Section>
          )}

          {points.length > 0 ? (
            <List.ForEach
              onDelete={(indices) => {
                for (const i of indices) removeRouteWaypoint(i);
              }}
              onMove={(sourceIndices, destination) => {
                moveRouteWaypoint(sourceIndices[0], destination);
              }}
            >
              {points.map((point, i) => {
                const leg = i > 0 ? legs[i - 1] : null;
                const legDist = leg ? toDistance(leg.distance) : null;
                const legBearing = leg ? formatBearing(leg.bearing) : null;

                return (
                  <HStack
                    key={point.key}
                    alignment="center"
                    spacing={12}
                    modifiers={[
                      onTapGesture(() => handleSelect(i, point)),
                    ]}
                  >
                    <WaypointBadge index={i} last={i === points.length - 1} />
                    {leg ? (
                      <>
                        <Text>
                          {legDist?.value} {legDist?.abbr}
                          {' @ '}
                          {legBearing}
                        </Text>
                      </>
                    ) : <Text>Start</Text>}
                    <Spacer />
                    <VStack alignment="leading" spacing={2}>
                      <Text modifiers={[foregroundStyle("secondary"), monospacedDigit(), font({ size: 13 })]}>
                        {coordFormat.latitude(point.latitude)}
                      </Text>
                      <Text modifiers={[foregroundStyle("secondary"), monospacedDigit(), font({ size: 13 })]}>
                        {coordFormat.longitude(point.longitude)}
                      </Text>
                    </VStack>
                  </HStack>
                );
              })}
            </List.ForEach>
          ) : (
            <VStack
              alignment="center"
              spacing={8}
              modifiers={[padding({ all: 40 })]}
            >
              <Text modifiers={[font({ size: 15 }), foregroundStyle("secondary")]}>
                No waypoints yet
              </Text>
            </VStack>
          )}

          {isExisting && (
            <Section>
              <Button
                label="Delete"
                role="destructive"
                onPress={promptDelete}
              />
            </Section>
          )}
        </List>
      </Host>
    </>
  );
}
