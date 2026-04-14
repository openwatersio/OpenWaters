import { toDistance } from "@/hooks/usePreferredUnits";
import { formatETA } from "@/lib/format";
import { formatBearing } from "@/lib/geo";
import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  textCase,
} from "@expo/ui/swift-ui/modifiers";

export function StatItem({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <VStack alignment="center" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <HStack alignment="firstTextBaseline" spacing={2}>
        <Text
          modifiers={[
            font({ size: 24, weight: "bold" }),
            monospacedDigit(),
          ]}
        >
          {value}
        </Text>
        {suffix && (
          <Text modifiers={[
            font({ size: 13 }),
            foregroundStyle({ type: "hierarchical", style: "secondary" }),
          ]}>
            {suffix}
          </Text>
        )}
      </HStack>
      <Text
        modifiers={[
          textCase("uppercase"),
          font({ size: 13 }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
        ]}
      >
        {label}
      </Text>
    </VStack>
  );
}

export function MeasurementStat({ value, abbr, label }: { value: string; abbr: string, label: string }) {
  return <StatItem value={value} suffix={abbr} label={label} />;
}

export function DistanceStat({ value }: { value: number | undefined }) {
  return <MeasurementStat {...toDistance(value)} label="Distance" />;
}

export function BearingStat({ value }: { value: number | undefined }) {
  return <StatItem label="Bearing" value={value != null ? formatBearing(value) : "—"} />;
}

export function EtaStat({ value }: { value: number | null | undefined }) {
  const formatted = value != null ? formatETA(value) : "—";
  return <StatItem label="Remaining" value={formatted} />;
}

export function ArrivalTimeStat({ fromNow }: { fromNow: number | null | undefined }) {
  if (fromNow == null) return <StatItem label="Arrival" value="—" />;
  const arrival = new Date(Date.now() + fromNow * 1000);

  // Format time and split off AM/PM period for smaller rendering via suffix
  const formatted = arrival.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const periodMatch = formatted.match(/\s*(AM|PM|am|pm)\s*$/);
  const time = periodMatch ? formatted.slice(0, periodMatch.index) : formatted;
  const period = periodMatch?.[1];

  return <StatItem label="Arrival" value={time} suffix={period} />;
}
