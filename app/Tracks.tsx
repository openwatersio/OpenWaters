import {
  formatDate,
  formatDistance,
  formatDuration,
  trackDisplayName,
  useLoadTracks,
  useTracks,
} from "@/hooks/useTracks";
import type { Track } from "@/lib/database";
import { router } from "expo-router";
import { useRef } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { GestureHandlerRootView } from "react-native-gesture-handler";

function SwipeActions({
  onMore,
  onDelete,
}: {
  onMore: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.swipeActions}>
      <TouchableOpacity style={styles.moreAction} onPress={onMore}>
        <Text style={styles.swipeActionText}>...</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAction} onPress={onDelete}>
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TrackList() {
  const { tracks, selectedId, handleDelete, handleRename, handleExport, selectTrack } =
    useTracks();
  useLoadTracks();

  function confirmDelete(track: Track, swipeableRef?: SwipeableMethods | null) {
    Alert.alert(
      "Delete Track",
      `Delete "${trackDisplayName(track)}"?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => swipeableRef?.close() },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(track.id),
        },
      ],
    );
  }

  function promptRename(track: Track) {
    Alert.prompt(
      "Rename Track",
      undefined,
      (name: string) => handleRename(track.id, name),
      "plain-text",
      track.name || "",
    );
  }

  function showActionMenu(track: Track, swipeableRef?: SwipeableMethods | null) {
    Alert.alert(trackDisplayName(track), undefined, [
      { text: "Rename", onPress: () => { swipeableRef?.close(); promptRename(track); } },
      { text: "Export GPX", onPress: () => { swipeableRef?.close(); handleExport(track.id); } },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => confirmDelete(track, swipeableRef),
      },
      { text: "Cancel", style: "cancel", onPress: () => swipeableRef?.close() },
    ]);
  }

  function TrackRow({ item }: { item: Track }) {
    const isSelected = selectedId === item.id;
    const swipeableRef = useRef<SwipeableMethods | null>(null);

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={() => (
          <SwipeActions
            onMore={() => showActionMenu(item, swipeableRef.current)}
            onDelete={() => confirmDelete(item, swipeableRef.current)}
          />
        )}
        overshootRight={false}
      >
        <TouchableOpacity
          style={[styles.row, isSelected && styles.rowSelected]}
          onPress={() => { selectTrack(item.id); router.dismiss(); }}
          onLongPress={() => showActionMenu(item)}
        >
          <View style={styles.rowContent}>
            <Text style={styles.trackName}>
              {trackDisplayName(item)}
            </Text>
            <Text style={styles.trackDetails}>
              {formatDistance(item.distance)}
              {"  ·  "}
              {formatDuration(item.started_at, item.ended_at)}
            </Text>
          </View>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
      </Swipeable>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <TrackRow item={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No tracks recorded yet. Tap the record button on the chart to start.
          </Text>
        }
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  rowSelected: {
    backgroundColor: "#f0f7ff",
  },
  rowContent: {
    flex: 1,
  },
  trackName: {
    fontSize: 16,
    color: "#000",
  },
  trackDetails: {
    fontSize: 13,
    color: "#6b6b6b",
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
    marginLeft: 12,
  },
  swipeActions: {
    flexDirection: "row",
  },
  moreAction: {
    backgroundColor: "#8e8e93",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
  },
  deleteAction: {
    backgroundColor: "#e53e3e",
    justifyContent: "center",
    alignItems: "center",
    width: 70,
  },
  swipeActionText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  empty: {
    fontSize: 15,
    color: "#6b6b6b",
    textAlign: "center",
    padding: 32,
  },
});
