import SheetView from "@/components/ui/SheetView";
import { useNavigationState } from "@/hooks/useNavigationState";
import { toDistance } from "@/hooks/usePreferredUnits";
import {
  advanceToNext,
  goToPrevious,
  stopNavigation,
  useRouteNavigation,
} from "@/hooks/useRouteNavigation";
import { getRoutePoints, type RoutePoint } from "@/lib/database";
import { formatBearing } from "@/lib/geo";
import { getDistance, getGreatCircleBearing } from "geolib";
import { checkWaypointArrival, type ArrivalState } from "@/lib/waypointArrival";
import {
  Button,
  Host,
  HStack,
  Spacer,
  Text,
  VStack,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function NavigateScreen() {
  const activeRouteId = useRouteNavigation((s) => s.activeRouteId);
  const activePointIndex = useRouteNavigation((s) => s.activePointIndex);
  const nav = useNavigationState();

  const [points, setPoints] = useState<RoutePoint[]>([]);

  useEffect(() => {
    if (!activeRouteId) return;
    getRoutePoints(activeRouteId).then(setPoints);
  }, [activeRouteId]);

  const targetPoint = points[activePointIndex] ?? null;
  const isLastPoint = activePointIndex >= points.length - 1;

  const navInfo = useMemo(() => {
    if (!nav.coords || !targetPoint) return null;
    const dist = getDistance(nav.coords, targetPoint);
    const bearing = getGreatCircleBearing(nav.coords, targetPoint);
    // ETA based on SOG
    const sog = nav.coords.speed ?? 0;
    const etaSeconds = sog > 0.5 ? dist / sog : null;
    return { dist, bearing, etaSeconds };
  }, [nav.coords, targetPoint]);

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

  const distFormatted = navInfo ? toDistance(navInfo.dist) : null;
  const bearingFormatted = navInfo ? formatBearing(navInfo.bearing) : null;

  const handleStop = useCallback(() => {
    stopNavigation();
    router.dismiss();
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
    <SheetView id="route-navigate" style={{ flex: 1 }}>
      <Host style={{ flex: 1 }}>
        <VStack spacing={12} modifiers={[padding({ horizontal: 20, top: 12 })]}>
          {/* Compact: waypoint name, bearing, distance */}
          <HStack alignment="center" spacing={8}>
            <VStack alignment="leading" spacing={2}>
              <Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>
                {activePointIndex + 1} of {points.length}
              </Text>
              <Text modifiers={[font({ size: 18, weight: "bold" })]}>
                {`Waypoint ${activePointIndex + 1}`}
              </Text>
            </VStack>
            <Spacer />
            {distFormatted && (
              <VStack alignment="trailing" spacing={2}>
                <Text modifiers={[font({ size: 22, weight: "bold" }), monospacedDigit()]}>
                  {distFormatted.value} {distFormatted.abbr}
                </Text>
                <Text modifiers={[font({ size: 14 }), monospacedDigit(), foregroundStyle("secondary")]}>
                  {bearingFormatted}
                </Text>
              </VStack>
            )}
          </HStack>

          {/* Expanded: ETA, controls */}
          {navInfo?.etaSeconds != null && (
            <HStack spacing={8}>
              <Text modifiers={[font({ size: 14 }), foregroundStyle("secondary")]}>
                ETA
              </Text>
              <Text modifiers={[font({ size: 14, weight: "medium" }), monospacedDigit()]}>
                {formatETA(navInfo.etaSeconds)}
              </Text>
            </HStack>
          )}

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
    </SheetView>
  );
}
