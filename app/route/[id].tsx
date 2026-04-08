import RouteEditor from "@/components/features/RouteEditor";
import SheetView from "@/components/ui/SheetView";
import { useRoute } from "@/hooks/useRoutes";
import { useSheetDetents } from "@/hooks/useSheetDetents";
import { useHeaderHeight } from "@react-navigation/elements";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

const DETENTS = [0.5, 1];

/**
 * Unified view + edit screen for an existing route. Loads the route into
 * the active store on mount via `useRoute(id)`. The body is rendered by
 * `<RouteEditor>`, which is shared with `/route/new`.
 */
export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Number(id);

  useRoute(routeId);

  const headerHeight = useHeaderHeight();
  const { setDetentHeight } = useSheetDetents(DETENTS);

  useEffect(() => {
    setDetentHeight(headerHeight);
  }, [headerHeight, setDetentHeight]);

  return (
    <SheetView id="route" style={{ flex: 1 }}>
      <RouteEditor />
    </SheetView>
  );
}
