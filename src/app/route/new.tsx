import { getPosition } from "@/navigation/hooks/useNavigation";
import RouteEditor from "@/routes/components/RouteEditor";
import { addRouteWaypoint, startRoute } from "@/routes/hooks/useRoutes";
import SheetView from "@/ui/SheetView";
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

    const position = getPosition();
    if (position) addRouteWaypoint(position);

    if (to) {
      const [longitude, latitude] = to.split(",").map(Number) as [number, number];
      addRouteWaypoint({ latitude, longitude });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SheetView id="route" style={{ flex: 1 }} headerDetent additionalDetents={[0.5, 1]}>
      <RouteEditor />
    </SheetView>
  );
}
