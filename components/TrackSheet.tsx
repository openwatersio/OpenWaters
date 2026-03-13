import SpeedChart from "@/components/SpeedChart";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useTrackRecording, type SpeedSample } from "@/hooks/useTrackRecording";
import { useTracks } from "@/hooks/useTracks";
import { getTrack, getTrackPoints, type Track } from "@/lib/database";
import { exportTrackAsGPX } from "@/lib/exportTrack";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

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

export default function TrackSheet() {
  const { isRecording, activeTrackId, startedAt, distance, speedSamples, stop } = useTrackRecording();
  const selectedId = useTracks((s) => s.selectedId);
  const clearSelectedTrack = useTracks((s) => s.clearSelectedTrack);
  const units = usePreferredUnits();
  const [, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [compactHeight, setCompactHeight] = useState(0);
  const [chartWidth, setChartWidth] = useState(0);

  // Selected track data (loaded from DB)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedSpeedSamples, setSelectedSpeedSamples] = useState<SpeedSample[]>([]);

  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when recording or selection changes
  useEffect(() => {
    if (isRecording || selectedId !== null) {
      setDismissed(false);
    }
  }, [isRecording, selectedId]);

  const isOpen = (isRecording || selectedId !== null) && !dismissed;
  const mode = isRecording ? "recording" : "selected";

  // Load selected track data from DB
  useEffect(() => {
    if (!selectedId || isRecording) {
      setSelectedTrack(null);
      setSelectedSpeedSamples([]);
      return;
    }
    getTrack(selectedId).then((track) => setSelectedTrack(track));
    getTrackPoints(selectedId).then((points) => {
      const samples: SpeedSample[] = points
        .filter((p) => p.speed !== null)
        .map((p) => ({ speed: p.speed!, timestamp: new Date(p.timestamp).getTime() }));
      setSelectedSpeedSamples(samples);
    });
  }, [selectedId, isRecording]);

  // Tick for live elapsed time
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  const onChartLayout = useCallback((e: LayoutChangeEvent) => {
    setChartWidth(e.nativeEvent.layout.width);
  }, []);

  // Resolve values based on mode
  const trackId = mode === "recording" ? activeTrackId : selectedId;
  const trackStartedAt = mode === "recording" ? startedAt : selectedTrack?.started_at ?? null;
  const trackEndedAt = mode === "recording" ? null : selectedTrack?.ended_at ?? null;
  const trackDistance = mode === "recording" ? distance : selectedTrack?.distance ?? 0;
  const trackSpeedSamples = mode === "recording" ? speedSamples : selectedSpeedSamples;

  const handleExport = useCallback(() => {
    if (trackId) exportTrackAsGPX(trackId);
  }, [trackId]);

  const confirmStop = useCallback(() => {
    Alert.alert("Stop Tracking", "Would you like to stop tracking?", [
      {
        text: "Stop", style: "destructive", onPress: () => {
          stop();
          setDismissed(true);
        }
      },
      { text: "Cancel", style: "cancel", onPress: () => setDismissed(false) },
    ]);
  }, [stop]);

  const handleClose = useCallback((open: boolean) => {
    if (open) return;
    if (isRecording) {
      confirmStop();
    } else {
      clearSelectedTrack();
    }
  }, [isRecording, clearSelectedTrack, confirmStop]);

  const dist = units.toDistance(trackDistance);

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleClose} onExpandedChange={setExpanded} compactHeight={compactHeight} dismissable>
      {/* Compact section — always visible */}
      <View style={styles.compact} onLayout={(e) => setCompactHeight(e.nativeEvent.layout.height)}>
        <IconSymbol name="route" color={mode === "recording" ? "#e53e3e" : "#007AFF"} />
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
          {mode === "recording" && (
            <Button
              onPress={confirmStop}
              role="destructive"
              variant="bordered"
              systemImage="stop"
            />
          )}
        </View>
      </View>

      <View style={styles.expanded}>
        <View style={styles.section} onLayout={onChartLayout}>
          {chartWidth > 0 && (
            <SpeedChart
              samples={trackSpeedSamples}
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
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
