import ChartPreview from "@/charts/components/ChartPreview";
import SheetHeader from "@/ui/SheetHeader";
import SheetView from "@/ui/SheetView";
import { useChart } from "@/charts/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { uninstallChart } from "@/charts/install";
import { selectChart } from "@/charts/store";
import { NavigationLink } from "@/ui/NavigationLink";
import {
  Button,
  Host,
  LabeledContent,
  List,
  RNHostView,
  Section,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { foregroundStyle, listRowInsets } from "@expo/ui/swift-ui/modifiers";
import { type ExternalPathString, router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert, View } from "react-native";

export default function ChartDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chart = useChart(id);
  const theme = useTheme();

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

  const attributions = useMemo(() => {
    if (!chart?.catalogEntry) return [];
    return Array.from(
      new Set(
        chart.catalogEntry.sources
          .map((s) => s.attribution)
          .filter((a): a is string => Boolean(a)),
      ),
    );
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
                <Text modifiers={[foregroundStyle(theme.labelSecondary)]}>
                  From catalog: {chart.catalogEntry.title}
                </Text>
              ) : null}
            </Section>

            {chart.catalogEntry && (
              <Section title="Attribution">
                <LabeledContent label="License">
                  <Text>{chart.catalogEntry.license}</Text>
                </LabeledContent>
                {chart.catalogEntry.homepage && (
                  <NavigationLink
                    label="Homepage"
                    destination={
                      chart.catalogEntry.homepage as ExternalPathString
                    }
                  />
                )}
                {attributions.map((attr) => (
                  <Text key={attr}>{attr}</Text>
                ))}
              </Section>
            )}

            <Section>
              <Button
                systemImage="arrow.down.to.line"
                label="Offline"
                onPress={() =>
                  router.push({
                    pathname: "/charts/[id]/offline",
                    params: { id: chart.id },
                  })
                }
              />
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
