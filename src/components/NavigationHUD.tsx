import { type DataPoint, useHasInstrumentData, useInstrumentPath } from "@/hooks/useInstruments";
import { NavigationState, useNavigation } from "@/hooks/useNavigation";
import { toDepth, toSpeed, toTemperature } from "@/hooks/usePreferredUnits";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import useTheme from "@/hooks/useTheme";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import OverlayView from "./ui/OverlayView";

const STALE_THRESHOLD = 10_000; // 10 seconds

function useInstrumentValue(path: string): DataPoint | undefined {
  return useInstrumentPath(path);
}

function isDataStale(point: DataPoint | undefined): boolean {
  if (!point) return true;
  return Date.now() - point.timestamp > STALE_THRESHOLD;
}

type CellProps = {
  label: string;
  value: string;
  unit: string;
  stale?: boolean;
};

function Cell({ label, value, unit, stale = false }: CellProps) {
  const theme = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: theme.textPrimary, opacity: stale ? 0.3 : 0.6 }]}>
        {label}
      </Text>
      <Text style={[styles.cellValue, { color: theme.textPrimary, opacity: stale ? 0.3 : 1 }]}>
        {value}
      </Text>
      <Text style={[styles.cellUnit, { color: theme.textPrimary, opacity: stale ? 0.3 : 0.6 }]}>
        {unit}
      </Text>
    </View>
  );
}

function formatDegrees(radians: number | null): string {
  if (radians === null) return "--";
  return `${Math.round(((radians * 180 / Math.PI) + 360) % 360)}`;
}

function formatWindAngle(point: DataPoint | undefined): string {
  if (!point || point.value === null) return "--";
  return `${Math.round(((point.value as number) * 180) / Math.PI)}`;
}

export default function NavigationHUD() {
  const [expanded, setExpanded] = useState(false);

  // Unified navigation data (works with device GPS or Signal K)
  const speed = useNavigation((s) => s.speed);
  const course = useNavigation((s) => s.course);
  const heading = useNavigation((s) => s.heading);
  const navState = useNavigation((s) => s.state);
  const navSource = useNavigation((s) => s.source);
  const { isRecording } = useTrackRecording();

  // Instrument-only data (Signal K only, no device equivalent)
  const depthTransducer = useInstrumentValue("environment.depth.belowTransducer");
  const depthSurface = useInstrumentValue("environment.depth.belowSurface");
  const depth = depthSurface ?? depthTransducer;
  const aws = useInstrumentValue("environment.wind.speedApparent");
  const awa = useInstrumentValue("environment.wind.angleApparent");
  const waterTemp = useInstrumentValue("environment.water.temperature");

  const hasInstruments = useHasInstrumentData();
  const theme = useTheme();

  // Visible when underway, recording, or instrument data exists
  const visible = navState === NavigationState.Underway || isRecording || hasInstruments;
  if (!visible) return null;

  const sogFormatted = toSpeed(speed ?? undefined);
  const depthFormatted = depth ? toDepth(depth.value as number) : null;
  const awsFormatted = aws ? toSpeed(aws.value as number) : null;
  const tempFormatted = waterTemp ? toTemperature(waterTemp.value as number) : null;

  return (
    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded((e) => !e); }}>
      <OverlayView style={styles.container}>
        {/* Source indicator */}
        {navSource === "signalk" && (
          <View style={styles.sourceRow}>
            <SymbolView name="antenna.radiowaves.left.and.right" size={10} tintColor={theme.textSecondary} />
          </View>
        )}

        {/* Always visible: SOG + depth (if available) */}
        <View style={styles.row}>
          <Cell
            label="SOG"
            value={sogFormatted.value}
            unit={sogFormatted.abbr}
          />
          {depthFormatted && (
            <Cell
              label="Depth"
              value={depthFormatted.value}
              unit={depthFormatted.abbr}
              stale={isDataStale(depth)}
            />
          )}
        </View>

        {expanded && (
          <>
            <View style={styles.row}>
              <Cell
                label="COG"
                value={formatDegrees(course)}
                unit={"\u00B0"}
              />
              <Cell
                label="HDG"
                value={heading !== null ? `${Math.round(heading)}` : "--"}
                unit={"\u00B0"}
              />
            </View>
            {(aws || awa) && (
              <View style={styles.row}>
                {awsFormatted && (
                  <Cell
                    label="AWS"
                    value={awsFormatted.value}
                    unit={awsFormatted.abbr}
                    stale={isDataStale(aws)}
                  />
                )}
                <Cell
                  label="AWA"
                  value={formatWindAngle(awa)}
                  unit={"\u00B0"}
                  stale={isDataStale(awa)}
                />
              </View>
            )}
            {tempFormatted && (
              <View style={styles.row}>
                <Cell
                  label="WATER"
                  value={tempFormatted.value}
                  unit={tempFormatted.abbr}
                  stale={isDataStale(waterTemp)}
                />
              </View>
            )}
          </>
        )}
      </OverlayView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    minWidth: 160,
  },
  sourceRow: {
    alignItems: "center",
    marginBottom: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 16,
  },
  cell: {
    alignItems: "center",
    minWidth: 56,
    paddingVertical: 2,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cellValue: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
  cellUnit: {
    fontSize: 9,
    textTransform: "uppercase",
  },
});
