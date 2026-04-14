import SheetView from "@/components/ui/SheetView";
import { useCameraView } from "@/hooks/useCameraView";
import { useChart } from "@/hooks/useCharts";
import { hideDownloadOverlay, showDownloadOverlay } from "@/hooks/useDownloadOverlay";
import { startDownload } from "@/hooks/useDownloads";
import { downloadVisibleArea } from "@/hooks/useOfflinePacks";
import useTheme from "@/hooks/useTheme";
import { planDownload, planTilePackOnly } from "@/lib/charts/downloadStrategy";
import { readLocalPaths } from "@/lib/charts/style";
import { formatBytes } from "@/lib/format";
import {
  Host,
  List,
  Section,
  Slider,
  Text,
  VStack
} from "@expo/ui/swift-ui";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ZOOM_RANGE = 6;
const MIN_POSSIBLE_ZOOM = 0;
const MAX_POSSIBLE_ZOOM = 22;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DownloadRegion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chart = useChart(id);
  const theme = useTheme();
  const [downloading, setDownloading] = useState(false);

  // Show the rectangle overlay on the map behind the sheet
  useEffect(() => {
    showDownloadOverlay();
    return () => hideDownloadOverlay();
  }, []);

  // Get current viewport from the map behind the sheet
  const bounds = useCameraView((s) => s.bounds);
  const zoom = useCameraView((s) => s.zoom);

  // Zoom range state — defaults from current map zoom
  const [minZoom] = useState(
    Math.min(
      Math.max(Math.floor(zoom), MIN_POSSIBLE_ZOOM),
      MAX_POSSIBLE_ZOOM - 1,
    ),
  );
  const [maxZoom, setMaxZoom] = useState(
    Math.max(
      minZoom + 1,
      Math.min(Math.floor(zoom) + DEFAULT_ZOOM_RANGE, MAX_POSSIBLE_ZOOM),
    ),
  );

  // Compute download plan
  const plan = useMemo(() => {
    if (!bounds || !chart) return null;

    if (chart.catalogEntry) {
      const localPaths = readLocalPaths(chart.id);
      const alreadyDownloaded = new Set(Object.keys(localPaths));
      return planDownload(
        chart.catalogEntry,
        bounds,
        minZoom,
        maxZoom,
        alreadyDownloaded,
      );
    }

    return planTilePackOnly(bounds, minZoom, maxZoom);
  }, [bounds, chart, minZoom, maxZoom]);

  const handleDownload = useCallback(async () => {
    if (!chart || !bounds || !plan) return;
    setDownloading(true);

    try {
      // Download MBTiles files
      for (const file of plan.files) {
        startDownload(chart.id, file.id, file.url);
      }

      // Create tile pack if needed
      if (plan.needsTilePack) {
        await downloadVisibleArea(
          chart.id,
          chart.styleUri,
          bounds,
          minZoom,
          maxZoom,
        );
      }

      router.back();
    } catch {
      setDownloading(false);
    }
  }, [chart, bounds, plan, minZoom, maxZoom]);

  if (!chart) return null;

  // Summary line
  const parts: string[] = [];
  if (plan && plan.files.length > 0) {
    parts.push(
      `${plan.files.length} region${plan.files.length > 1 ? "s" : ""}`,
    );
  }
  if (plan && plan.needsTilePack && plan.estimatedTileCount > 0) {
    parts.push(`~${plan.estimatedTileCount.toLocaleString()} tiles`);
  }
  return (
    <SheetView id="download-region" headerDetent additionalDetents={[0.25]}>
      <Stack.Screen
        options={{
          title: plan ? `~${formatBytes(plan.estimatedBytes)}` : "Download",
          sheetLargestUndimmedDetentIndex: "last",
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        >
          Back
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="arrow.down.to.line"
          tintColor={theme.success}
          variant="prominent"
          onPress={handleDownload}
          disabled={downloading || !plan}
        >
          {downloading ? "Downloading…" : "Download"}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            {/* Zoom detail level */}
            <Section title="Detail Level">
              <Slider
                label={<Text>Zoom {minZoom}–{maxZoom}</Text>}
                minimumValueLabel={<Text>Less</Text>}
                maximumValueLabel={<Text>More</Text>}
                value={maxZoom}
                min={minZoom + 1}
                max={MAX_POSSIBLE_ZOOM}
                step={1}
                onValueChange={setMaxZoom}
              />
            </Section>

          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
