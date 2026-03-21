import CloseButton from "@/components/ui/CloseButton";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { flyTo } from "@/components/map/NavigationCamera";
import { useNavigationState } from "@/hooks/useNavigationState";
import { toDistance } from "@/hooks/usePreferredUnits";
import {
  addDraftPoint,
  clearDraft,
  initDraft,
  removeDraftPoint,
  selectDraftPoint,
  useRouteDraft
} from "@/hooks/useRouteDraft";
import { loadRoutes } from "@/hooks/useRoutes";
import { useSheetDetents } from "@/hooks/useSheetDetents";
import { insertRoute, insertRoutePoint } from "@/lib/database";
import { formatBearing } from "@/lib/geo";
import { getDistance, getGreatCircleBearing } from "geolib";
import {
  Button,
  Host,
  HStack,
  ScrollView,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  labelStyle,
  monospacedDigit,
  onTapGesture,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useHeaderHeight } from "@react-navigation/elements";
import { CoordinateFormat } from "coordinate-format";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Alert } from "react-native";

const coordFormat = new CoordinateFormat("minutes");

/**
 * Build a new route before persisting. Pre-filled with current location
 * as start and the `to` param as destination.
 *
 * Usage: router.navigate({ pathname: "/route/new", params: { to: "lon,lat" } })
 */
export default function NewRouteScreen() {
  const { to } = useLocalSearchParams<{ to: string }>();
  const points = useRouteDraft((s) => s.points);
  const selectedIndex = useRouteDraft((s) => s.selectedIndex);
  const headerHeight = useHeaderHeight();
  const { setDetentHeight } = useSheetDetents([0.5, 1]);

  useEffect(() => {
    setDetentHeight(headerHeight);
  }, [headerHeight, setDetentHeight]);

  // Initialize draft on mount
  useEffect(() => {
    initDraft([]);

    const location = useNavigationState.getState();
    if (location.coords) {
      addDraftPoint(location.coords);
    }

    if (to) {
      const [toLon, toLat] = to.split(",").map(Number) as [number, number];
      addDraftPoint({
        latitude: toLat,
        longitude: toLon,
      });
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
        "Discard Route?",
        "You have unsaved waypoints that will be lost.",
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
  }, [points.length]);

  const handleSave = useCallback(async () => {
    if (points.length === 0) {
      clearDraft();
      router.dismiss();
      return;
    }

    const route = await insertRoute();
    for (let i = 0; i < points.length; i++) {
      await insertRoutePoint(route.id, {
        latitude: points[i].latitude,
        longitude: points[i].longitude,
        position: i,
      });
    }
    clearDraft();
    await loadRoutes();
    router.replace({ pathname: "/feature/[type]/[id]", params: { type: "route", id: String(route.id) } });
  }, [points]);

  const dist = toDistance(totalDistance);

  return (
    <SheetView id="route-new" style={{ flex: 1 }}>
      <SheetHeader
        title="New Route"
        subtitle={points.length > 0
          ? `${points.length} ${points.length === 1 ? "waypoint" : "waypoints"} · ${dist.value} ${dist.abbr}`
          : undefined
        }
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
        <ScrollView showsIndicators={false}>
          {points.length > 0 && (
            <VStack spacing={0} modifiers={[padding({ horizontal: 20, top: 12 })]}>
              {points.map((point, i) => {
                const leg = i > 0 ? legs[i - 1] : null;
                const legDist = leg ? toDistance(leg.dist) : null;
                const legBearing = leg ? formatBearing(leg.bearing) : null;
                const isSelected = selectedIndex === i;

                return (
                  <VStack key={i} alignment="leading" spacing={4}>
                    {leg && (
                      <HStack spacing={6} modifiers={[padding({ leading: 20, vertical: 4 })]}>
                        <Text modifiers={[foregroundStyle("secondary")]}>
                          ↓
                        </Text>
                        <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle("secondary")]}>
                          {legDist?.value} {legDist?.abbr} at {legBearing}
                        </Text>
                      </HStack>
                    )}
                    <HStack
                      alignment="center"
                      spacing={8}
                      modifiers={[
                        padding({ vertical: 4 }),
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
                      </VStack>
                      <Spacer />
                      {points.length > 1 && (
                        <Button
                          systemImage="xmark.circle.fill"
                          label="Remove"
                          role="destructive"
                          modifiers={[labelStyle("iconOnly"), tint("secondary")]}
                          onPress={() => removeDraftPoint(i)}
                        />
                      )}
                    </HStack>
                  </VStack>
                );
              })}
            </VStack>
          )}

          {points.length === 0 && (
            <VStack alignment="center" spacing={8} modifiers={[padding({ all: 40 })]}>
              <Text modifiers={[font({ size: 15 }), foregroundStyle("secondary")]}>
                No waypoints yet
              </Text>
            </VStack>
          )}
        </ScrollView>
      </Host>
    </SheetView>
  );
}
