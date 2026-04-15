import { getAvailableDownloads } from "@/charts/hooks/useAvailableDownloads";
import { useCharts } from "@/charts/hooks/useCharts";
import { useOfflinePacks } from "@/charts/hooks/useOfflinePacks";
import { useChartStore } from "@/charts/store";
import useTheme from "@/hooks/useTheme";
import { Button, Image } from "@expo/ui/swift-ui";
import {
  frame,
  glassEffect,
  glassEffectId,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useMemo } from "react";

const NS_ID = "map-controls";

type OfflineStatus = "full" | "partial" | "none";

function useOfflineStatus(): { status: OfflineStatus; chartId: string | undefined } {
  const charts = useCharts();
  const { selectedChartId } = useChartStore();
  const { packs } = useOfflinePacks();

  const chart = charts.find((c) => c.id === selectedChartId) ?? charts[0];

  return useMemo(() => {
    if (!chart) return { status: "none" as const, chartId: undefined };

    const sources = getAvailableDownloads(chart.id);
    const hasTilePacks = Object.values(packs).some(
      (p) => p.chartId === chart.id,
    );

    if (sources.length === 0 && !chart.catalogEntry) {
      // Non-catalog chart — check tile packs only
      return {
        status: hasTilePacks ? "full" : "none",
        chartId: chart.id,
      };
    }

    if (sources.length === 0) {
      return {
        status: hasTilePacks ? "partial" : "none",
        chartId: chart.id,
      };
    }

    const allDownloaded = sources.every((s) => s.downloaded);
    const someDownloaded = sources.some((s) => s.downloaded) || hasTilePacks;

    return {
      status: allDownloaded ? "full" : someDownloaded ? "partial" : "none",
      chartId: chart.id,
    };
  }, [chart, packs]);
}

export function OfflineStatusButton() {
  const theme = useTheme();
  const { status, chartId } = useOfflineStatus();

  const iconColor =
    status === "full"
      ? theme.success
      : status === "partial"
        ? theme.warning
        : undefined;

  return (
    <Button
      onPress={() => {
        if (chartId) {
          router.push({
            pathname: "/charts/[id]/offline",
            params: { id: chartId },
          });
        }
      }}
      modifiers={[
        frame({ width: 44, height: 44 }),
        glassEffect({
          glass: { variant: "regular", interactive: true },
          shape: "circle",
        }),
        glassEffectId("offline", NS_ID),
      ]}
    >
      <Image
        systemName="arrow.down.to.line"
        size={17}
        color={iconColor}
      />
    </Button>
  );
}
