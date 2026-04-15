import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { proxy, useSnapshot } from "valtio";

interface State {
  bearing: number;
  bounds: LngLatBounds | undefined;
  zoom: number;
}

export const cameraViewState = proxy<State>({
  bearing: 0,
  bounds: undefined,
  zoom: 0,
});

export function useCameraView() {
  return useSnapshot(cameraViewState);
}

export function onRegionIsChanging(bearing: number) {
  cameraViewState.bearing = bearing;
}

export function onRegionDidChange(
  bearing: number,
  bounds: LngLatBounds,
  zoom: number,
) {
  Object.assign(cameraViewState, { bearing, bounds, zoom });
}
