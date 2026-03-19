import {
  deleteMarker as dbDeleteMarker,
  getAllMarkers,
  insertMarker,
  updateMarker as dbUpdateMarker,
  type Marker,
  type MarkerFields,
} from "@/lib/database";
import { create } from "zustand";

type State = {
  markers: Marker[];
  selectedMarkerId: number | null;
};

type Actions = {
  loadMarkers: () => Promise<void>;
  addMarker: (fields: MarkerFields) => Promise<Marker>;
  updateMarker: (id: number, fields: Partial<Pick<Marker, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">>) => Promise<void>;
  deleteMarker: (id: number) => Promise<void>;
  setSelected: (id: number | null) => void;
};

export const useMarkers = create<State & Actions>()((set) => ({
  markers: [],
  selectedMarkerId: null,

  loadMarkers: async () => {
    const markers = await getAllMarkers();
    set({ markers });
  },

  addMarker: async (fields) => {
    const marker = await insertMarker(fields);
    set((s) => ({ markers: [marker, ...s.markers] }));
    return marker;
  },

  updateMarker: async (id, fields) => {
    await dbUpdateMarker(id, fields);
    set((s) => ({
      markers: s.markers.map((m) => (m.id === id ? { ...m, ...fields } : m)),
    }));
  },

  deleteMarker: async (id) => {
    await dbDeleteMarker(id);
    set((s) => ({
      markers: s.markers.filter((m) => m.id !== id),
      selectedMarkerId: s.selectedMarkerId === id ? null : s.selectedMarkerId,
    }));
  },

  setSelected: (id) => set({ selectedMarkerId: id }),
}));
