import { HStack, Text } from "@expo/ui/swift-ui";
import { font, monospacedDigit, textCase } from "@expo/ui/swift-ui/modifiers";

const valueModifiers = [font({ size: 24, weight: "semibold" }), monospacedDigit()];
const unitModifiers = [textCase("uppercase"), font({ size: 14 })];

/**
 * Render a duration (in seconds) with the numeric value styled large and the
 * unit label styled small, matching StatItem's value/suffix typography.
 * "<1 min", "5 min", or "2h 15m".
 */
export function Duration({ seconds }: { seconds: number | null | undefined }) {
  if (seconds == null) return <Text modifiers={valueModifiers}>—</Text>;

  if (seconds < 60) return <Segment value="<1" unit="min" />;

  const mins = Math.round(seconds / 60);
  if (mins < 60) return <Segment value={String(mins)} unit="min" />;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    const rem = mins % 60;
    return (
      <HStack alignment="firstTextBaseline" spacing={6}>
        <Segment value={String(hrs)} unit="h" />
        <Segment value={String(rem)} unit="m" />
      </HStack>
    );
  }

  const days = Math.floor(hrs / 24);
  const remHrs = hrs % 24;
  return (
    <HStack alignment="firstTextBaseline" spacing={6}>
      <Segment value={String(days)} unit="d" />
      <Segment value={String(remHrs)} unit="h" />
    </HStack>
  );
}

function Segment({ value, unit }: { value: string; unit: string }) {
  return (
    <HStack alignment="firstTextBaseline" spacing={0}>
      <Text modifiers={valueModifiers}>{value}</Text>
      <Text modifiers={unitModifiers}>{unit}</Text>
    </HStack>
  );
}
