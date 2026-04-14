import {
  deleteTrack,
  getAllTracksWithStats,
  renameTrack,
  type Track,
  type TrackWithStats,
} from "@/lib/database";
import { exportTrackAsGPX } from "@/lib/export";
import { formatDate, formatDuration } from "@/lib/format";
import { useEffect } from "react";
import { create } from "zustand";

export { formatDate, formatDuration };

export function trackDisplayName(track: Track): string {
  return track.name || `Track ${track.id}`;
}

interface TracksState {
  tracks: TrackWithStats[];
}

export const useTracks = create<TracksState>(() => ({
  tracks: [],
}));

export async function loadTracks() {
  const result = await getAllTracksWithStats();
  useTracks.setState({ tracks: result });
}

export async function handleDelete(trackId: number) {
  await deleteTrack(trackId);
  await loadTracks();
}

export async function handleRename(trackId: number, name: string) {
  if (name.trim()) {
    await renameTrack(trackId, name.trim());
    await loadTracks();
  }
}

export function handleExport(trackId: number) {
  exportTrackAsGPX(trackId);
}

/** Hook to load tracks on mount */
export function useLoadTracks() {
  useEffect(() => {
    loadTracks();
  }, []);
}
