import { toDepth, toSpeed, toTemperature } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { createStyles } from "@/hooks/useStyles";
import { type DataPoint, useHasInstrumentData, useInstrumentPath } from "@/instruments/hooks/useInstruments";
import { NavigationState, useNavigation } from "@/navigation/hooks/useNavigation";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import OverlayView from "@/ui/OverlayView";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  const styles = useStyles();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { opacity: stale ? 0.3 : 0.6 }]}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <Text style={[styles.cellValue, { opacity: stale ? 0.3 : 1 }]}>
          {value}
        </Text>
        <Text style={[styles.cellUnit, { opacity: stale ? 0.3 : 0.6 }]}>
          {unit}
        </Text>
      </View>
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
  const { speed, course, heading, state: navState, source: navSource } = useNavigation();
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
  const styles = useStyles();

  // Visible when underway, recording, or instrument data exists
  const visible = navState === NavigationState.Underway || isRecording || hasInstruments;
  if (!visible) return null;

  const sogFormatted = toSpeed(speed ?? undefined);
  const depthFormatted = depth ? toDepth(depth.value as number) : null;
  const awsFormatted = aws ? toSpeed(aws.value as number) : null;
  const tempFormatted = waterTemp ? toTemperature(waterTemp.value as number) : null;

  return (
    <OverlayView style={styles.container}>
      <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded((e) => !e); }}>
        <SafeAreaView edges={["top", "left", "right"]}>
          {/* Source indicator */}
          {navSource === "signalk" && (
            <View style={styles.sourceRow}>
              <SymbolView name="antenna.radiowaves.left.and.right" size={10} tintColor={theme.labelSecondary} />
            </View>
          )}

          {/* Always visible: SOG + depth (if available) */}
          <View style={styles.row}>
            <Cell
              label="SOG"
              value={sogFormatted.value}
              unit={sogFormatted.abbr}
            />
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

                {(aws || awa) && (
                  <>
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
                  </>
                )}
                {tempFormatted && (
                  <Cell
                    label="WATER"
                    value={tempFormatted.value}
                    unit={tempFormatted.abbr}
                    stale={isDataStale(waterTemp)}
                  />
                )}
              </View>
            </>
          )}
        </SafeAreaView>
      </Pressable>
    </OverlayView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: 16,
  },
  sourceRow: { alignItems: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 16,
  },
  cell: { alignItems: "center", minWidth: 56, paddingVertical: 2 },
  cellLabel: { fontSize: 14, textTransform: "uppercase", color: theme.label },
  cellValue: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
    color: theme.label,
  },
  cellUnit: { fontSize: 9, textTransform: "uppercase", color: theme.label },
}));
