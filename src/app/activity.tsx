import WaypointBadge from "@/components/routes/WaypointBadge";
import TrackRecordingStats from "@/components/tracks/TrackRecordingStats";
import { Detent } from "@/components/ui/Detent";
import SheetView from "@/components/ui/SheetView";
import { ArrivalTimeStat, BearingStat, DistanceStat, EtaStat } from "@/components/ui/StatItem";
import { useNavigationState } from "@/hooks/useNavigationState";
import {
  RouteMode,
  stopNavigation,
  useActiveRoute
} from "@/hooks/useRoutes";
import { stopTrackRecording, useTrackRecording } from "@/hooks/useTrackRecording";
import {
  calculateDestinationProgress,
  calculateWaypointProgress,
} from "@/lib/geo";
import { Button, Host, HStack, Text, VStack } from "@expo/ui/swift-ui";
import * as Haptics from "expo-haptics";
import { buttonStyle, font, foregroundStyle, frame, textCase } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Alert } from "react-native";

export default function ActivityScreen() {
  const route = useActiveRoute();
  const isNavigating = route?.mode === RouteMode.Navigating;
  const activePointIndex = route?.activeIndex ?? 0;
  const points = useMemo(() => route?.points ?? [], [route?.points]);
  const nav = useNavigationState();
  const isRecording = useTrackRecording((s) => s.isRecording);

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

  // Auto-dismiss when all activities stop.
  useEffect(() => {
    if (!isNavigating && !isRecording) {
      router.dismiss();
    }
  }, [isNavigating, isRecording]);

  if (!isNavigating && !isRecording) return null;

  return (
    <SheetView id="activity" gap={0} initialDetentIndex={0}>
      {isNavigating && (
        <>
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
        </>
      )}

      {isRecording && (
        <Detent style={{ padding: 16 }}>
          <Host matchContents>
            <VStack alignment="leading" spacing={8}>
              {isNavigating && (
                <HStack spacing={8} alignment="center">
                  <Text modifiers={[
                    textCase("uppercase"),
                    font({ size: 13, weight: "semibold" }),
                    foregroundStyle("secondary"),
                  ]}>
                    Track
                  </Text>
                </HStack>
              )}
              <TrackRecordingStats />
            </VStack>
          </Host>
        </Detent>
      )}

      <Detent style={{ paddingHorizontal: 16, paddingTop: 36 }}>
        <Host matchContents>
          {isNavigating ? (
            <Button
              label="Stop Route"
              role="destructive"
              onPress={handleStopNavigation}
              modifiers={[
                buttonStyle("borderedProminent"),
                frame({ maxWidth: Infinity })
              ]}
            />
          ) : (
            <Button
              label="Stop Recording"
              role="destructive"
              onPress={handleStopRecording}
              modifiers={[
                buttonStyle("borderedProminent"),
                frame({ maxWidth: Infinity })
              ]}
            />
          )}
        </Host>
      </Detent>
    </SheetView>
  );
}

function handleStopNavigation() {
  Alert.alert(
    "Stop Route?",
    "Do you want to stop this route?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          stopNavigation();

          if (useTrackRecording.getState().isRecording) {
            Alert.alert(
              "Stop Recording?",
              "You are still recording a track. Would you like to stop recording too?",
              [
                { text: "Keep Recording", style: "cancel" },
                {
                  text: "Stop Recording",
                  style: "destructive",
                  onPress: () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    stopTrackRecording();
                  },
                },
              ],
            );
          }
        },
      },
    ],
    { cancelable: false },
  );
}

function handleStopRecording() {
  Alert.alert(
    "Stop Recording?",
    "Do you want to stop recording this track?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          stopTrackRecording();
        },
      },
    ],
  );
}
