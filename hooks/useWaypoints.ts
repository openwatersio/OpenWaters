import {
  deleteWaypoint as dbDeleteWaypoint,
  getAllWaypoints,
  insertWaypoint,
  updateWaypoint as dbUpdateWaypoint,
  type Waypoint,
  type WaypointFields,
} from "@/lib/database";
import { create } from "zustand";

type State = {
  waypoints: Waypoint[];
  selectedWaypointId: number | null;
};

type Actions = {
  loadWaypoints: () => Promise<void>;
  addWaypoint: (fields: WaypointFields) => Promise<Waypoint>;
  updateWaypoint: (id: number, fields: Partial<Pick<Waypoint, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">>) => Promise<void>;
  deleteWaypoint: (id: number) => Promise<void>;
  setSelected: (id: number | null) => void;
};

export const useWaypoints = create<State & Actions>()((set) => ({
  waypoints: [],
  selectedWaypointId: null,

  loadWaypoints: async () => {
    const waypoints = await getAllWaypoints();
    set({ waypoints });
  },

  addWaypoint: async (fields) => {
    const waypoint = await insertWaypoint(fields);
    set((s) => ({ waypoints: [waypoint, ...s.waypoints] }));
    return waypoint;
  },

  updateWaypoint: async (id, fields) => {
    await dbUpdateWaypoint(id, fields);
    set((s) => ({
      waypoints: s.waypoints.map((w) => (w.id === id ? { ...w, ...fields } : w)),
    }));
  },

  deleteWaypoint: async (id) => {
    await dbDeleteWaypoint(id);
    set((s) => ({
      waypoints: s.waypoints.filter((w) => w.id !== id),
      selectedWaypointId: s.selectedWaypointId === id ? null : s.selectedWaypointId,
    }));
  },

  setSelected: (id) => set({ selectedWaypointId: id }),
}));
