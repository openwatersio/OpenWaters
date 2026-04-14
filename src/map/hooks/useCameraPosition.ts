import type { LngLat } from "@maplibre/maplibre-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface State {
  center?: LngLat;
  zoom?: number;
}

export const useCameraPosition = create<State>()(
  persist(
    (): State => ({
      center: undefined,
      zoom: undefined,
    }),
    {
      name: "camera-position",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function saveViewport(center: LngLat, zoom: number) {
  useCameraPosition.setState({ center, zoom });
}
