import type { CameraRef, LngLatBounds } from "@maplibre/maplibre-react-native";
import { create } from "zustand";

interface State {
  bearing: number;
  bounds: LngLatBounds | undefined;
  cameraRef: React.RefObject<CameraRef | null> | null;
  zoom: number;
}

interface Actions {
  setCameraRef(ref: React.RefObject<CameraRef | null>): void;
  onRegionIsChanging(bearing: number): void;
  onRegionDidChange(bearing: number, bounds: LngLatBounds, zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
  resetNorth(): void;
}

export const useCameraView = create<State & Actions>()((set, get) => ({
  bearing: 0,
  bounds: undefined,
  cameraRef: null,
  zoom: 0,
  setCameraRef(ref) {
    set({ cameraRef: ref });
  },
  onRegionIsChanging(bearing: number) {
    set({ bearing });
  },
  onRegionDidChange(bearing: number, bounds: LngLatBounds, zoom: number) {
    set({ bearing, bounds, zoom });
  },
  zoomIn() {
    const { cameraRef, zoom } = get();
    cameraRef?.current?.zoomTo(zoom + 1, { duration: 300 });
  },
  zoomOut() {
    const { cameraRef, zoom } = get();
    cameraRef?.current?.zoomTo(zoom - 1, { duration: 300 });
  },
  resetNorth() {
    const { cameraRef } = get();
    cameraRef?.current?.setStop({ bearing: 0, duration: 300 });
  },
}));
