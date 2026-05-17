import useTheme from "@/hooks/useTheme";
import { ActiveWaypoint } from "@/routes/hooks/useRoutes";
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
    font({ size: 12, weight: "semibold" }),
    foregroundStyle(theme.contrast),
    frame({ width: 18, height: 18 }),
    background(theme.routes, shapes.circle()),  // inner fill
  ];

  if (last) {
    return (
      <Image
        systemName="flag.pattern.checkered"
        size={10}
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
