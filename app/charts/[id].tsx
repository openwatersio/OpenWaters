import ChartPreview from "@/components/charts/ChartPreview";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useChart } from "@/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { setViewOptions } from "@/hooks/useViewOptions";
import { selectSources } from "@/lib/charts/provider";
import { buildMapStyle, computeBounds } from "@/lib/charts/sources";
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
import { foregroundStyle, listRowInsets } from "@expo/ui/swift-ui/modifiers";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert, View } from "react-native";

export default function ChartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chartId = Number(id);
  const chart = useChart(chartId);
  const theme = useTheme();

  const renderable = useMemo(
    () => (chart ? selectSources(chart.sources) : []),
    [chart],
  );
  const previewStyle = useMemo(
    () => (renderable.length > 0 ? buildMapStyle(renderable) : null),
    [renderable],
  );
  const previewBounds = useMemo(
    () => (chart ? computeBounds(chart.sources) : undefined),
    [chart],
  );

  const handleDelete = useCallback(() => {
    if (!chart) return;
    Alert.alert("Delete Chart", `Delete "${chart.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteChart(chart.id);
          setViewOptions({ mapStyleId: undefined });
          router.back();
        },
      },
    ]);
  }, [chart]);

  const handleSelect = useCallback(() => {
    if (!chart) return;
    setViewOptions({ mapStyleId: chart.id });
    router.back();
  }, [chart]);

  if (!chart) return null;

  return (
    <SheetView id="charts-detail">
      <SheetHeader title={chart.name} />
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
                ]}
              >
                <RNHostView matchContents>
                  <View
                    style={{
                      height: 200,
                      width: "100%",
                    }}
                  >
                    <ChartPreview
                      mapStyle={previewStyle}
                      bounds={previewBounds}
                      style={{ borderRadius: 0 }}
                    />
                  </View>
                </RNHostView>
              </VStack>
            ) : null}
            <Section>
              <Text>
                {chart.sources.length}{" "}
                {chart.sources.length === 1 ? "source" : "sources"}
              </Text>
              {chart.catalog_entry_id ? (
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  From catalog: {chart.catalog_entry_id}
                </Text>
              ) : null}
            </Section>

            <Section>
              <Button
                systemImage="checkmark.circle"
                label="Use This Chart"
                onPress={handleSelect}
              />
              <Button
                systemImage="trash"
                label="Delete"
                role="destructive"
                onPress={handleDelete}
              />
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
