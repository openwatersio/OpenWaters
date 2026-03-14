import SpeedChart from "@/components/SpeedChart";
import Button from "@/components/ui/Button";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { useBottomSheetStore } from "@/hooks/useBottomSheetOffset";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useTrackRecording, type SpeedSample } from "@/hooks/useTrackRecording";
import { useTracks } from "@/hooks/useTracks";
import { getTrack, getTrackPoints, type Track } from "@/lib/database";
import { exportTrackAsGPX } from "@/lib/exportTrack";
import { useNavigation } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Dimensions, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_HEIGHT = Dimensions.get("window").height;

function formatElapsed(startedAt: string | null, endedAt?: string | null): string {
  if (!startedAt) return "00:00";
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const seconds = Math.floor((end - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trackId = Number(id);
  const { isRecording, activeTrackId, startedAt, distance, speedSamples, stop } = useTrackRecording();
  const selectTrack = useTracks((s) => s.selectTrack);
  const clearSelectedTrack = useTracks((s) => s.clearSelectedTrack);
  const units = usePreferredUnits();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [, setTick] = useState(0);
  const [detentIndex, setDetentIndex] = useState(0);
  const [chartWidth, setChartWidth] = useState(0);
  const [detents, setDetents] = useState<number[]>([0.15, 0.5]);

  const isActiveRecording = isRecording && activeTrackId === trackId;
  const expanded = detentIndex > 0;

  // Track data for completed tracks (loaded from DB)
  const [track, setTrack] = useState<Track | null>(null);
  const [trackSpeedSamples, setTrackSpeedSamples] = useState<SpeedSample[]>([]);

  const setHeight = useBottomSheetStore((s) => s.setHeight);
  const removeSheet = useBottomSheetStore((s) => s.removeSheet);

  // Set selected track for map overlay, clear on unmount
  useEffect(() => {
    selectTrack(trackId);
    return () => clearSelectedTrack();
  }, [trackId, selectTrack, clearSelectedTrack]);

  // Measure compact section and set detents from actual height
  const onCompactLayout = useCallback((e: LayoutChangeEvent) => {
    const sheetMaxHeight = SCREEN_HEIGHT - insets.top - insets.bottom;
    const compactFraction = e.nativeEvent.layout.height / sheetMaxHeight;
    const newDetents = [compactFraction, 0.5];
    setDetents(newDetents);
    navigation.setOptions({
      sheetAllowedDetents: newDetents,
      sheetInitialDetentIndex: 0,
    });
  }, [navigation]);

  // Track sheet height for overlay button offset
  useEffect(() => {
    const height = detents[detentIndex] * SCREEN_HEIGHT;
    setHeight("trackSheet", height);
    return () => removeSheet("trackSheet");
  }, [detentIndex, detents, setHeight, removeSheet]);

  // Listen for detent changes
  useEffect(() => {
    const unsubscribe = navigation.addListener("sheetDetentChange" as any, (e: any) => {
      if (e?.data?.index !== undefined) {
        setDetentIndex(e.data.index);
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Load track data from DB for completed tracks
  useEffect(() => {
    if (isActiveRecording) {
      setTrack(null);
      setTrackSpeedSamples([]);
      return;
    }
    getTrack(trackId).then((t) => setTrack(t));
    getTrackPoints(trackId).then((points) => {
      const samples: SpeedSample[] = points
        .filter((p) => p.speed !== null)
        .map((p) => ({ speed: p.speed!, timestamp: new Date(p.timestamp).getTime() }));
      setTrackSpeedSamples(samples);
    });
  }, [trackId, isActiveRecording]);

  // Tick for live elapsed time
  useEffect(() => {
    if (!isActiveRecording) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActiveRecording]);

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  // Resolve values based on mode
  const trackStartedAt = isActiveRecording ? startedAt : track?.started_at ?? null;
  const trackEndedAt = isActiveRecording ? null : track?.ended_at ?? null;
  const trackDistance = isActiveRecording ? distance : track?.distance ?? 0;
  const displaySpeedSamples = isActiveRecording ? speedSamples : trackSpeedSamples;

  const handleExport = useCallback(() => {
    exportTrackAsGPX(trackId);
  }, [trackId]);

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

  const dist = units.toDistance(trackDistance);

  return (
    <View style={styles.container}>
      {/* Compact section — always visible */}
      <View style={styles.compact} onLayout={onCompactLayout}>
        <IconSymbol name="route" color={isActiveRecording ? "#e53e3e" : "#007AFF"} />
        <View style={styles.stat}>
          <Text style={styles.label} numberOfLines={1}>Time</Text>
          <Text style={styles.value} numberOfLines={1}>{formatElapsed(trackStartedAt, trackEndedAt)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label} numberOfLines={1}>Distance</Text>
          <Text style={styles.value} numberOfLines={1}>
            {dist.value}
            <Text style={styles.units}> {dist.abbr}</Text>
          </Text>
        </View>
        <View style={styles.stopButton}>
          {isActiveRecording && (
            <Button
              onPress={confirmStop}
              role="destructive"
              variant="bordered"
              systemImage="stop"
            />
          )}
        </View>
      </View>

      {expanded && (
        <View style={styles.expanded}>
          <View style={styles.section} onLayout={onChartLayout}>
            {chartWidth > 0 && (
              <SpeedChart
                samples={displaySpeedSamples}
                width={chartWidth}
              />
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.timesRow}>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>Started</Text>
                <Text style={styles.timeValue}>{formatTime(trackStartedAt)}</Text>
              </View>
              <View style={styles.timeItem}>
                <Text style={styles.timeLabel}>{trackEndedAt ? "Ended" : "Elapsed"}</Text>
                <Text style={styles.timeValue}>
                  {trackEndedAt ? formatTime(trackEndedAt) : formatElapsed(trackStartedAt)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              label="Export GPX"
              onPress={handleExport}
              systemImage="share"
            />
          </View>
        </View>
      )}
    </View>
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
    opacity: 0.5,
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
    opacity: 0.5,
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
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    padding: 12,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.5,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a2b4a",
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
  },
});
