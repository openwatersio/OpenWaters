import ActivityCard from "@/activities/components/ActivityCard";
import InstrumentCell from "@/activities/components/InstrumentCell";
import { toDepth, toSpeed, toTemperature } from "@/hooks/usePreferredUnits";
import {
  type DataPoint,
  useInstrumentPath,
} from "@/instruments/hooks/useInstruments";
import { StyleSheet, View } from "react-native";

const STALE_THRESHOLD = 10_000;

function isDataStale(point: DataPoint | undefined): boolean {
  if (!point) return true;
  return Date.now() - point.timestamp > STALE_THRESHOLD;
}

function useExternalInstruments() {
  const depthSurface = useInstrumentPath("environment.depth.belowSurface");
  const depthTransducer = useInstrumentPath("environment.depth.belowTransducer");
  const aws = useInstrumentPath("environment.wind.speedApparent");
  const awa = useInstrumentPath("environment.wind.angleApparent");
  const waterTemp = useInstrumentPath("environment.water.temperature");
  return {
    depth: depthSurface ?? depthTransducer,
    aws,
    awa,
    waterTemp,
  };
}

export function useInstrumentsCardVisible(): boolean {
  const { depth, aws, awa, waterTemp } = useExternalInstruments();
  return !!(depth || aws || awa || waterTemp);
}

function formatWindAngle(point: DataPoint | undefined): string {
  if (!point || point.value === null) return "--";
  return `${Math.round(((point.value as number) * 180) / Math.PI)}`;
}

export default function InstrumentsCard() {
  const { depth, aws, awa, waterTemp } = useExternalInstruments();

  const depthFormatted = depth ? toDepth(depth.value as number) : null;
  const awsFormatted = aws ? toSpeed(aws.value as number) : null;
  const tempFormatted = waterTemp ? toTemperature(waterTemp.value as number) : null;

  return (
    <ActivityCard>
      <View style={styles.row}>
        {depthFormatted && (
          <InstrumentCell
            label="Depth"
            value={depthFormatted.value}
            unit={depthFormatted.abbr}
            stale={isDataStale(depth)}
          />
        )}
        {awsFormatted && (
          <InstrumentCell
            label="AWS"
            value={awsFormatted.value}
            unit={awsFormatted.abbr}
            stale={isDataStale(aws)}
          />
        )}
        {awa && (
          <InstrumentCell
            label="AWA"
            value={formatWindAngle(awa)}
            unit="°"
            stale={isDataStale(awa)}
          />
        )}
        {tempFormatted && (
          <InstrumentCell
            label="Water"
            value={tempFormatted.value}
            unit={tempFormatted.abbr}
            stale={isDataStale(waterTemp)}
          />
        )}
      </View>
    </ActivityCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    gap: 16,
  },
});
