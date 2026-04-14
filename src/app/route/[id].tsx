import RouteEditor from "@/components/features/RouteEditor";
import { fitBounds } from "@/components/map/NavigationCamera";
import SheetView from "@/components/ui/SheetView";
import { useRoute } from "@/hooks/useRoutes";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { getBounds } from "geolib";

/**
 * Unified view + edit screen for an existing route. Loads the route into
 * the active store on mount via `useRoute(id)`. The body is rendered by
 * `<RouteEditor>`, which is shared with `/route/new`.
 */
export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Number(id);

  const route = useRoute(routeId);

  // Fit the camera to the route bounds when the route first loads.
  useFocusEffect(() => {
    if (!route || route.points.length < 2) return;

    const { minLng, minLat, maxLng, maxLat } = getBounds(route.points);
    const routeBounds: LngLatBounds = [minLng, minLat, maxLng, maxLat];
    fitBounds(routeBounds, {
      padding: { top: 60, right: 16, bottom: 300, left: 16 },
      duration: 300,
    });
  });

  return (
    <SheetView id="route" style={{ flex: 1 }} initialDetentIndex={1} headerDetent gap={16} additionalDetents={[0.25, 0.5, 1]}>
      <RouteEditor />
    </SheetView>
  );
}
