import type { CameraRef, LngLatBounds } from "@maplibre/maplibre-react-native";
import { create } from "zustand";

interface State {
  bearing: number;
  bounds: LngLatBounds | undefined;
  cameraRef: React.RefObject<CameraRef | null> | null;
  zoom: number;
}

export const useCameraView = create<State>()(() => ({
  bearing: 0,
  bounds: undefined,
  cameraRef: null,
  zoom: 0,
}));

export function setCameraRef(ref: React.RefObject<CameraRef | null>) {
  useCameraView.setState({ cameraRef: ref });
}

export function onRegionIsChanging(bearing: number) {
  useCameraView.setState({ bearing });
}

export function onRegionDidChange(bearing: number, bounds: LngLatBounds, zoom: number) {
  useCameraView.setState({ bearing, bounds, zoom });
}

export function zoomIn() {
  const { cameraRef, zoom } = useCameraView.getState();
  cameraRef?.current?.zoomTo(zoom + 1, { duration: 300 });
}

export function zoomOut() {
  const { cameraRef, zoom } = useCameraView.getState();
  cameraRef?.current?.zoomTo(zoom - 1, { duration: 300 });
}

export function resetNorth() {
  const { cameraRef } = useCameraView.getState();
  cameraRef?.current?.setStop({ bearing: 0, duration: 300 });
}
