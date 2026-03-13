import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { create } from "zustand";

interface State {
  bearing: number;
  bounds: LngLatBounds | undefined;
  zoom: number;
}

interface Actions {
  onRegionIsChanging(bearing: number): void;
  onRegionDidChange(bearing: number, bounds: LngLatBounds, zoom: number): void;
}

export const useMapView = create<State & Actions>()((set) => ({
  bearing: 0,
  bounds: undefined,
  zoom: 0,
  onRegionIsChanging(bearing: number) {
    set({ bearing });
  },
  onRegionDidChange(bearing: number, bounds: LngLatBounds, zoom: number) {
    set({ bearing, bounds, zoom });
  },
}));
