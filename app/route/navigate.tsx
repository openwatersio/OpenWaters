import WaypointBadge from "@/components/routes/WaypointBadge";
import { Detent } from "@/components/ui/Detent";
import SheetView from "@/components/ui/SheetView";
import { ArrivalTimeStat, BearingStat, DistanceStat, EtaStat } from "@/components/ui/StatItem";
import { useHotReloading } from "@/hooks/useHotReloading";
import { useNavigationState } from "@/hooks/useNavigationState";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import {
  advanceToNext,
  RouteMode,
  stopNavigation,
  useActiveRoute
} from "@/hooks/useRoutes";
import {
  calculateDestinationProgress,
  calculateWaypointProgress,
} from "@/lib/geo";
import { checkWaypointArrival } from "@/lib/waypointArrival";
import { Button, Host, HStack, Text, VStack } from "@expo/ui/swift-ui";
import { buttonStyle, font, foregroundStyle, frame, textCase } from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Alert } from "react-native";

export default function NavigateScreen() {
  const route = useActiveRoute();
  const activeRouteId = route?.mode === RouteMode.Navigating ? route.id : null;
  const activePointIndex = route?.activeIndex ?? 0;
  const points = route?.points ?? [];
  const nav = useNavigationState();

  useDismissBehavior();
  useWaypointArrival();

  const targetPoint = points[activePointIndex] ?? null;
  const previousPoint = activePointIndex > 0 ? points[activePointIndex - 1] ?? null : null;

  const waypointProgress = useMemo(() => {
    if (!nav.coords || !targetPoint) return null;
    const sog = nav.coords.speed ?? 0;
    const cog = nav.coords.heading ?? 0;
    return calculateWaypointProgress(nav.coords, sog, cog, targetPoint, previousPoint);
  }, [nav.coords, targetPoint, previousPoint]);

  const destinationProgress = useMemo(() => {
    if (!waypointProgress || !nav.coords) return null;
    const sog = nav.coords.speed ?? 0;
    return calculateDestinationProgress(
      waypointProgress,
      points,
      activePointIndex,
      sog,
    );
  }, [waypointProgress, nav.coords, points, activePointIndex]);

  if (!activeRouteId) return null;

  return (
    <SheetView id="route-navigate" gap={16} initialDetentIndex={0}>
      <Detent style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }} >
        <Host matchContents>
          <HStack spacing={16}>
            <ArrivalTimeStat fromNow={destinationProgress?.eta} />
            <EtaStat value={destinationProgress?.eta} />
            <DistanceStat value={destinationProgress?.distance} />
          </HStack>
        </Host>
      </Detent>

      <Detent style={{ padding: 16 }} >
        <Host matchContents>
          <VStack alignment="leading" spacing={8}>
            <HStack spacing={8} alignment="center">
              <WaypointBadge index={activePointIndex} points={points} />
              <Text modifiers={[
                textCase("uppercase"),
                font({ size: 13, weight: "semibold" }),
                foregroundStyle("secondary"),
              ]}>
                Next Waypoint
              </Text>
            </HStack>
            <HStack spacing={16}>
              <BearingStat value={waypointProgress?.bearing} />
              <EtaStat value={waypointProgress?.eta} />
              <DistanceStat value={waypointProgress?.distance} />
            </HStack>
          </VStack>
        </Host>
      </Detent>

      <Detent style={{ paddingHorizontal: 16, paddingTop: 36 }}>
        <Host matchContents>
          <Button
            label="Stop Navigation"
            role="destructive"
            onPress={handleStop}
            modifiers={[
              buttonStyle("borderedProminent"),
              frame({ maxWidth: Infinity })
            ]}
          />
        </Host>
      </Detent>
    </SheetView>
  );
}

function handleStop() {
  Alert.alert(
    "Stop Navigation?",
    "Do you want to stop navigating this route?",
    [
      {
        text: "Keep Navigating",
        style: "cancel",
      },
      {
        text: "Stop Route",
        style: "destructive",
        onPress: () => {
          stopNavigation()
        },
      },
    ],
    { cancelable: false },
  );
}

function useWaypointArrival() {
  const route = useActiveRoute();
  const nav = useNavigationState();
  const arrivalRadius = usePreferredUnits((s) => s.arrivalRadius);
  const arriveOnCircleOnly = usePreferredUnits((s) => s.arriveOnCircleOnly);

  const activePointIndex = route?.activeIndex ?? 0;
  const points = route?.points ?? [];
  const targetPoint = points[activePointIndex] ?? null;
  const isLastPoint = activePointIndex >= points.length - 1;

  // Auto-advance via geometric waypoint arrival detection (circle +
  // bisector/perpendicular with a cross-track gate).
  useEffect(() => {
    if (!nav.coords || !targetPoint) return;

    const arrival = checkWaypointArrival({
      position: nav.coords,
      previousWaypoint: activePointIndex > 0 ? points[activePointIndex - 1] : null,
      activeWaypoint: targetPoint,
      nextWaypoint:
        activePointIndex < points.length - 1 ? points[activePointIndex + 1] : null,
      arrivalRadius,
      arriveOnCircleOnly,
    });

    if (arrival.arrived) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isLastPoint) {
        stopNavigation();
      } else {
        advanceToNext();
      }
    }
  }, [
    nav.coords,
    targetPoint,
    isLastPoint,
    activePointIndex,
    points,
    arrivalRadius,
    arriveOnCircleOnly,
  ]);
}

function useDismissBehavior() {
  const isNavigating = useActiveRoute((r) => r?.mode === RouteMode.Navigating);
  const isHotReloading = useHotReloading(module);

  useEffect(() => {
    if (!isNavigating) {
      router.dismiss();
    };
  }, [isNavigating]);

  useEffect(() => {
    return () => {
      if (isHotReloading.current) return;

      const { mode } = useActiveRoute.getState() ?? {}
      if (mode !== RouteMode.Navigating) return

      // The screen was dismissed while still navigating. Re-present the navigation screen
      // and ask the user whether they meant to stop the route.
      router.navigate("/route/navigate");
      handleStop();
    }
  }, []); // run cleanup only on actual unmount
}
