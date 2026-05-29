import ChartPreview from "@/charts/components/ChartPreview";
import { useOfflineStatus } from "@/charts/components/OfflineStatusButton";
import { useCharts } from "@/charts/hooks/useCharts";
import { selectChart, useChartStore } from "@/charts/store";
import {
  setThemePreference,
  useThemePreference,
  type ThemePreference,
} from "@/charts/theme";
import useTheme from "@/hooks/useTheme";
import SheetHeader from "@/ui/SheetHeader";
import SheetView from "@/ui/SheetView";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Picker,
  RNHostView,
  ScrollView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable } from "react-native";

const CARD_SIZE = 108;

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "day", label: "Day" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
];

const OFFLINE_LABEL = {
  full: "Downloaded",
  partial: "Partial",
  none: "Not downloaded",
} as const;

export default function ChartOptions() {
  const charts = useCharts();
  const { selectedChartId } = useChartStore();
  const { preference: themePreference } = useThemePreference();
  const { status, chartId } = useOfflineStatus();
  const theme = useTheme();

  const offlineColor =
    status === "full"
      ? theme.success
      : status === "partial"
        ? theme.warning
        : undefined;

  return (
    <SheetView id="charts-select">
      <SheetHeader title="Chart Options" />

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          {/* Installed charts + add — kept at the top so it's visible at the
              smallest (0.3) detent. */}
          <ScrollView axes="horizontal" showsIndicators={false}>
            <HStack
              alignment="top"
              spacing={12}
              modifiers={[padding({ horizontal: 16, vertical: 12 })]}
            >
              {charts.map((chart) => {
                const selected = chart.id === selectedChartId;
                return (
                  <VStack key={chart.id} alignment="center" spacing={6}>
                    <RNHostView matchContents>
                      {/* Tap is captured in RN: the embedded MapLibre view
                          swallows SwiftUI tap gestures, so we wrap the preview in
                          a Pressable and make the map non-interactive. */}
                      <Pressable
                        onPress={() => selectChart(chart.id)}
                        style={{
                          width: CARD_SIZE,
                          height: CARD_SIZE,
                          borderRadius: 12,
                          overflow: "hidden",
                          borderWidth: selected ? 4 : 1,
                          borderColor: selected ? theme.accent : theme.separator,
                        }}
                      >
                        <ChartPreview mapStyle={chart.styleUri} />
                      </Pressable>
                    </RNHostView>
                    <Text
                      modifiers={[
                        font({ size: 12, weight: selected ? "semibold" : "regular" }),
                        foregroundStyle(selected ? theme.label : theme.labelSecondary),
                        frame({ width: CARD_SIZE }),
                        lineLimit(1),
                      ]}
                    >
                      {chart.name}
                    </Text>
                  </VStack>
                );
              })}

              {/* Add a chart from the catalog */}
              <VStack alignment="center" spacing={6}>
                <RNHostView matchContents>
                  <Pressable
                    onPress={() => router.push("/charts/catalog")}
                    style={{
                      width: CARD_SIZE,
                      height: CARD_SIZE,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: theme.separator,
                      backgroundColor: theme.surfaceFloating,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SymbolView name="plus" size={32} tintColor={theme.accent} />
                  </Pressable>
                </RNHostView>
                <Text
                  modifiers={[
                    font({ size: 12 }),
                    foregroundStyle(theme.labelSecondary),
                    frame({ width: CARD_SIZE }),
                    lineLimit(1),
                  ]}
                >
                  Add
                </Text>
              </VStack>
            </HStack>
          </ScrollView>

          <List>
            <Section title="Theme">
              <Picker
                label="Theme"
                selection={themePreference}
                onSelectionChange={(value) =>
                  setThemePreference(value as ThemePreference)
                }
              >
                {THEME_OPTIONS.map(({ value, label }) => (
                  <Text key={value} modifiers={[tag(value)]}>
                    {label}
                  </Text>
                ))}
              </Picker>
            </Section>

            <Section>
              <Button
                onPress={() => {
                  if (chartId) {
                    router.push({
                      pathname: "/charts/[id]/offline",
                      params: { id: chartId },
                    });
                  }
                }}
              >
                <HStack spacing={12}>
                  <Image systemName="arrow.down.to.line" color={offlineColor} />
                  <Text>Offline Data</Text>
                  <Spacer />
                  <Text modifiers={[foregroundStyle(theme.labelSecondary)]}>
                    {OFFLINE_LABEL[status]}
                  </Text>
                </HStack>
              </Button>
            </Section>

            <Section>
              <Button
                label="Manage Charts…"
                systemImage="slider.horizontal.3"
                onPress={() => router.navigate("/charts")}
              />
              {selectedChartId && (
                <Button
                  label="About This Chart"
                  systemImage="info.circle"
                  onPress={() =>
                    router.push({
                      pathname: "/charts/[id]",
                      params: { id: selectedChartId },
                    })
                  }
                />
              )}
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
