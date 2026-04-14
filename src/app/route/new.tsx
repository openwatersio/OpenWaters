import RouteEditor from "@/components/features/RouteEditor";
import SheetView from "@/components/ui/SheetView";
import { useNavigation } from "@/hooks/useNavigation";
import { addRouteWaypoint, startRoute } from "@/hooks/useRoutes";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

/**
 * Entry point for a new route. Initializes a fresh active route via
 * `startRoute()`, then optionally seeds it with the current vessel position
 * and a `to=lon,lat` query param. The body is rendered by `<RouteEditor>`,
 * which is shared with `/route/[id]`.
 */
export default function NewRouteScreen() {
  const { to } = useLocalSearchParams<{ to?: string }>();

  useEffect(() => {
    startRoute();

    const { latitude, longitude } = useNavigation.getState();
    if (latitude != null && longitude != null) {
      addRouteWaypoint({ latitude, longitude });
    }

    if (to) {
      const [toLon, toLat] = to.split(",").map(Number) as [number, number];
      addRouteWaypoint({ latitude: toLat, longitude: toLon });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SheetView id="route" style={{ flex: 1 }} headerDetent additionalDetents={[0.5, 1]}>
      <RouteEditor />
    </SheetView>
  );
}
