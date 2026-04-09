import SheetView from "@/components/ui/SheetView";
import { StatItem } from "@/components/ui/StatItem";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { start, stop, useTrackRecording } from "@/hooks/useTrackRecording";
import { formatElapsedTime } from "@/lib/format";
import { Host, HStack, Button as SwiftButton } from "@expo/ui/swift-ui";
import { buttonStyle, clipShape, controlSize, labelStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

export default function RecordScreen() {
  const { track, isRecording, distance, averageSpeed } = useTrackRecording();
  const [, setTick] = useState(0);

  // Start recording if not already active
  useEffect(() => {
    if (!isRecording) {
      start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick for live elapsed time
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const confirmStop = useCallback(() => {
    Alert.alert("Stop Track?", "Do you want to stop this track?", [
      {
        text: "Stop", style: "destructive", onPress: () => {
          stop();
          router.back();
        }
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  const dist = toDistance(distance);
  const avgSpd = toSpeed(averageSpeed);

  return (
    <SheetView id="record">
      <Host matchContents>
        <HStack spacing={8} modifiers={[padding({ all: 12, top: 14 })]}>
          <StatItem
            label="Elapsed"
            value={formatElapsedTime(track?.started_at ?? null)}
          />
          <StatItem
            label="Distance"
            value={dist.value}
            suffix={dist.abbr}
          />
          <StatItem
            label="Average"
            value={avgSpd.value}
            suffix={avgSpd.abbr}
          />
          <SwiftButton
            label="Stop"
            systemImage="stop.fill"
            modifiers={[
              labelStyle("iconOnly"),
              buttonStyle("borderedProminent"),
              controlSize("large"),
              clipShape("circle"),
            ]}
            role="destructive"
            onPress={confirmStop}
          />
        </HStack>
      </Host>
    </SheetView>
  );
}
