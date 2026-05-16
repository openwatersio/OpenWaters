import ActivityCard from "@/activities/components/ActivityCard";
import { showRouteActions } from "@/activities/components/routeActions";
import { calculateWaypointProgress } from "@/geo";
import { useNavigation } from "@/navigation/hooks/useNavigation";
import WaypointBadge from "@/routes/components/WaypointBadge";
import { useActiveRoute } from "@/routes/hooks/useRoutes";
import { BearingStat, DistanceStat, EtaStat } from "@/ui/StatItem";
import { Host, HStack } from "@expo/ui/swift-ui";
import { useMemo } from "react";
import { View } from "react-native";

export function useWaypointCardVisible(): boolean {
  const { points, activeIndex, isNavigating } = useActiveRoute();
  if (!isNavigating) return false;
  // Only show when there's at least one waypoint between us and the destination.
  const idx = activeIndex ?? 0;
  return idx < points.length - 1;
}

export default function WaypointCard() {
  const { points, activeIndex } = useActiveRoute();
  const idx = activeIndex ?? 0;
  const nav = useNavigation();

  const target = points[idx] ?? null;
  const previous = idx > 0 ? points[idx - 1] ?? null : null;

  const position =
    nav.latitude !== null && nav.longitude !== null
      ? { latitude: nav.latitude, longitude: nav.longitude }
      : null;

  const progress = useMemo(() => {
    if (!position || !target) return null;
    return calculateWaypointProgress(
      position,
      nav.speed ?? 0,
      nav.heading ?? 0,
      target,
      previous,
    );
  }, [position, nav.speed, nav.heading, target, previous]);

  return (
    <ActivityCard onPress={showRouteActions}>
      <View style={{ flex: 1 }}>
        <Host matchContents>
          <HStack spacing={16}>
            <WaypointBadge index={idx} points={points} />
            <BearingStat value={progress?.bearing} />
            <EtaStat value={progress?.eta} />
            <DistanceStat value={progress?.distance} />
          </HStack>
        </Host>
      </View>
    </ActivityCard>
  );
}
