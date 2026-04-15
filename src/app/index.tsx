import ChartView from "@/map/components/ChartView";
import { RouteMode, useActiveRoute } from "@/routes/hooks/useRoutes";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { router, usePathname } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  const pathname = usePathname();
  const isNavigating = useActiveRoute((r) => r?.mode === RouteMode.Navigating);
  const { isRecording } = useTrackRecording();

  // Re-present activity screen when dismissed back to index
  useEffect(() => {
    if (!isNavigating && !isRecording) return;

    if (pathname === "/") router.navigate("/activity");
  }, [pathname, isNavigating, isRecording]);

  return <ChartView />;
}
