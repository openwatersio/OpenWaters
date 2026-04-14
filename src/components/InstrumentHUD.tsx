import { type DataPoint, useHasInstrumentData, useInstrumentPath } from "@/hooks/useInstruments";
import { toDepth, toSpeed, toTemperature } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import * as Haptics from "expo-haptics";
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

function formatDepth(point: DataPoint | undefined): { value: string; abbr: string } {
  if (!point || point.value === null) return { value: "--", abbr: toDepth(undefined).abbr };
  return toDepth(point.value as number);
}

function formatBearing(radians: DataPoint | undefined): string {
  if (!radians || radians.value === null) return "--";
  const degrees = ((radians.value as number) * 180) / Math.PI;
  return `${Math.round((degrees + 360) % 360)}`;
}

function formatWindAngle(radians: DataPoint | undefined): string {
  if (!radians || radians.value === null) return "--";
  const degrees = ((radians.value as number) * 180) / Math.PI;
  return `${Math.round(degrees)}`;
}

function formatSpeed(point: DataPoint | undefined): { value: string; abbr: string } {
  if (!point || point.value === null) return { value: "--", abbr: toSpeed(undefined).abbr };
  return toSpeed(point.value as number);
}

function formatTemp(point: DataPoint | undefined): { value: string; abbr: string } {
  if (!point || point.value === null) return { value: "--", abbr: toTemperature(undefined).abbr };
  return toTemperature(point.value as number);
}

type CellProps = {
  label: string;
  value: string;
  unit: string;
  stale: boolean;
};

function InstrumentCell({ label, value, unit, stale }: CellProps) {
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

export default function InstrumentHUD() {
  const [expanded, setExpanded] = useState(false);
  const hasData = useHasInstrumentData();

  const depthTransducer = useInstrumentValue("environment.depth.belowTransducer");
  const depthSurface = useInstrumentValue("environment.depth.belowSurface");
  const depth = depthSurface ?? depthTransducer;
  const sog = useInstrumentValue("navigation.speedOverGround");
  const cog = useInstrumentValue("navigation.courseOverGroundTrue");
  const heading = useInstrumentValue("navigation.headingTrue");
  const aws = useInstrumentValue("environment.wind.speedApparent");
  const awa = useInstrumentValue("environment.wind.angleApparent");
  const waterTemp = useInstrumentValue("environment.water.temperature");

  if (!hasData) return null;

  const depthFormatted = formatDepth(depth);
  const sogFormatted = formatSpeed(sog);
  const awsFormatted = formatSpeed(aws);
  const tempFormatted = formatTemp(waterTemp);

  return (
    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setExpanded((e) => !e); }}>
      <OverlayView style={styles.container}>
        {/* Always visible: depth + SOG */}
        <View style={styles.row}>
          <InstrumentCell
            label="Depth"
            value={depthFormatted.value}
            unit={depthFormatted.abbr}
            stale={isDataStale(depth)}
          />
          <InstrumentCell
            label="SOG"
            value={sogFormatted.value}
            unit={sogFormatted.abbr}
            stale={isDataStale(sog)}
          />
        </View>

        {expanded && (
          <>
            <View style={styles.row}>
              <InstrumentCell
                label="COG"
                value={formatBearing(cog)}
                unit={"\u00B0"}
                stale={isDataStale(cog)}
              />
              <InstrumentCell
                label="HDG"
                value={formatBearing(heading)}
                unit={"\u00B0"}
                stale={isDataStale(heading)}
              />
            </View>
            <View style={styles.row}>
              <InstrumentCell
                label="AWS"
                value={awsFormatted.value}
                unit={awsFormatted.abbr}
                stale={isDataStale(aws)}
              />
              <InstrumentCell
                label="AWA"
                value={formatWindAngle(awa)}
                unit={"\u00B0"}
                stale={isDataStale(awa)}
              />
            </View>
            {waterTemp && (
              <View style={styles.row}>
                <InstrumentCell
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
