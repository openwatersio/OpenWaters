import WaypointBadge from "@/components/routes/WaypointBadge";
import SheetView from "@/components/ui/SheetView";
import { useNavigationState } from "@/hooks/useNavigationState";
import { toDistance } from "@/hooks/usePreferredUnits";
import {
  advanceToNext,
  clearActiveRoute,
  goToPrevious,
  RouteMode,
  stopNavigation,
  useActiveRoute,
} from "@/hooks/useRoutes";
import {
  calculateDestinationProgress,
  calculateWaypointProgress,
  formatBearing,
} from "@/lib/geo";
import { checkWaypointArrival, type ArrivalState } from "@/lib/waypointArrival";
import {
  Button,
  Host,
  HStack,
  Spacer,
  Text,
  VStack
} from "@expo/ui/swift-ui";
import {
  disabled,
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";

export default function NavigateScreen() {
  const route = useActiveRoute();
  const activeRouteId = route?.mode === RouteMode.Navigating ? route.id : null;
  const activePointIndex = route?.activeIndex ?? 0;
  const points = route?.points ?? [];
  const nav = useNavigationState();

  // FIXME: require confirmation for stopping navigation
  useEffect(() => {
    // Ensure navigation is stopped if user leaves screen mid-route
    return clearActiveRoute
  }, []);

  const targetPoint = points[activePointIndex] ?? null;
  const isLastPoint = activePointIndex >= points.length - 1;

  const waypointProgress = useMemo(() => {
    if (!nav.coords || !targetPoint) return null;
    const sog = nav.coords.speed ?? 0;
    const cog = nav.coords.heading ?? 0;
    return calculateWaypointProgress(nav.coords, sog, cog, targetPoint);
  }, [nav.coords, targetPoint]);

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

  // Auto-advance via VMG-based waypoint arrival detection
  const prevArrival = useRef<ArrivalState | null>(null);

  useEffect(() => {
    if (!nav.coords || !targetPoint) return;

    const sog = nav.coords.speed ?? 0;
    const cog = nav.coords.heading ?? 0;

    const arrival = checkWaypointArrival(
      nav.coords,
      sog,
      cog,
      targetPoint,
      prevArrival.current,
    );
    prevArrival.current = arrival;

    if (arrival.arrived) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isLastPoint) {
        stopNavigation();
        router.dismiss();
      } else {
        advanceToNext();
      }
      // Reset arrival state for next waypoint
      prevArrival.current = null;
    }
  }, [nav.coords, targetPoint, isLastPoint]);

  const distFormatted = waypointProgress ? toDistance(waypointProgress.distance) : null;
  const bearingFormatted = waypointProgress ? formatBearing(waypointProgress.bearing) : null;

  const handleStop = useCallback(() => {
    stopNavigation();
    router.replace({ pathname: "/route/[id]", params: { id: activeRouteId! } });
  }, []);

  const handleNext = useCallback(() => {
    if (!isLastPoint) advanceToNext();
  }, [isLastPoint]);

  const handlePrev = useCallback(() => {
    goToPrevious();
  }, []);

  function formatETA(seconds: number): string {
    if (seconds < 60) return `<1 min`;
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  }

  if (!activeRouteId) return null;

  return (

    // Track: elapsed time, distance, avg speed
    // SOG

    <SheetView id="route-navigate" style={{ flex: 1 }}>
      <Host matchContents={{ vertical: true }}
        style={{ width: "100%" }}
      >
        <VStack spacing={12} modifiers={[padding({ horizontal: 20, top: 20 })]}>
          {/* Compact: waSypoint name, bearing, distance */}
          {/* <Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>
              {activePointIndex + 1} of {points.length}
            </Text> */}
          <HStack>
            <WaypointBadge index={activePointIndex} />
            <Spacer />
            {distFormatted &&
              <VStack>
                <Text modifiers={[
                  font({ size: 13 }),
                  foregroundStyle("secondary")
                ]}>
                  Distance
                </Text>
                <Text modifiers={[
                  font({ size: 18, weight: "bold" }),
                  monospacedDigit()
                ]}>
                  {distFormatted.value} {distFormatted.abbr}
                </Text>
              </VStack>
            }
            <Spacer />
            {bearingFormatted &&
              <VStack>
                <Text modifiers={[
                  font({ size: 13 }),
                  foregroundStyle("secondary")
                ]}>
                  Bearing
                </Text>
                <Text modifiers={[
                  font({ size: 18, weight: "bold" }),
                  monospacedDigit()
                ]}>
                  {bearingFormatted}
                </Text>
              </VStack>
            }
            <Spacer />
            {waypointProgress?.eta != null && (
              <VStack>
                <Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>
                  ETA
                </Text>
                <Text modifiers={[font({ size: 18, weight: "bold" }), monospacedDigit()]}>
                  {formatETA(waypointProgress.eta)}
                </Text>
              </VStack>
            )}
          </HStack>

          {/* Statistics to destination */}
          <HStack>
            <WaypointBadge last />
            <Spacer />
            {destinationProgress && (() => {
              const destDist = toDistance(destinationProgress.distance);
              return (
                <VStack>
                  <Text modifiers={[
                    font({ size: 13 }),
                    foregroundStyle("secondary")
                  ]}>
                    Distance
                  </Text>
                  <Text modifiers={[
                    font({ size: 18, weight: "bold" }),
                    monospacedDigit()
                  ]}>
                    {destDist.value} {destDist.abbr}
                  </Text>
                </VStack>
              );
            })()}
            <Spacer />
            {destinationProgress?.eta != null && (
              <VStack>
                <Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>
                  ETA
                </Text>
                <Text modifiers={[font({ size: 18, weight: "bold" }), monospacedDigit()]}>
                  {formatETA(destinationProgress.eta)}
                </Text>
              </VStack>
            )}
          </HStack>


          <HStack spacing={12}>
            <Button
              label="Previous"
              systemImage="chevron.left"
              onPress={handlePrev}
              modifiers={[
                tint("primary"),
                frame({ maxWidth: Infinity }),
                disabled(activePointIndex <= 0),
              ]}
            />
            <Button
              label={isLastPoint ? "Finish" : "Next"}
              systemImage={isLastPoint ? "checkmark" : "chevron.right"}
              onPress={isLastPoint ? handleStop : handleNext}
              modifiers={[
                tint("primary"),
                frame({ maxWidth: Infinity }),
              ]}
            />
          </HStack>

          <Button
            label="Stop Navigation"
            role="destructive"
            onPress={handleStop}
            modifiers={[frame({ maxWidth: Infinity })]}
          />
        </VStack>
      </Host>
    </SheetView >
  );
}
