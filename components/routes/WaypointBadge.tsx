import useTheme from "@/hooks/useTheme";
import { Image, Text } from "@expo/ui/swift-ui";
import { background, font, foregroundStyle, frame, padding, shapes } from "@expo/ui/swift-ui/modifiers";

export default function WaypointBadge({ index = 0, last = false }: { index?: number, last?: boolean }) {
  const theme = useTheme();
  const modifiers = [
    font({ size: 12, weight: "black" as const }),
    foregroundStyle(theme.surface),
    frame({ width: 24, height: 24 }),
    background(theme.primary, shapes.circle()),  // inner fill
    padding({ all: 2 }),                          // grow bounds by 2pt
    background(theme.surface, shapes.circle()),  // outer ring color
  ];

  if (index === 0 || last) {
    return (
      <Image
        systemName={last ? "flag.pattern.checkered" : "flag.fill"}
        size={12}
        color={theme.surface}
        modifiers={modifiers}
      />
    );
  }

  return (
    <Text modifiers={modifiers}>
      {String(index + 1)}
    </Text>
  );
}
