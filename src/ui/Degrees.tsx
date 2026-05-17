import { HStack, Text } from "@expo/ui/swift-ui";
import { font, monospacedDigit } from "@expo/ui/swift-ui/modifiers";

const valueModifiers = [font({ size: 24, weight: "semibold" }), monospacedDigit()];
const unitModifiers = [font({ size: 24, weight: "light" })];

/**
 * Render a compass bearing (degrees true), normalized to 0–359, with the
 * degree symbol rendered smaller and lighter alongside the value.
 */
export function Degrees({ value }: { value: number | null | undefined }) {
  if (value == null) return <Text modifiers={valueModifiers}>—</Text>;
  const rounded = Math.round(((value % 360) + 360) % 360);
  return (
    <HStack alignment="firstTextBaseline" spacing={0}>
      <Text modifiers={valueModifiers}>{String(rounded)}</Text>
      <Text modifiers={unitModifiers}>°</Text>
    </HStack>
  );
}
