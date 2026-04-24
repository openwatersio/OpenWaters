import { type TrackWithStats } from "@/database";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { createStyles } from "@/hooks/useStyles";
import {
  formatDate,
  formatDuration,
  handleDelete,
  handleExport,
  handleRename,
  trackDisplayName,
} from "@/tracks/hooks/useTracks";
import { router } from "expo-router";
import { memo } from "react";
import {
  ActionSheetIOS,
  Alert,
  PlatformColor,
  Pressable,
  Text,
  View,
} from "react-native";

/** Fixed so FlatList can virtualize via `getItemLayout`. Exported so the
 *  list can account for it without knowing the row's inner layout. */
export const ROW_HEIGHT = 76;

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

function showTrackActions(track: TrackWithStats) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: trackDisplayName(track),
      options: ["Rename", "Export GPX", "Delete", "Cancel"],
      destructiveButtonIndex: 2,
      cancelButtonIndex: 3,
    },
    (index) => {
      if (index === 0) promptRename(track);
      else if (index === 1) handleExport(track.id);
      else if (index === 2) confirmDelete(track);
    },
  );
}

type Props = {
  track: TrackWithStats;
};

const TrackListItem = memo(
  function TrackListItem({ track }: Props) {
    const styles = useStyles();
    const dist = toDistance(track.distance);
    const avgSpd = track.avg_speed != null ? toSpeed(track.avg_speed) : null;
    const maxSpd = track.max_speed != null ? toSpeed(track.max_speed) : null;

    return (
      <Pressable
        onPress={() => router.replace(`/feature/track/${track.id}`)}
        onLongPress={() => showTrackActions(track)}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: PlatformColor("systemFill") },
        ]}
      >
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>
            {trackDisplayName(track)}
          </Text>
          <Text style={styles.date}>{formatDate(track.started_at)}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatItem label="Distance" value={`${dist.value} ${dist.abbr}`} />
          <StatItem
            label="Duration"
            value={formatDuration(track.started_at, track.ended_at)}
          />
          <StatItem
            label="Average"
            value={avgSpd ? `${avgSpd.value} ${avgSpd.abbr}` : "—"}
          />
          <StatItem
            label="Max"
            value={maxSpd ? `${maxSpd.value} ${maxSpd.abbr}` : "—"}
          />
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.track.id === next.track.id &&
    prev.track.name === next.track.name &&
    prev.track.started_at === next.track.started_at &&
    prev.track.ended_at === next.track.ended_at &&
    prev.track.distance === next.track.distance &&
    prev.track.avg_speed === next.track.avg_speed &&
    prev.track.max_speed === next.track.max_speed,
);

export default TrackListItem;

function StatItem({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    color: theme.label,
  },
  date: { fontSize: 14, color: theme.labelSecondary },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stat: { flexDirection: "column" },
  statLabel: { fontSize: 11, fontWeight: "600", color: theme.labelSecondary },
  statValue: {
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: theme.label,
  },
}));
