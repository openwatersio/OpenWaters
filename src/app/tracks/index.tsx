import SheetView from "@/components/ui/SheetView";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import {
  formatDate,
  formatDuration,
  handleDelete,
  handleExport,
  handleRename,
  trackDisplayName,
  useLoadTracks,
  useTracks,
} from "@/hooks/useTracks";
import { getTrackDistances, type TrackWithStats } from "@/lib/database";
import {
  Button,
  ContextMenu,
  Host,
  HStack,
  List,
  Spacer,
  Text,
  VStack
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  lineLimit,
  listStyle,
  monospacedDigit,
  onTapGesture,
  padding
} from "@expo/ui/swift-ui/modifiers";
import * as Location from "expo-location";
import { router, Stack, StackToolbarMenuActionProps } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

type SortBy = "date" | "distance" | "duration" | "speed" | "nearby";

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <VStack alignment="leading" spacing={2}>
      <Text
        modifiers={[
          font({ size: 11, weight: "semibold" }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
        ]}
      >
        {label}
      </Text>
      <Text modifiers={[font({ size: 15, weight: "semibold" }), monospacedDigit()]}>
        {value}
      </Text>
    </VStack>
  );
}

export default function TrackList() {
  const tracks = useTracks((s) => s.tracks);
  useLoadTracks();
  const activeTrack = useTrackRecording((s) => s.track);
  const theme = useTheme();
  const [sort, setSort] = useState<SortBy>("date");
  const [proximityMap, setProximityMap] = useState<Map<number, number> | null>(null);

  const sortOptions: { label: string, value: SortBy, icon: StackToolbarMenuActionProps["icon"] }[] = [
    { label: "Recent", value: "date", icon: "clock" },
    { label: "Distance", value: "distance", icon: "lines.measurement.vertical" },
    { label: "Duration", value: "duration", icon: "stopwatch" },
    { label: "Speed", value: "speed", icon: "hare" },
    { label: "Nearby", value: "nearby", icon: "location" },
  ]

  useEffect(() => {
    if (sort !== "nearby") return;
    Location.getLastKnownPositionAsync().then((pos) => {
      if (!pos) return;
      getTrackDistances(pos.coords.latitude, pos.coords.longitude).then(setProximityMap);
    });
  }, [sort]);

  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => {
      switch (sort) {
        case "distance":
          return b.distance - a.distance;
        case "duration": {
          const durA = a.ended_at
            ? new Date(a.ended_at).getTime() - new Date(a.started_at).getTime()
            : Date.now() - new Date(a.started_at).getTime();
          const durB = b.ended_at
            ? new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()
            : Date.now() - new Date(b.started_at).getTime();
          return durB - durA;
        }
        case "speed":
          return (b.avg_speed ?? 0) - (a.avg_speed ?? 0);
        case "nearby": {
          const distA = proximityMap?.get(a.id) ?? Infinity;
          const distB = proximityMap?.get(b.id) ?? Infinity;
          return distA - distB;
        }
        default:
          return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
      }
    });
  }, [tracks, sort, proximityMap]);

  function confirmDelete(track: TrackWithStats) {
    Alert.alert(
      "Delete Track",
      `Delete "${trackDisplayName(track)}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDelete(track.id) },
      ],
    );
  }

  function promptRename(track: TrackWithStats) {
    Alert.prompt(
      "Rename Track",
      undefined,
      (name: string) => handleRename(track.id, name),
      "plain-text",
      track.name || "",
    );
  }

  return (
    <SheetView id="tracks">
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
          {sortOptions.map(({ label, value, icon }) => (
            <Stack.Toolbar.MenuAction
              key={value}
              icon={icon}
              isOn={sort === value}
              onPress={() => setSort(value)}
            >
              {label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="xmark"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <List modifiers={[listStyle("plain")]}>
          <List.ForEach>
            {sortedTracks.map((track) => {
              const isActiveRecording = activeTrack?.id === track.id;
              const dist = toDistance(track.distance);
              const avgSpd = track.avg_speed != null ? toSpeed(track.avg_speed) : null;
              const maxSpd = track.max_speed != null ? toSpeed(track.max_speed) : null;

              return (
                <ContextMenu key={track.id}>
                  <ContextMenu.Trigger>
                    <VStack
                      alignment="leading"
                      spacing={6}
                      modifiers={[
                        onTapGesture(() => {
                          if (isActiveRecording) {
                            router.dismissTo("/activity");
                          } else {
                            router.replace(`/feature/track/${track.id}`);
                          }
                        }),
                        padding({ vertical: 4 }),
                      ]}
                    >
                      <HStack spacing={6}>
                        <HStack spacing={6}>
                          <Text modifiers={[font({ size: 16, weight: "semibold" }), lineLimit(1)]}>
                            {trackDisplayName(track)}
                          </Text>
                          {isActiveRecording && (
                            <Text modifiers={[foregroundStyle(theme.danger), font({ size: 12 })]}>
                              ⏺
                            </Text>
                          )}
                        </HStack>

                        <Spacer />

                        <Text
                          modifiers={[
                            font({ size: 14 })
                          ]}
                        >
                          {formatDate(track.started_at)}
                        </Text>
                      </HStack>

                      <HStack spacing={0} modifiers={[padding({ top: 4 })]}>
                        <StatItem
                          label="DISTANCE"
                          value={`${dist.value} ${dist.abbr}`}
                        />
                        <Spacer />
                        <StatItem
                          label="DURATION"
                          value={formatDuration(track.started_at, track.ended_at)}
                        />
                        <Spacer />
                        <StatItem
                          label="AVG SPEED"
                          value={avgSpd ? `${avgSpd.value} ${avgSpd.abbr}` : "—"}
                        />
                        <Spacer />
                        <StatItem
                          label="MAX SPEED"
                          value={maxSpd ? `${maxSpd.value} ${maxSpd.abbr}` : "—"}
                        />
                      </HStack>
                    </VStack>
                  </ContextMenu.Trigger>

                  <ContextMenu.Items>
                    <Button
                      label="Rename"
                      systemImage="pencil"
                      onPress={() => promptRename(track)}
                    />
                    <Button
                      label="Export GPX"
                      systemImage="square.and.arrow.up"
                      onPress={() => handleExport(track.id)}
                    />
                    <Button
                      label="Delete"
                      systemImage="trash"
                      role="destructive"
                      onPress={() => confirmDelete(track)}
                    />
                  </ContextMenu.Items>
                </ContextMenu>
              );
            })}
          </List.ForEach>
        </List>
      </Host>
    </SheetView>
  );
}
