import ActivityCard from "@/activities/components/ActivityCard";
import { formatElapsedMs } from "@/format";
import { useElapsedMs } from "@/hooks/useElapsedMs";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { stopTrackRecording, useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { StatItem } from "@/ui/StatItem";
import { Host, HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, monospacedDigit } from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { ActionSheetIOS, Alert } from "react-native";

export default function TrackCard() {
  const theme = useTheme();
  const { track, distance, averageSpeed } = useTrackRecording();
  const elapsedMs = useElapsedMs(track?.started_at ?? null);
  const dist = toDistance(distance);
  const avgSpd = toSpeed(averageSpeed);

  return (
    <ActivityCard onPress={showTrackActions}>
      <Host matchContents>
        <HStack spacing={16}>
          <Image
            systemName="point.bottomleft.forward.to.arrow.triangle.scurvepath"
            color={theme.tracks}
          />
          <StatItem label="Elapsed" value={formatElapsedMs(elapsedMs)} />
          <VStack alignment="trailing">
            <HStack alignment="firstTextBaseline" spacing={1}>
              <Text
                modifiers={[
                  font({ size: 24, weight: "semibold" }),
                  monospacedDigit(),
                ]}
              >
                {dist.value}
              </Text>
              <Text modifiers={[
                font({ size: 16 }),
                foregroundStyle({ type: "hierarchical", style: "secondary" }),
              ]}>
                {dist.abbr}
              </Text>
            </HStack>
            <Text modifiers={[
              font({ size: 13 }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}>
              {`${avgSpd.value} ${avgSpd.abbr} avg`}
            </Text>
          </VStack>
        </HStack>
      </Host>
    </ActivityCard >
  );
}

function showTrackActions() {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: "Track Recording",
      options: ["Stop Recording", "Cancel"],
      destructiveButtonIndex: 0,
      cancelButtonIndex: 1,
    },
    (index) => {
      if (index === 0) confirmStopTracking();
    },
  );
}

function confirmStopTracking() {
  Alert.alert("Stop Tracking?", "Do you want to stop recording this track?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Stop",
      style: "destructive",
      onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        stopTrackRecording();
      },
    },
  ]);
}
