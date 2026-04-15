import { fitBounds } from "@/navigation/components/NavigationCamera";
import RouteEditor from "@/routes/components/RouteEditor";
import { useRoute } from "@/routes/hooks/useRoutes";
import SheetView from "@/ui/SheetView";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { getBounds } from "geolib";

/**
 * Unified view + edit screen for an existing route. Loads the route into
 * the active store on mount via `useRoute(id)`. The body is rendered by
 * `<RouteEditor>`, which is shared with `/route/new`.
 */
export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { points } = useRoute(Number(id));

  // Fit the camera to the route bounds when the route first loads.
  useFocusEffect(() => {
    if (points.length < 2) return;

    const { minLng, minLat, maxLng, maxLat } = getBounds([...points]);
    fitBounds([minLng, minLat, maxLng, maxLat], {
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
