import ChartPreview from "@/charts/components/ChartPreview";
import SheetHeader from "@/ui/SheetHeader";
import SheetView from "@/ui/SheetView";
import { useChartCatalog } from "@/charts/hooks/useChartCatalog";
import { useChart, useSourceFilters } from "@/charts/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { installCatalogEntry, uninstallChart } from "@/charts/install";
import { buildPreviewStyle, computeBounds } from "@/charts/sources";
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
  const installedChart = useChart(id);
  const theme = useTheme();
  const filters = useSourceFilters();

  const entry = entries.find((e) => e.id === id);

  const previewStyle = useMemo(
    () => (entry ? buildPreviewStyle(entry.sources, filters) : null),
    [entry, filters],
  );
  const previewBounds = useMemo(
    () => (entry ? computeBounds(entry.sources) : undefined),
    [entry],
  );

  const handleInstall = useCallback(() => {
    if (!entry) return;
    installCatalogEntry(entry);
    router.back();
  }, [entry]);

  const handleUninstall = useCallback(() => {
    if (!installedChart) return;
    uninstallChart(installedChart.id);
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
              <Text modifiers={[foregroundStyle(theme.labelSecondary)]}>
                {entry.summary}
              </Text>
              {entry.description ? (
                <Text modifiers={[foregroundStyle(theme.labelSecondary)]}>
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
