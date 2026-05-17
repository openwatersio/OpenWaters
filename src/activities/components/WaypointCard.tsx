import ActivityCard from "@/activities/components/ActivityCard";
import { showRouteActions } from "@/activities/components/routeActions";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import WaypointBadge from "@/routes/components/WaypointBadge";
import { useRouteProgress } from "@/routes/hooks/useRouteProgress";
import { useActiveRoute } from "@/routes/hooks/useRoutes";
import { ArrivalTime } from "@/ui/ArrivalTime";
import { Degrees } from "@/ui/Degrees";
import { Duration } from "@/ui/Duration";
import { StatItem } from "@/ui/StatItem";
import { Host, HStack, ProgressView, Spacer, VStack } from "@expo/ui/swift-ui";
import { tint } from "@expo/ui/swift-ui/modifiers";

export function useWaypointCardVisible(): boolean {
  const { points, activeIndex, isNavigating } = useActiveRoute();
  if (!isNavigating) return false;
  // Only show when there's at least one waypoint between us and the destination.
  const idx = activeIndex ?? 0;
  return idx < points.length - 1;
}

export default function WaypointCard() {
  const theme = useTheme();
  const { points, activeIndex } = useActiveRoute();
  const idx = activeIndex ?? 0;
  const { waypoint } = useRouteProgress();
  const distance = toDistance(waypoint?.distance);

  return (
    <ActivityCard onPress={showRouteActions}>
      <Host matchContents>
        <HStack spacing={4}>
          <WaypointBadge index={idx - 1} points={points} />
          <VStack spacing={4}>
            <HStack>
              <StatItem value={distance.value} suffix={distance.abbr} />
              <Spacer />
              <Degrees value={waypoint?.bearing} />
            </HStack>
            <HStack spacing={8}>
              <ProgressView value={waypoint?.progress ?? 0} modifiers={[tint(theme.routes)]} />
            </HStack>
            <HStack spacing={8}>
              <Duration seconds={waypoint?.eta} />
              <Spacer />
              <ArrivalTime fromNow={waypoint?.eta} />
            </HStack>
          </VStack>
          <WaypointBadge index={idx} points={points} />
        </HStack>

      </Host>
    </ActivityCard>
  );
}
