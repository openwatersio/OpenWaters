import { ActiveWaypoint } from "@/routes/hooks/useRoutes";
import useTheme from "@/hooks/useTheme";
import { Image, Text } from "@expo/ui/swift-ui";
import { background, font, foregroundStyle, frame, shapes } from "@expo/ui/swift-ui/modifiers";

export type WaypointBadgeProps = {
  index?: number,
  last?: boolean,
  points?: readonly ActiveWaypoint[]
};

export default function WaypointBadge({
  index = 0,
  points = [],
  last = points.length - 1 === index
}: WaypointBadgeProps) {
  const theme = useTheme();
  const modifiers = [
    font({ size: 12, weight: "black" as const }),
    foregroundStyle(theme.contrast),
    frame({ width: 24, height: 24 }),
    background(theme.accent, shapes.circle()),  // inner fill
  ];

  if (index === 0 || last) {
    return (
      <Image
        systemName={last ? "flag.pattern.checkered" : "flag.fill"}
        size={12}
        color={theme.contrast}
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
