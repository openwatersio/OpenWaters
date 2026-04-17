import { type TracksOrder, type TrackWithStats } from "@/database";
import TrackListItem from "@/tracks/components/TrackListItem";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { useTracks } from "@/tracks/hooks/useTracks";
import RowSeparator from "@/ui/RowSeparator";
import { useMemo } from "react";
import { FlatList, type ListRenderItem } from "react-native";

const renderItem: ListRenderItem<TrackWithStats> = ({ item }) => (
  <TrackListItem track={item} />
);

type Props = {
  order: TracksOrder;
};

export default function TrackList({ order }: Props) {
  const { track: activeTrack } = useTrackRecording();
  const allTracks = useTracks({ order });
  const activeTrackId = activeTrack?.id ?? null;

  // Hide the live recording — it has its own screen at `/activity`. Stats on
  // the tracks row aren't meaningful until the track ends anyway.
  const tracks = useMemo(
    () =>
      activeTrackId == null
        ? allTracks
        : allTracks.filter((t) => t.id !== activeTrackId),
    [allTracks, activeTrackId],
  );

  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ItemSeparatorComponent={RowSeparator}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={8}
      // Tells UIScrollView to inset content past the nav bar automatically,
      // the same way SwiftUI List does by default. Without this the first
      // rows sit behind the translucent sheet header.
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}
