import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { create } from "zustand";

interface State {
  bearing: number;
  bounds: LngLatBounds | undefined;
  zoom: number;
}

export const useCameraView = create<State>()(() => ({
  bearing: 0,
  bounds: undefined,
  zoom: 0,
}));

export function onRegionIsChanging(bearing: number) {
  useCameraView.setState({ bearing });
}

export function onRegionDidChange(bearing: number, bounds: LngLatBounds, zoom: number) {
  useCameraView.setState({ bearing, bounds, zoom });
}
