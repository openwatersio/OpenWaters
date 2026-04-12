import ChartPreview from "@/components/charts/ChartPreview";
import SheetView from "@/components/ui/SheetView";
import { useCharts } from "@/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { setViewOptions, useViewOptions } from "@/hooks/useViewOptions";
import { selectSources } from "@/lib/charts/provider";
import { buildMapStyle, computeBounds, type Chart } from "@/lib/charts/sources";
import { deleteChart } from "@/lib/database";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  Image,
  List,
  RNHostView,
  Section,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  lineLimit,
  onTapGesture
} from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { Alert, View } from "react-native";

export default function Charts() {
  const mapStyleId = useViewOptions((s) => s.mapStyleId);
  const charts = useCharts();
  const theme = useTheme();

  function confirmDelete(chart: Chart) {
    const { id, name } = chart;
    const selected =
      id === mapStyleId || (mapStyleId == null && id === charts[0]?.id);
    Alert.alert("Delete Chart", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteChart(id);
          if (selected) {
            setViewOptions({ mapStyleId: undefined });
          }
        },
      },
    ]);
  }

  return (
    <SheetView id="charts">
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="plus"
          onPress={() => router.push("/charts/catalog")}
        >
          Add
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section>
              {charts.map((chart) => {
                const { id } = chart;
                const selected =
                  id === mapStyleId ||
                  (mapStyleId == null && id === charts[0]?.id);

                return (
                  <ChartRow
                    key={id}
                    chart={chart}
                    selected={selected}
                    theme={theme}
                    onPress={() =>
                      router.push({
                        pathname: "/charts/[id]",
                        params: { id: String(id) },
                      })
                    }
                    onSelect={() => setViewOptions({ mapStyleId: id })}
                    onDelete={() => confirmDelete(chart)}
                  />
                );
              })}
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}

function ChartRow({
  chart,
  selected,
  theme,
  onPress,
  onSelect,
  onDelete,
}: {
  chart: Chart;
  selected: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const renderable = selectSources(chart.sources);
  const mapStyle = useMemo(
    () => (renderable.length > 0 ? buildMapStyle(renderable) : null),
    [renderable],
  );
  const previewBounds = useMemo(() => computeBounds(chart.sources), [chart.sources]);

  return (
    <ContextMenu>
      <ContextMenu.Trigger>
        <HStack
          alignment="center"
          spacing={16}
          modifiers={[onTapGesture(onPress)]}
        >
          <RNHostView matchContents>
            {mapStyle ? (
              <ChartPreview
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
                mapStyle={mapStyle}
                bounds={previewBounds}
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: theme.surfaceSecondary,
                }}
              />
            )}
          </RNHostView>
          <Text modifiers={[font({ size: 16, weight: "semibold" }), lineLimit(1)]}>
            {chart.name}
          </Text>
          {selected ? (
            <Image systemName="checkmark" size={14} color={theme.primary} />
          ) : null}
        </HStack>
      </ContextMenu.Trigger>
      <ContextMenu.Items>
        <Button
          label="Select"
          systemImage="checkmark.circle"
          onPress={onSelect}
        />
        <Button
          label="Delete"
          systemImage="trash"
          role="destructive"
          onPress={onDelete}
        />
      </ContextMenu.Items>
    </ContextMenu>
  );
}
