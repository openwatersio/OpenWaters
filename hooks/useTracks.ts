import {
  deleteTrack,
  getAllTracksWithStats,
  renameTrack,
  type Track,
  type TrackWithStats,
} from "@/lib/database";
import { exportTrackAsGPX } from "@/lib/exportTrack";
import { formatDate, formatDuration } from "@/lib/format";
import { useEffect } from "react";
import { create } from "zustand";

export { formatDate, formatDuration };

export function trackDisplayName(track: Track): string {
  return track.name || `Track ${track.id}`;
}

interface TracksState {
  tracks: TrackWithStats[];
  selectedId: number | null;
  loadTracks: () => Promise<void>;
  handleDelete: (trackId: number) => Promise<void>;
  handleRename: (trackId: number, name: string) => Promise<void>;
  handleExport: (trackId: number) => void;
  selectTrack: (trackId: number) => void;
  clearSelectedTrack: () => void;
}

export const useTracks = create<TracksState>((set, get) => ({
  tracks: [],
  selectedId: null,

  loadTracks: async () => {
    const result = await getAllTracksWithStats();
    set({ tracks: result });
  },

  handleDelete: async (trackId: number) => {
    await deleteTrack(trackId);
    set((s) => ({
      selectedId: s.selectedId === trackId ? null : s.selectedId,
    }));
    await get().loadTracks();
  },

  handleRename: async (trackId: number, name: string) => {
    if (name.trim()) {
      await renameTrack(trackId, name.trim());
      await get().loadTracks();
    }
  },

  handleExport: (trackId: number) => {
    exportTrackAsGPX(trackId);
  },

  selectTrack: (trackId: number) => {
    set({ selectedId: trackId });
  },

  clearSelectedTrack: () => {
    set({ selectedId: null });
  },
}));

/** Hook to load tracks on mount */
export function useLoadTracks() {
  const loadTracks = useTracks((s) => s.loadTracks);
  useEffect(() => {
    loadTracks();
  }, [loadTracks]);
}
