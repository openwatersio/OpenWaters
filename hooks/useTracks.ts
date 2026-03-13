import { getAllTracks, deleteTrack, renameTrack, type Track } from "@/lib/database";
import { exportTrackAsGPX } from "@/lib/exportTrack";
import { useEffect } from "react";
import { create } from "zustand";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDistance(meters: number): string {
  const nm = meters / 1852;
  if (nm < 0.01) return "< 0.01 nm";
  return `${nm.toFixed(2)} nm`;
}

export function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "In progress";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function trackDisplayName(track: Track): string {
  return track.name || formatDate(track.started_at);
}

interface TracksState {
  tracks: Track[];
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
    const result = await getAllTracks();
    set({ tracks: result });
  },

  handleDelete: async (trackId: number) => {
    await deleteTrack(trackId);
    set((s) => ({ selectedId: s.selectedId === trackId ? null : s.selectedId }));
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
