import ChartPreview from "@/charts/components/ChartPreview";
import SheetHeader from "@/ui/SheetHeader";
import SheetView from "@/ui/SheetView";
import { useChartCatalog } from "@/charts/hooks/useChartCatalog";
import { useSourceFilters } from "@/charts/hooks/useCharts";
import useTheme from "@/hooks/useTheme";
import { installCatalogEntry } from "@/charts/install";
import { buildPreviewStyle, computeBounds } from "@/charts/sources";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  RNHostView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  buttonStyle,
  clipShape,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  lineLimit,
  onTapGesture,
  padding
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { View } from "react-native";

export default function ChartCatalog() {
  const { entries, loading } = useChartCatalog();
  const theme = useTheme();
  const filters = useSourceFilters();

  return (
    <SheetView id="charts-catalog">
      <SheetHeader title="Chart Catalog" />

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            {loading ? (
              <Section>
                <Text>Loading catalog…</Text>
              </Section>
            ) : (
              <Section>
                {entries.map((entry) => {
                  const previewStyle = buildPreviewStyle(entry.sources, filters);
                  const previewBounds = computeBounds(entry.sources);

                  return (
                    <HStack
                      key={entry.id}
                      alignment="center"
                      spacing={12}
                      modifiers={[
                        onTapGesture(() =>
                          router.push({
                            pathname: "/charts/catalog/[id]",
                            params: { id: entry.id },
                          }),
                        ),
                        padding({ vertical: 4 }),
                        animation(Animation.default, entry.installed),
                      ]}
                    >
                      <RNHostView matchContents>
                        <View
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 8,
                            overflow: "hidden",
                          }}
                        >
                          {previewStyle ? (
                            <ChartPreview
                              mapStyle={previewStyle}
                              bounds={previewBounds}
                            />
                          ) : (
                            <View
                              style={{
                                width: 56,
                                height: 56,
                                backgroundColor: theme.surfaceSecondary,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            />
                          )}
                        </View>
                      </RNHostView>
                      <VStack alignment="leading" spacing={2}>
                        <Text
                          modifiers={[
                            font({ size: 16, weight: "semibold" }),
                            lineLimit(1),
                          ]}
                        >
                          {entry.title}
                        </Text>
                        <Text
                          modifiers={[
                            font({ size: 13 }),
                            foregroundStyle(theme.textSecondary),
                            lineLimit(2),
                          ]}
                        >
                          {entry.summary}
                        </Text>
                      </VStack>
                      <Spacer />
                      {entry.installed ? (
                        <Image
                          systemName="checkmark"
                          size={15}
                          color={theme.success}
                          modifiers={[frame({ width: 32, height: 32 })]}
                        />
                      ) : (
                        <Button
                          systemImage="plus"
                          label="Install"
                          modifiers={[
                            labelStyle("iconOnly"),
                            buttonStyle("borderedProminent"),
                            clipShape("circle"),
                            frame({ width: 32, height: 32 })
                          ]}
                          onPress={() => installCatalogEntry(entry)}
                        />
                      )}
                    </HStack>
                  );
                })}
              </Section>
            )}
            <Section>
              <HStack
                modifiers={[onTapGesture(() => router.push("/charts/add"))]}
              >
                <Text modifiers={[foregroundStyle(theme.primary)]}>
                  Manually Add Chart…
                </Text>
                <Spacer />
                <Image
                  systemName="chevron.right"
                  size={13}
                  color={theme.textSecondary}
                />
              </HStack>
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
