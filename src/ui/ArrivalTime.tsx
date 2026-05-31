import { HStack, Text } from "@expo/ui/swift-ui";
import { font, monospacedDigit } from "@expo/ui/swift-ui/modifiers";

const valueModifiers = [font({ size: 24, weight: "semibold" }), monospacedDigit()];
const periodModifiers = [font({ size: 14 })];

/**
 * Render an absolute arrival time from a relative future offset (in seconds),
 * with the AM/PM period (if the active locale uses one) styled smaller
 * alongside the time. 24-hour locales render the time as a single segment.
 */
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function ArrivalTime({ fromNow }: { fromNow: number | null | undefined }) {
  if (fromNow == null) return <Text modifiers={valueModifiers}>—</Text>;

  // Reads the current clock to render an absolute arrival time from a relative
  // offset; re-renders whenever `fromNow` updates, so the freshness is correct.
  // eslint-disable-next-line react-hooks/purity
  const arrival = new Date(Date.now() + fromNow * 1000);
  const parts = timeFormat.formatToParts(arrival);
  const periodPart = parts.find((p) => p.type === "dayPeriod");
  const time = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();

  if (!periodPart) return <Text modifiers={valueModifiers}>{time}</Text>;

  return (
    <HStack alignment="firstTextBaseline" spacing={1}>
      <Text modifiers={valueModifiers}>{time}</Text>
      <Text modifiers={periodModifiers}>{periodPart.value}</Text>
    </HStack>
  );
}
