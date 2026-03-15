import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useSheetReporter } from "@/hooks/useSheetPosition";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import {
  formatDate,
  formatDuration,
  trackDisplayName,
  useLoadTracks,
  useTracks,
} from "@/hooks/useTracks";
import { getTrackDistances, type TrackWithStats } from "@/lib/database";
import useTheme from "@/hooks/useTheme";
import {
  Button,
  ContextMenu,
  HStack,
  Host,
  List,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  bold,
  font,
  foregroundStyle,
  labelsHidden,
  monospacedDigit,
  onTapGesture,
  padding,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, View } from "react-native";

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
  const { tracks, handleDelete, handleRename, handleExport } = useTracks();
  useLoadTracks();
  const { activeTrackId } = useTrackRecording();
  const { onLayout: onSheetLayout, ref } = useSheetReporter("tracks");
  const units = usePreferredUnits();
  const theme = useTheme();
  const [sort, setSort] = useState<SortBy>("date");
  const [proximityMap, setProximityMap] = useState<Map<number, number> | null>(null);

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
    <View ref={ref} onLayout={onSheetLayout} style={{ flex: 1 }}>
      <Host style={{ flex: 1 }}>
        <List>
          <Section>
            <Picker
              selection={sort}
              onSelectionChange={(s) => setSort(s as SortBy)}
              modifiers={[pickerStyle("segmented"), labelsHidden()]}
            >
              <Text modifiers={[tag("date")]}>Date</Text>
              <Text modifiers={[tag("distance")]}>Distance</Text>
              <Text modifiers={[tag("duration")]}>Duration</Text>
              <Text modifiers={[tag("speed")]}>Speed</Text>
              <Text modifiers={[tag("nearby")]}>Nearby</Text>
            </Picker>

            <List.ForEach
              onDelete={(indices) => {
                indices.forEach((i) => confirmDelete(sortedTracks[i]));
              }}
            >
              {sortedTracks.map((track) => {
                const isActiveRecording = activeTrackId === track.id;
                const dist = units.toDistance(track.distance);
                const avgSpd = track.avg_speed != null ? units.toSpeed(track.avg_speed) : null;
                const maxSpd = track.max_speed != null ? units.toSpeed(track.max_speed) : null;

                return (
                  <ContextMenu key={track.id}>
                    <ContextMenu.Trigger>
                      <VStack
                        alignment="leading"
                        spacing={6}
                        modifiers={[
                          onTapGesture(() => {
                            router.replace(`/track/${track.id}`);
                          }),
                          padding({ vertical: 4 }),
                        ]}
                      >
                        <HStack spacing={6}>
                          <Text modifiers={[bold(), font({ size: 17 })]}>
                            {trackDisplayName(track)}
                          </Text>
                          {isActiveRecording && (
                            <Text modifiers={[foregroundStyle(theme.danger), font({ size: 12 })]}>
                              ⏺
                            </Text>
                          )}
                        </HStack>

                        <Text
                          modifiers={[
                            font({ size: 14 }),
                            foregroundStyle({ type: "hierarchical", style: "secondary" }),
                          ]}
                        >
                          {formatDate(track.started_at)}
                        </Text>

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
          </Section>
        </List>
      </Host>
    </View>
  );
}
