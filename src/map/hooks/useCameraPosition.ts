import { persistProxy } from "@/persistProxy";
import type { LngLat } from "@maplibre/maplibre-react-native";
import { proxy, useSnapshot } from "valtio";

interface State {
  center?: LngLat;
  zoom?: number;
}

export const cameraPositionState = proxy<State>({
  center: undefined,
  zoom: undefined,
});

persistProxy(cameraPositionState, { name: "camera-position" });

export function useCameraPosition() {
  return useSnapshot(cameraPositionState);
}

export function saveViewport(center: LngLat, zoom: number) {
  Object.assign(cameraPositionState, { center, zoom });
}
