import ChartView from "@/components/ChartView";
import { RouteMode, useActiveRoute } from "@/hooks/useRoutes";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import { router, usePathname } from "expo-router";
import { useEffect } from "react";

export default function Index() {
  const pathname = usePathname();
  const isNavigating = useActiveRoute((r) => r?.mode === RouteMode.Navigating);
  const isRecording = useTrackRecording((s) => s.isRecording);

  // Re-present activity screen when dismissed back to index
  useEffect(() => {
    if (!isNavigating && !isRecording) return;

    if (pathname === "/") router.navigate("/activity");
  }, [pathname, isNavigating, isRecording]);

  return <ChartView />;
}
