import ChartPreview from "@/components/charts/ChartPreview";
import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { useChartCatalog } from "@/hooks/useChartCatalog";
import useTheme from "@/hooks/useTheme";
import { installCatalogEntry } from "@/lib/charts/catalog";
import { buildPreviewStyle, computeBounds } from "@/lib/charts/sources";
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
import { router, Stack } from "expo-router";
import { View } from "react-native";

export default function ChartCatalog() {
  const { entries, loading } = useChartCatalog();
  const theme = useTheme();

  return (
    <SheetView id="charts-catalog">
      <SheetHeader title="Chart Catalog" />
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
          icon="plus"
          onPress={() => router.push("/charts/add")}
        >
          Manually Add
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

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
                  const previewStyle = buildPreviewStyle(entry.sources);
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
                          onPress={async () => await installCatalogEntry(entry)}
                        />
                      )}
                    </HStack>
                  );
                })}
              </Section>
            )}
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
