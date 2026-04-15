import WaypointBadge from "@/routes/components/WaypointBadge";
import TrackRecordingStats from "@/tracks/components/TrackRecordingStats";
import { Detent } from "@/ui/Detent";
import SheetView from "@/ui/SheetView";
import { ArrivalTimeStat, BearingStat, DistanceStat, EtaStat } from "@/ui/StatItem";
import { useNavigation } from "@/navigation/hooks/useNavigation";
import { stopNavigation, useActiveRoute } from "@/routes/hooks/useRoutes";
import { stopTrackRecording, trackRecordingState, useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import {
  calculateDestinationProgress,
  calculateWaypointProgress,
} from "@/geo";
import { Button, Host, HStack, Text, VStack } from "@expo/ui/swift-ui";
import * as Haptics from "expo-haptics";
import { buttonStyle, font, foregroundStyle, frame, textCase } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Alert } from "react-native";

export default function ActivityScreen() {
  const { points, activeIndex, isNavigating } = useActiveRoute();
  const activePointIndex = activeIndex ?? 0;
  const nav = useNavigation();
  const { isRecording } = useTrackRecording();

  const targetPoint = points[activePointIndex] ?? null;
  const previousPoint = activePointIndex > 0 ? points[activePointIndex - 1] ?? null : null;

  const position =
    nav.latitude !== null && nav.longitude !== null
      ? { latitude: nav.latitude, longitude: nav.longitude }
      : null;

  const waypointProgress = useMemo(() => {
    if (!position || !targetPoint) return null;
    const sog = nav.speed ?? 0;
    const cog = nav.heading ?? 0;
    return calculateWaypointProgress(position, sog, cog, targetPoint, previousPoint);
  }, [position, nav.speed, nav.heading, targetPoint, previousPoint]);

  const destinationProgress = useMemo(() => {
    if (!waypointProgress || !position) return null;
    const sog = nav.speed ?? 0;
    return calculateDestinationProgress(
      waypointProgress,
      points,
      activePointIndex,
      sog,
    );
  }, [waypointProgress, position, nav.speed, points, activePointIndex]);

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

          if (trackRecordingState.isRecording) {
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
