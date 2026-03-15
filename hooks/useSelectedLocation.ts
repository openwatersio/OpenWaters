import { create } from "zustand";

export type LngLat = [longitude: number, latitude: number];
export type Coordinates = { latitude: number; longitude: number };

type State = {
  coordinates: Coordinates | null;
  moving: boolean;
  features: GeoJSON.Feature[];
};

type Actions = {
  select: (point: LngLat, features?: GeoJSON.Feature[]) => void;
  updateCoordinates: (point: LngLat) => void;
  setMoving: (moving: boolean) => void;
  clear: () => void;
};

export const useSelectedLocation = create<State & Actions>()((set) => ({
  coordinates: null,
  moving: false,
  features: [],
  select: ([longitude, latitude], features = []) =>
    set({ coordinates: { latitude, longitude }, moving: false, features }),
  updateCoordinates: ([longitude, latitude]) =>
    set({ coordinates: { latitude, longitude } }),
  setMoving: (moving) => set({ moving }),
  clear: () => set({ coordinates: null, moving: false, features: [] }),
}));
