import ChartPreview from "@/components/charts/ChartPreview";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useChartCatalog } from "@/hooks/useChartCatalog";
import { useCharts } from "@/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { installCatalogEntry } from "@/lib/charts/catalog";
import { buildPreviewStyle, computeBounds } from "@/lib/charts/sources";
import { deleteChart } from "@/lib/database";
import {
  Button,
  Host,
  List,
  RNHostView,
  Section,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { foregroundStyle, frame, listRowInsets } from "@expo/ui/swift-ui/modifiers";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";

export default function CatalogEntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { entries } = useChartCatalog();
  const charts = useCharts();
  const theme = useTheme();

  const entry = entries.find((e) => e.id === id);
  const installedChart = charts.find((c) => c.catalog_entry_id === id);

  const previewStyle = useMemo(
    () => (entry ? buildPreviewStyle(entry.sources) : null),
    [entry],
  );
  const previewBounds = useMemo(
    () => (entry ? computeBounds(entry.sources) : undefined),
    [entry],
  );

  const handleInstall = useCallback(async () => {
    if (!entry) return;
    await installCatalogEntry(entry);
    router.back();
  }, [entry]);

  const handleUninstall = useCallback(async () => {
    if (!installedChart) return;
    await deleteChart(installedChart.id);
    router.back();
  }, [installedChart]);

  if (!entry) return null;

  return (
    <SheetView id="charts-catalog-detail">
      <SheetHeader title={entry.title} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        >
          Back
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            {previewStyle ? (
              <VStack
                modifiers={[
                  // setting to -1 removes the top/bottom margin form the list, but 0 doesn't.
                  listRowInsets({ top: -0.001, bottom: 0, }),
                  frame({ height: 200 }),
                ]}
              >
                <RNHostView>
                  <ChartPreview
                    mapStyle={previewStyle}
                    bounds={previewBounds}
                  />
                </RNHostView>
              </VStack>
            ) : null}
            <Section>
              <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                {entry.summary}
              </Text>
              {entry.description ? (
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  {entry.description}
                </Text>
              ) : null}
            </Section>

            <Section>
              {entry.license ? (
                <Text>License: {entry.license}</Text>
              ) : null}
              {entry.homepage ? (
                <Text>Homepage: {entry.homepage}</Text>
              ) : null}
              <Text>
                {entry.sources.length}{" "}
                {entry.sources.length === 1 ? "source" : "sources"}
              </Text>
            </Section>

            <Section>
              {entry.installed ? (
                <Button
                  systemImage="trash"
                  label="Uninstall"
                  role="destructive"
                  onPress={handleUninstall}
                />
              ) : (
                <Button
                  systemImage="arrow.down.circle"
                  label="Install"
                  onPress={handleInstall}
                />
              )}
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
