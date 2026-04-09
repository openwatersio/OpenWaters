import ChartView from "@/components/ChartView";
import { RouteMode, useActiveRoute } from "@/hooks/useRoutes";
import { router } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  const isNavigating = useActiveRoute((r) => r?.mode === RouteMode.Navigating);

  // On app load, if a navigating route was restored from persisted state,
  // jump straight into the navigation screen. Only fires once per mount so
  // we don't race with the normal start-navigation flow in RouteEditor.
  useEffect(() => {
    if (isNavigating) {
      router.navigate("/route/navigate");
    }
  }, [isNavigating]);

  return <ChartView />;
}
