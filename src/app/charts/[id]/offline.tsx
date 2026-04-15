import { useAvailableDownloads } from "@/charts/hooks/useAvailableDownloads";
import { useChart } from "@/charts/hooks/useCharts";
import { deleteDownload, stopDownload, useDownloads } from "@/charts/hooks/useDownloads";
import {
  loadPacks,
  pausePack,
  removePack,
  resumePack,
  usePacksForChart,
} from "@/charts/hooks/useOfflinePacks";
import { formatBytes } from "@/format";
import useTheme from "@/hooks/useTheme";
import {
  Button,
  Host,
  HStack,
  List,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
} from "@expo/ui/swift-ui/modifiers";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

export default function OfflineSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chart = useChart(id);
  const sources = useAvailableDownloads(id);
  const { downloads } = useDownloads();
  const tilePacks = usePacksForChart(id);
  const theme = useTheme();

  useEffect(() => { loadPacks(); }, []);

  const downloadedSources = sources.filter((s) => s.downloaded);
  const activeDownloads = Object.entries(downloads).filter(
    ([key]) => key.startsWith(`${id}:`),
  );

  const mbtilesBytes = downloadedSources.reduce(
    (sum, s) => sum + (s.sizeBytes ?? 0),
    0,
  );
  const tilePackBytes = tilePacks.reduce(
    (sum, p) => sum + (p.status?.completedTileSize ?? 0),
    0,
  );
  const totalBytes = mbtilesBytes + tilePackBytes;

  const hasAnyData = downloadedSources.length > 0 || tilePacks.length > 0;

  const handleDeleteAll = () => {
    Alert.alert(
      "Delete All Offline Data",
      "Remove all downloaded regions and cached tiles for this chart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            for (const source of downloadedSources) {
              await deleteDownload(id, source.id);
            }
            for (const pack of tilePacks) {
              await removePack(pack.packId);
            }
          },
        },
      ],
    );
  };

  if (!chart) return null;

  return (
    <>
      <Stack.Screen options={{
        title: "Offline Chart Data",
      }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.back()}>
          Back
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="arrow.down.to.line"
          onPress={() =>
            router.push({ pathname: "/charts/[id]/download", params: { id } })
          }
        >
          Download
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            {/* Storage summary */}
            <Section title="Storage">
              <HStack>
                <Text>Total offline data</Text>
                <Spacer />
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  {hasAnyData ? formatBytes(totalBytes) : "None"}
                </Text>
              </HStack>
            </Section>

            {/* Downloads: active + completed */}
            {activeDownloads.length > 0 || downloadedSources.length > 0 ? (
              <Section title="Downloads">
                {activeDownloads.map(([key, state]) => {
                  const sourceId = key.split(":").slice(1).join(":");
                  const source = sources.find((s) => s.id === sourceId);
                  const title = source?.title ?? sourceId;
                  const progress = state.progress;
                  const percent = progress && progress.totalBytesExpectedToWrite > 0
                    ? (progress.totalBytesWritten / progress.totalBytesExpectedToWrite * 100).toFixed(0)
                    : null;

                  return (
                    <HStack key={key} alignment="center">
                      <VStack alignment="leading" spacing={2}>
                        <Text modifiers={[font({ size: 15 })]}>
                          {title}
                        </Text>
                        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.warning)]}>
                          {state.status === "error"
                            ? `Error: ${state.error}`
                            : percent
                              ? `Downloading… ${percent}% (${formatBytes(progress!.totalBytesWritten)})`
                              : "Downloading…"}
                        </Text>
                      </VStack>
                      <Spacer />
                      <Button
                        systemImage="xmark.circle"
                        label="Cancel"
                        role="destructive"
                        onPress={() => stopDownload(id, sourceId)}
                      />
                    </HStack>
                  );
                })}
                {downloadedSources.map((source) => (
                  <HStack key={source.id} alignment="center">
                    <VStack alignment="leading" spacing={2}>
                      <Text modifiers={[font({ size: 15 })]}>
                        {source.title}
                      </Text>
                      <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.textSecondary)]}>
                        {source.sizeBytes ? formatBytes(source.sizeBytes) : "MBTiles"}
                      </Text>
                    </VStack>
                    <Spacer />
                    <Button
                      systemImage="trash"
                      label="Delete"
                      role="destructive"
                      onPress={() =>
                        Alert.alert(
                          "Delete Region",
                          `Delete "${source.title}"?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => deleteDownload(id, source.id),
                            },
                          ],
                        )
                      }
                    />
                  </HStack>
                ))}
              </Section>
            ) : null}

            {/* Tile packs */}
            {tilePacks.length > 0 ? (
              <Section title="Cached Tiles">
                {tilePacks.map((pack) => {
                  const state = pack.status?.state ?? "inactive";
                  const percentage = pack.status?.percentage ?? 0;
                  const tileCount = pack.status?.completedTileCount ?? 0;
                  const size = pack.status?.completedTileSize ?? 0;

                  return (
                    <VStack key={pack.packId} alignment="leading" spacing={4}>
                      <HStack alignment="center">
                        <VStack alignment="leading" spacing={2}>
                          <Text modifiers={[font({ size: 15 })]}>Tile cache</Text>
                          <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.textSecondary)]}>
                            {state === "complete"
                              ? `${tileCount} tiles · ${formatBytes(size)}`
                              : state === "active"
                                ? `Caching… ${percentage.toFixed(0)}%`
                                : "Paused"}
                          </Text>
                        </VStack>
                        <Spacer />
                        {state === "active" ? (
                          <Button
                            systemImage="pause.circle"
                            label="Pause"
                            onPress={() => pausePack(pack.packId)}
                          />
                        ) : state === "inactive" ? (
                          <Button
                            systemImage="play.circle"
                            label="Resume"
                            onPress={() => resumePack(pack.packId)}
                          />
                        ) : null}
                        <Button
                          systemImage="trash"
                          label="Delete"
                          role="destructive"
                          onPress={() => removePack(pack.packId)}
                        />
                      </HStack>
                    </VStack>
                  );
                })}
              </Section>
            ) : null}

            {/* Actions */}
            {hasAnyData ? (
              <Section>
                <Button
                  systemImage="trash"
                  label="Delete All Offline Data"
                  role="destructive"
                  onPress={handleDeleteAll}
                />
              </Section>
            ) : null}

            {/* Empty state */}
            {!hasAnyData && activeDownloads.length === 0 ? (
              <Section
                footer={
                  <Text>
                    Download a region to use this chart offline.
                  </Text>
                }
              >
                <Button
                  systemImage="arrow.down.to.line"
                  label="Download Region"
                  onPress={() =>
                    router.push({
                      pathname: "/charts/[id]/download",
                      params: { id },
                    })
                  }
                />
              </Section>
            ) : null}
          </List>
        </VStack>
      </Host>
    </>
  );
}
