import ChartPreview from "@/charts/components/ChartPreview";
import SheetView from "@/ui/SheetView";
import { useCharts, type InstalledChart } from "@/charts/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { uninstallChart } from "@/charts/install";
import { selectChart, useChartStore } from "@/charts/store";
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
import { Alert, View } from "react-native";

export default function Charts() {
  const { selectedChartId } = useChartStore();
  const charts = useCharts();
  const theme = useTheme();

  function confirmDelete(chart: InstalledChart) {
    const { id, name } = chart;
    const selected =
      id === selectedChartId || (selectedChartId == null && id === charts[0]?.id);
    Alert.alert("Delete Chart", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          uninstallChart(id);
          if (selected) {
            selectChart(undefined);
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
                const selected =
                  chart.id === selectedChartId ||
                  (selectedChartId == null && chart.id === charts[0]?.id);

                return (
                  <ChartRow
                    key={chart.id}
                    chart={chart}
                    selected={selected}
                    theme={theme}
                    onPress={() =>
                      router.push({
                        pathname: "/charts/[id]",
                        params: { id: chart.id },
                      })
                    }
                    onSelect={() => selectChart(chart.id)}
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
  chart: InstalledChart;
  selected: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenu.Trigger>
        <HStack
          alignment="center"
          spacing={16}
          modifiers={[onTapGesture(onPress)]}
        >
          <RNHostView matchContents>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <ChartPreview
                mapStyle={chart.styleUri}
              />
            </View>
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
