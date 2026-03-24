import SheetHeader from "@/components/ui/SheetHeader";
import Stat from "@/components/ui/Stat";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { handleDelete, handleRename, trackDisplayName } from "@/hooks/useTracks";
import { getTrack, getTrackPoints, TrackPoint, type Track } from "@/lib/database";
import { exportTrackAsGPX } from "@/lib/export";
import { formatDate, formatElapsedTime, formatTime } from "@/lib/format";
import type { ChartDataPoint } from "@expo/ui/swift-ui";
import {
  Button,
  Chart,
  Form,
  Host,
  HStack,
  ScrollView,
  Section,
  VStack
} from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  cornerRadius,
  frame,
  labelStyle,
  offset,
  padding,
  tint
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

export default function TrackDetail({ id }: { id: string }) {
  const trackId = Number(id);
  const theme = useTheme();

  const [track, setTrack] = useState<Track | null>(null);
  const [points, setPoints] = useState<TrackPoint[]>([]);

  // Load track data from DB
  useEffect(() => {
    getTrack(trackId).then(setTrack);
    getTrackPoints(trackId).then(setPoints);
  }, [trackId]);

  const handleExport = useCallback(() => {
    exportTrackAsGPX(trackId);
  }, [trackId]);

  const promptRename = useCallback(() => {
    Alert.prompt(
      "Rename Track",
      undefined,
      (name: string) => {
        handleRename(trackId, name);
        setTrack((t) => t ? { ...t, name } : t);
      },
      "plain-text",
      track?.name || "",
    );
  }, [trackId, track?.name]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete Track",
      `Delete "${track?.name ?? `Track ${trackId}`}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            handleDelete(trackId);
            router.dismiss();
          },
        },
      ],
    );
  }, [trackId, track?.name]);

  const dist = toDistance(track?.distance ?? 0);

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (points.length < 2) return [];
    return points.filter(p => p.speed !== null).map((s, i) => ({ x: i, y: s.speed as number }));
  }, [points]);

  const { avgSpeed, maxSpeed } = useMemo(() => {
    if (points.length < 2) return { avgSpeed: toSpeed(0), maxSpeed: toSpeed(0) };
    const speeds = points.map((s) => s.speed).filter(Boolean) as number[];
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const max = Math.max(...speeds);
    return { avgSpeed: toSpeed(avg), maxSpeed: toSpeed(max) };
  }, [points]);

  return (
    <>
      <SheetHeader
        title={track ? trackDisplayName(track) : ""}
        subtitle={track?.started_at ? formatDate(track.started_at) : undefined}
        headerLeft={() => (
          <Host matchContents>
            <Button
              onPress={handleExport}
              systemImage="square.and.arrow.up"
              modifiers={[
                labelStyle("iconOnly"),
                buttonStyle("borderless"),
                tint("primary"),
                offset({ y: -3 }),
              ]}
              label="Export GPX"
            />
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <ScrollView showsIndicators={false}>
          <VStack spacing={12} modifiers={[padding({ horizontal: 20, top: 16 })]}>
            <HStack spacing={12}>
              <Stat label="Started" value={formatTime(track?.started_at ?? null)} />
              <Stat label="Ended" value={formatTime(track?.ended_at ?? null)} />
            </HStack>

            <HStack spacing={12}>
              <Stat label="Duration" value={formatElapsedTime(track?.started_at ?? null, track?.ended_at ?? null)} />
              <Stat label="Distance" value={dist.value} unit={dist.abbr} />
            </HStack>

            <HStack spacing={12}>
              <Stat label="Avg Speed" value={avgSpeed.value} unit={avgSpeed.abbr} />
              <Stat label="Max Speed" value={maxSpeed.value} unit={maxSpeed.abbr} />
            </HStack>

            {chartData.length > 0 && (
              <Chart
                data={chartData}
                type="area"
                showGrid={false}
                areaStyle={{ color: theme.primary + "50" }}
                lineStyle={{ color: theme.primary, width: 1.5 }}
                modifiers={[
                  padding({ top: 10 }),
                  frame({ height: 70 }),
                  background(theme.surfaceElevated),
                  cornerRadius(12),
                ]}
              />
            )}
          </VStack>

          <Form modifiers={[frame({ height: 150 })]}>
            <Section>
              <Button
                label="Rename"
                systemImage="pencil"
                onPress={promptRename}
              />
              <Button
                label="Delete Track"
                systemImage="trash"
                role="destructive"
                onPress={confirmDelete}
              />
            </Section>
          </Form>
        </ScrollView>
      </Host>
    </>
  );
}
