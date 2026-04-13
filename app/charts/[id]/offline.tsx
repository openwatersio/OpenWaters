import {
  useAvailableDownloads,
  type DownloadableSource,
} from "@/hooks/useAvailableDownloads";
import { useChart } from "@/hooks/useCharts";
import {
  deleteDownload,
  startDownload,
  stopDownload,
  useDownloads,
  type DownloadState,
} from "@/hooks/useDownloads";
import useTheme from "@/hooks/useTheme";
import type { PressEventWithFeatures } from "@maplibre/maplibre-react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
} from "@maplibre/maplibre-react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function boundsToPolygon(
  id: string,
  bounds: [number, number, number, number],
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [west, south, east, north] = bounds;
  return {
    type: "Feature",
    id,
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function OfflineRegions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chart = useChart(id);
  const sources = useAvailableDownloads(id);
  const downloads = useDownloads((s) => s.downloads);
  const theme = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Compute bounds that cover all regions for the initial camera
  const coverageBounds = useMemo(() => {
    let west = 180, south = 90, east = -180, north = -90;
    let found = false;
    for (const s of sources) {
      if (!s.bounds) continue;
      found = true;
      west = Math.min(west, s.bounds[0]);
      south = Math.min(south, s.bounds[1]);
      east = Math.max(east, s.bounds[2]);
      north = Math.max(north, s.bounds[3]);
    }
    return found ? [west, south, east, north] as [number, number, number, number] : undefined;
  }, [sources]);

  const selectedSource = sources.find((s) => s.id === selectedId);
  const selectedDownload = selectedId
    ? downloads[`${id}:${selectedId}`]
    : undefined;

  // Build GeoJSON with download state as a property for data-driven styling
  // State: "downloaded" | "downloading" | "available"
  const regionsGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: sources
      .filter((s) => s.bounds)
      .map((s) => {
        const dl = downloads[`${id}:${s.id}`];
        const state = s.downloaded
          ? "downloaded"
          : dl?.status === "downloading"
            ? "downloading"
            : "available";
        return {
          ...boundsToPolygon(s.id, s.bounds!),
          properties: { id: s.id, title: s.title, state },
        };
      }),
  }), [sources, downloads, id]);

  const handleRegionPress = useCallback(
    (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
      e.stopPropagation();
      const feature = e.nativeEvent.features?.[0];
      if (feature?.properties?.id) {
        setSelectedId(feature.properties.id as string);
      }
    },
    [],
  );

  const handleMapPress = useCallback(() => {
    setSelectedId(null);
  }, []);

  if (!chart) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Offline Regions", headerShown: true, headerTransparent: true }} />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.back()}>
          Back
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Map
        style={styles.map}
        mapStyle={chart.styleUri}
        onPress={handleMapPress}
        touchRotate={false}
        touchPitch={false}
        attribution={false}
        logo={false}
        compass={false}
      >
        <Camera
          initialViewState={
            coverageBounds
              ? { bounds: coverageBounds, padding: { top: 80, bottom: 80, left: 20, right: 20 } }
              : { center: [-98, 38], zoom: 3 }
          }
        />

        <GeoJSONSource
          id="regions"
          data={regionsGeoJSON}
          onPress={handleRegionPress}
        >
          <Layer
            id="regions-fill"
            type="fill"
            paint={{
              "fill-color": [
                "match", ["get", "state"],
                "downloaded", theme.success,
                "downloading", theme.warning,
                theme.primary,
              ],
              "fill-opacity": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                0.3,
                ["match", ["get", "state"],
                  "downloaded", 0.15,
                  "downloading", 0.2,
                  0.08,
                ],
              ],
            }}
          />
          <Layer
            id="regions-line"
            type="line"
            paint={{
              "line-color": [
                "match", ["get", "state"],
                "downloaded", theme.success,
                "downloading", theme.warning,
                theme.primary,
              ],
              "line-width": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                3,
                ["match", ["get", "state"],
                  "downloaded", 2,
                  "downloading", 2,
                  1.5,
                ],
              ],
              "line-opacity": [
                "case",
                ["==", ["get", "id"], selectedId ?? ""],
                1,
                ["match", ["get", "state"],
                  "downloaded", 0.8,
                  "downloading", 0.9,
                  0.5,
                ],
              ],
            }}
          />
        </GeoJSONSource>
      </Map>

      {/* Selected region callout */}
      {selectedSource ? (
        <SafeAreaView style={styles.calloutOverlay} edges={["bottom"]} pointerEvents="box-none">
          <RegionCallout
            chartId={id}
            source={selectedSource}
            downloadState={selectedDownload}
            theme={theme}
          />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Region callout
// ---------------------------------------------------------------------------

function RegionCallout({
  chartId,
  source,
  downloadState,
  theme,
}: {
  chartId: string;
  source: DownloadableSource;
  downloadState?: DownloadState;
  theme: ReturnType<typeof useTheme>;
}) {
  const isDownloading = downloadState?.status === "downloading";
  const progress = downloadState?.progress;
  const percentage =
    progress && progress.totalBytesExpectedToWrite > 0
      ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite
      : 0;

  return (
    <View style={[styles.callout, { backgroundColor: theme.surface + "F2" }]}>
      <Text style={[styles.calloutTitle, { color: theme.textPrimary }]}>
        {source.title}
      </Text>
      <Text style={[styles.calloutDetail, { color: theme.textSecondary }]}>
        {source.sizeBytes ? formatBytes(source.sizeBytes) : "Unknown size"}
        {source.updated ? `  ·  ${source.updated.slice(0, 10)}` : ""}
      </Text>

      {isDownloading && progress ? (
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: theme.surfaceSecondary }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.primary,
                  width: `${Math.round(percentage * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            {formatBytes(progress.totalBytesWritten)} / {formatBytes(progress.totalBytesExpectedToWrite)}
          </Text>
        </View>
      ) : null}

      {downloadState?.status === "error" ? (
        <Text style={[styles.calloutDetail, { color: theme.danger }]}>
          {downloadState.error}
        </Text>
      ) : null}

      <View style={styles.calloutActions}>
        {isDownloading ? (
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.surfaceSecondary }]}
            onPress={() => stopDownload(chartId, source.id)}
          >
            <Text style={[styles.actionText, { color: theme.textPrimary }]}>
              Cancel
            </Text>
          </Pressable>
        ) : source.downloaded ? (
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.danger + "20" }]}
            onPress={() => deleteDownload(chartId, source.id)}
          >
            <Text style={[styles.actionText, { color: theme.danger }]}>
              Delete
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={() => startDownload(chartId, source.id, source.url)}
          >
            <Text style={[styles.actionText, { color: "#fff" }]}>
              Download
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  calloutOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  callout: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  calloutTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  calloutDetail: {
    fontSize: 14,
  },
  progressContainer: {
    gap: 4,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
  },
  calloutActions: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
