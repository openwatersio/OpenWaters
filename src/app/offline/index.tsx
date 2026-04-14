import SheetView from "@/ui/SheetView";
import { useCharts } from "@/charts/hooks/useCharts";
import { getAvailableDownloads } from "@/charts/hooks/useAvailableDownloads";
import { deleteDownload, useDownloads } from "@/charts/hooks/useDownloads";
import {
  loadPacks,
  removePack,
  useOfflinePacks,
  type TilePackState,
} from "@/charts/hooks/useOfflinePacks";
import {
  AMBIENT_CACHE_OPTIONS,
  TILE_LIMIT_OPTIONS,
  setAmbientCacheSize,
  setTileCountLimit,
  useOfflineSettings,
} from "@/charts/hooks/useOfflineSettings";
import useTheme from "@/hooks/useTheme";
import { formatBytes } from "@/format";
import { getFreeDiskStorageAsync } from "expo-file-system/legacy";
import {
  Button,
  Host,
  HStack,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

export default function OfflineManagement() {
  const charts = useCharts();
  const allPacks = useOfflinePacks((s) => s.packs);
  const allDownloads = useDownloads((s) => s.downloads);
  const ambientCacheSize = useOfflineSettings((s) => s.ambientCacheSize);
  const tileCountLimit = useOfflineSettings((s) => s.tileCountLimit);
  const theme = useTheme();
  const [freeSpace, setFreeSpace] = useState<number | null>(null);

  useEffect(() => {
    loadPacks();
    getFreeDiskStorageAsync().then(setFreeSpace).catch(() => {});
  }, []);

  // Aggregate offline data per chart
  const chartOfflineData = useMemo(() => {
    return charts
      .map((chart) => {
        const downloads = getAvailableDownloads(chart.id).filter(
          (s) => s.downloaded,
        );
        const packs = Object.values(allPacks).filter(
          (p) => p.chartId === chart.id,
        );

        if (downloads.length === 0 && packs.length === 0) return null;

        const downloadedBytes = downloads.reduce(
          (sum, s) => sum + (s.sizeBytes ?? 0),
          0,
        );
        const packedBytes = packs.reduce(
          (sum, p) => sum + (p.status?.completedTileSize ?? 0),
          0,
        );

        return {
          chart,
          downloads,
          packs,
          totalBytes: downloadedBytes + packedBytes,
        };
      })
      .filter(Boolean);
  }, [charts, allPacks]);

  const totalStorageUsed = chartOfflineData.reduce(
    (sum, d) => sum + (d?.totalBytes ?? 0),
    0,
  );

  // Check for active downloads across all charts
  const activeDownloadCount = Object.values(allDownloads).filter(
    (d) => d.status === "downloading",
  ).length;

  return (
    <SheetView id="offline">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            {/* Storage summary */}
            <Section title="Storage">
              <HStack>
                <Text>Offline data</Text>
                <Spacer />
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  {formatBytes(totalStorageUsed)}
                </Text>
              </HStack>
              {freeSpace != null ? (
                <HStack>
                  <Text>Free space</Text>
                  <Spacer />
                  <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                    {formatBytes(freeSpace)}
                  </Text>
                </HStack>
              ) : null}
              {activeDownloadCount > 0 ? (
                <Text modifiers={[foregroundStyle(theme.primary)]}>
                  {activeDownloadCount} download{activeDownloadCount > 1 ? "s" : ""} in progress
                </Text>
              ) : null}
            </Section>

            {/* Per-chart sections */}
            {chartOfflineData.map((data) => {
              if (!data) return null;
              const { chart, downloads, packs } = data;

              return (
                <Section key={chart.id} title={chart.name}>
                  {/* Downloaded MBTiles regions */}
                  {downloads.map((source) => (
                    <HStack key={source.id} alignment="center">
                      <VStack alignment="leading" spacing={2}>
                        <Text modifiers={[font({ size: 15 })]}>
                          {source.title}
                        </Text>
                        <Text
                          modifiers={[
                            font({ size: 12 }),
                            foregroundStyle(theme.textSecondary),
                          ]}
                        >
                          {source.sizeBytes
                            ? formatBytes(source.sizeBytes)
                            : "MBTiles region"}
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
                            `Delete "${source.title}"? The file will need to be re-downloaded for offline use.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => deleteDownload(chart.id, source.id),
                              },
                            ],
                          )
                        }
                      />
                    </HStack>
                  ))}

                  {/* Tile packs */}
                  {packs.map((pack) => (
                    <TilePackRow
                      key={pack.packId}
                      pack={pack}
                      theme={theme}
                    />
                  ))}
                </Section>
              );
            })}

            {chartOfflineData.length === 0 ? (
              <Section>
                <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                  No offline data downloaded yet. Open a chart and download
                  regions or cache tiles for offline use.
                </Text>
              </Section>
            ) : null}

            {/* Storage settings */}
            <Section title="Settings">
              <Picker
                label="Ambient cache"
                selection={String(ambientCacheSize)}
                onSelectionChange={(v) => setAmbientCacheSize(Number(v))}
              >
                {AMBIENT_CACHE_OPTIONS.map((opt) => (
                  <Text key={opt.value} modifiers={[tag(String(opt.value))]}>
                    {opt.label}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Tile limit per pack"
                selection={String(tileCountLimit)}
                onSelectionChange={(v) =>
                  setTileCountLimit(v === "Infinity" ? Infinity : Number(v))
                }
              >
                {TILE_LIMIT_OPTIONS.map((opt) => (
                  <Text
                    key={String(opt.value)}
                    modifiers={[tag(String(opt.value))]}
                  >
                    {opt.label}
                  </Text>
                ))}
              </Picker>
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}

function TilePackRow({
  pack,
  theme,
}: {
  pack: TilePackState;
  theme: ReturnType<typeof useTheme>;
}) {
  const state = pack.status?.state ?? "inactive";
  const percentage = pack.status?.percentage ?? 0;
  const tileCount = pack.status?.completedTileCount ?? 0;
  const size = pack.status?.completedTileSize ?? 0;

  const label =
    state === "complete"
      ? `${tileCount} tiles · ${formatBytes(size)}`
      : state === "active"
        ? `Caching tiles… ${percentage.toFixed(0)}%`
        : "Queued";

  return (
    <HStack alignment="center">
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 15 })]}>Tile cache</Text>
        <Text
          modifiers={[font({ size: 12 }), foregroundStyle(theme.textSecondary)]}
        >
          {label}
        </Text>
      </VStack>
      <Spacer />
      <Button
        systemImage="trash"
        label="Delete"
        role="destructive"
        onPress={() => removePack(pack.packId)}
      />
    </HStack>
  );
}
