import ActivityCard from "@/activities/components/ActivityCard";
import { showRouteActions } from "@/activities/components/routeActions";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import WaypointBadge from "@/routes/components/WaypointBadge";
import { useRouteProgress } from "@/routes/hooks/useRouteProgress";
import { useActiveRoute } from "@/routes/hooks/useRoutes";
import { ArrivalTime } from "@/ui/ArrivalTime";
import { Duration } from "@/ui/Duration";
import { StatItem } from "@/ui/StatItem";
import { Host, HStack, ProgressView, Spacer, VStack } from "@expo/ui/swift-ui";
import { tint } from "@expo/ui/swift-ui/modifiers";

export default function DestinationCard() {
  const theme = useTheme();
  const { points } = useActiveRoute();
  const { destination } = useRouteProgress();

  const distance = toDistance(destination?.distance);

  return (
    <ActivityCard onPress={showRouteActions}>
      <Host matchContents>
        <HStack spacing={4}>
          <WaypointBadge index={0} points={points} />
          <VStack spacing={4}>
            <StatItem value={distance.value} suffix={distance.abbr} />
            <HStack spacing={8}>
              <ProgressView value={destination?.progress ?? 0} modifiers={[tint(theme.routes)]} />
            </HStack>
            <HStack spacing={8}>
              <Duration seconds={destination?.eta} />
              <Spacer />
              <ArrivalTime fromNow={destination?.eta} />
            </HStack>
          </VStack>
          <WaypointBadge index={points.length - 1} points={points} />
        </HStack>
      </Host>
    </ActivityCard>
  );
}
