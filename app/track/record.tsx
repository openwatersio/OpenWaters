import SheetView from "@/components/ui/SheetView";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { useSheetDetents } from "@/hooks/useSheetDetents";
import { start, stop, useTrackRecording } from "@/hooks/useTrackRecording";
import { formatElapsedTime } from "@/lib/format";
import { Host, HStack, Spacer, Button as SwiftButton, Text as SwiftText, VStack } from "@expo/ui/swift-ui";
import { buttonStyle, clipShape, controlSize, font, foregroundStyle, labelStyle, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";

export default function RecordScreen() {
  const { track, isRecording, averageSpeed } = useTrackRecording();
  const { onHostLayout } = useSheetDetents();
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
    Alert.alert("Stop Tracking", "Would you like to stop tracking?", [
      {
        text: "Stop", style: "destructive", onPress: () => {
          stop();
          router.back();
        }
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [stop]);

  const dist = toDistance(track?.distance ?? 0);
  const avgSpd = toSpeed(averageSpeed);

  return (
    <SheetView id="record" style={styles.container}>
      <Host onLayoutContent={onHostLayout} matchContents>
        <HStack spacing={8} modifiers={[padding({ all: 16 })]}>
          <Spacer />
          <StatItem
            label="Elapsed"
            value={formatElapsedTime(track?.started_at ?? null)}
          />
          <Spacer />
          <StatItem
            label="Distance"
            value={dist.value}
            unit={dist.abbr}
          />
          <Spacer />
          <StatItem
            label="Avg Speed"
            value={avgSpd.value}
            unit={avgSpd.abbr}
          />
          <Spacer />
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

function StatItem({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <VStack alignment="center" spacing={2}>
      <SwiftText
        modifiers={[
          font({ size: 13, weight: "semibold" }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
        ]}
      >
        {label}
      </SwiftText>
      <HStack alignment="firstTextBaseline" spacing={2}>
        <SwiftText
          modifiers={[
            font({ size: 24, weight: "bold" }),
            monospacedDigit()
          ]}
        >
          {value}
        </SwiftText>
        {unit && (
          <SwiftText
            modifiers={[
              font({ size: 14, weight: "medium" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
            ]}
          >
            {unit}
          </SwiftText>
        )}
      </HStack>
    </VStack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 16,
    gap: 20,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.8,
  },
  units: {
    fontSize: 16,
    fontWeight: "500",
  },
  stopButton: {
    flex: 1,
    alignItems: "flex-end",
  },
  expanded: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 20,
  },
  section: {
    gap: 12,
  },
  timesRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeItem: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
