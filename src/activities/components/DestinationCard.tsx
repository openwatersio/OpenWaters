import ActivityCard from "@/activities/components/ActivityCard";
import { showRouteActions } from "@/activities/components/routeActions";
import {
  calculateDestinationProgress,
  calculateWaypointProgress,
} from "@/geo";
import { useNavigation } from "@/navigation/hooks/useNavigation";
import WaypointBadge from "@/routes/components/WaypointBadge";
import { useActiveRoute } from "@/routes/hooks/useRoutes";
import { ArrivalTimeStat, DistanceStat, EtaStat } from "@/ui/StatItem";
import { Host, HStack } from "@expo/ui/swift-ui";
import { useMemo } from "react";
import { View } from "react-native";

export default function DestinationCard() {
  const { points, activeIndex } = useActiveRoute();
  const idx = activeIndex ?? 0;
  const nav = useNavigation();

  const target = points[idx] ?? null;
  const previous = idx > 0 ? points[idx - 1] ?? null : null;

  const position =
    nav.latitude !== null && nav.longitude !== null
      ? { latitude: nav.latitude, longitude: nav.longitude }
      : null;

  const waypoint = useMemo(() => {
    if (!position || !target) return null;
    return calculateWaypointProgress(
      position,
      nav.speed ?? 0,
      nav.heading ?? 0,
      target,
      previous,
    );
  }, [position, nav.speed, nav.heading, target, previous]);

  const destination = useMemo(() => {
    if (!waypoint || !position) return null;
    return calculateDestinationProgress(waypoint, points, idx, nav.speed ?? 0);
  }, [waypoint, position, points, idx, nav.speed]);

  return (
    <ActivityCard onPress={showRouteActions}>
      <View style={{ flex: 1 }}>
        <Host matchContents>
          <HStack spacing={16}>
            <WaypointBadge index={points.length - 1} points={points} />
            <ArrivalTimeStat fromNow={destination?.eta} />
            <EtaStat value={destination?.eta} />
            <DistanceStat value={destination?.distance} />
          </HStack>
        </Host>
      </View>
    </ActivityCard>
  );
}
