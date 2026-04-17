import {
  deleteTrack,
  getAllTracksWithStats,
  getTrack,
  getTrackPoints,
  renameTrack,
  type Track,
  type TrackPoint,
  type TracksOrder,
  type TrackWithStats,
} from "@/database";
import { formatDate, formatDuration } from "@/format";
import { useDbQuery } from "@/hooks/useDbQuery";
import { getPosition } from "@/navigation/hooks/useNavigation";
import { exportTrackAsGPX } from "@/tracks/export";
import { useCallback } from "react";

export { formatDate, formatDuration };

export function trackDisplayName(track: Track): string {
  return track.name || `Track ${track.id}`;
}

type UseTracksOptions = {
  order?: TracksOrder;
};

/**
 * Reactive list of all tracks (with derived stats), sorted in SQL by the
 * requested order. Re-runs automatically whenever the `tracks` table change.
 */
export function useTracks({
  order = "date",
}: UseTracksOptions = {}): TrackWithStats[] {
  const fetch = useCallback(
    () =>
      getAllTracksWithStats(order, order === "nearby" ? getPosition() : null),
    [order],
  );
  return useDbQuery(["tracks"], fetch) ?? [];
}

/** Reactive points for a track. Re-runs as new fixes arrive. */
export function useTrackPoints(id: number): TrackPoint[] {
  const fetch = useCallback(() => getTrackPoints(id), [id]);
  return useDbQuery(["track_points"], fetch) ?? [];
}

/** Reactive single-track query. Returns null until loaded or if missing. */
export function useTrack(id: number): Track | null {
  const fetch = useCallback(() => getTrack(id), [id]);
  return useDbQuery(["tracks"], fetch) ?? null;
}

export async function handleDelete(trackId: number) {
  await deleteTrack(trackId);
}

export async function handleRename(trackId: number, name: string) {
  if (name.trim()) {
    await renameTrack(trackId, name.trim());
  }
}

export function handleExport(trackId: number) {
  exportTrackAsGPX(trackId);
}
