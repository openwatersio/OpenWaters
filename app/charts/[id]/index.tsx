import ChartPreview from "@/components/charts/ChartPreview";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useCameraView } from "@/hooks/useCameraView";
import { useChart } from "@/hooks/useCharts";
import {
  downloadVisibleArea,
  loadPacks,
  removePack,
  usePacksForChart,
} from "@/hooks/useOfflinePacks";
import useTheme from "@/hooks/useTheme";
import { uninstallChart } from "@/lib/charts/install";
import { selectChart } from "@/lib/charts/store";
import { formatBytes } from "@/lib/format";
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
import { useCallback, useEffect } from "react";
import { Alert, View } from "react-native";

export default function ChartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chart = useChart(id);
  const theme = useTheme();
  const tilePacks = usePacksForChart(id);

  // Load packs on mount
  useEffect(() => { loadPacks(); }, []);

  const handleDelete = useCallback(() => {
    if (!chart) return;
    Alert.alert("Remove Chart", `Remove "${chart.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          uninstallChart(chart.id);
          selectChart(undefined);
          router.back();
        },
      },
    ]);
  }, [chart]);

  const handleSelect = useCallback(() => {
    if (!chart) return;
    selectChart(chart.id);
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
            <VStack
              modifiers={[
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
                    mapStyle={chart.styleUri}
                    style={{ borderRadius: 0 }}
                  />
                </View>
              </RNHostView>
            </VStack>
            <Section>
              {chart.catalogEntry ? (
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  From catalog: {chart.catalogEntry.title}
                </Text>
              ) : null}
            </Section>

            {chart.catalogEntry ? (
              <Section>
                <Button
                  systemImage="arrow.down.circle"
                  label="Offline Regions"
                  onPress={() =>
                    router.push({
                      pathname: "/charts/[id]/offline",
                      params: { id: chart.id },
                    })
                  }
                />
              </Section>
            ) : null}

            <Section title="Tile Cache">
              <Button
                systemImage="square.and.arrow.down"
                label="Cache Visible Area"
                onPress={() => {
                  const { bounds, zoom } = useCameraView.getState();
                  if (!bounds) return;
                  downloadVisibleArea(
                    chart.id,
                    chart.styleUri,
                    bounds,
                    zoom,
                    Math.min(Math.floor(zoom) + 4, 22),
                  );
                }}
              />
              {tilePacks.map((pack) => {
                const percentage = pack.status?.percentage ?? 0;
                const state = pack.status?.state ?? "inactive";
                const tileCount = pack.status?.completedTileCount ?? 0;
                const size = pack.status?.completedTileSize ?? 0;

                return (
                  <VStack key={pack.packId} alignment="leading">
                    <Text>
                      {state === "complete"
                        ? `${tileCount} tiles · ${formatBytes(size)}`
                        : state === "active"
                          ? `Downloading… ${percentage.toFixed(0)}%`
                          : "Queued"}
                    </Text>
                    <Button
                      systemImage="trash"
                      label="Delete"
                      role="destructive"
                      onPress={() => removePack(pack.packId)}
                    />
                  </VStack>
                );
              })}
            </Section>

            <Section>
              <Button
                systemImage="checkmark.circle"
                label="Use This Chart"
                onPress={handleSelect}
              />
              <Button
                systemImage="trash"
                label="Remove"
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
