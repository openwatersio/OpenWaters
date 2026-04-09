import RouteEditor from "@/components/features/RouteEditor";
import SheetView from "@/components/ui/SheetView";
import { useRoute } from "@/hooks/useRoutes";
import { useLocalSearchParams } from "expo-router";

/**
 * Unified view + edit screen for an existing route. Loads the route into
 * the active store on mount via `useRoute(id)`. The body is rendered by
 * `<RouteEditor>`, which is shared with `/route/new`.
 */
export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Number(id);

  useRoute(routeId);

  return (
    <SheetView id="route" style={{ flex: 1 }} headerDetent additionalDetents={[0.5, 1]}>
      <RouteEditor />
    </SheetView>
  );
}
