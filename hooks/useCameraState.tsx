import type { LngLat } from "@maplibre/maplibre-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface State {
  followUserLocation: boolean;
  trackingMode: undefined | "default" | "course";
  lastCenter?: LngLat;
  lastZoom?: number;
}

interface Actions {
  setFollowUserLocation: (follow: boolean) => void;
  cycleTrackingMode(): void;
  saveViewport(center: LngLat, zoom: number): void;
}

export const useCameraState = create<State & Actions>()(
  persist(
    (set) => ({
      followUserLocation: true,
      trackingMode: "default",
      lastCenter: undefined,
      lastZoom: undefined,
      setFollowUserLocation: (follow: boolean) => {
        if (follow) {
          set((state) => ({
            followUserLocation: true,
            trackingMode: state.trackingMode ?? "default",
          }));
        } else {
          set({ followUserLocation: false, trackingMode: undefined });
        }
      },
      cycleTrackingMode() {
        set((state) => {
          if (state.followUserLocation && state.trackingMode === "default") {
            return { trackingMode: "course" };
          }

          return { followUserLocation: true, trackingMode: "default" };
        })
      },
      saveViewport(center: LngLat, zoom: number) {
        set({ lastCenter: center, lastZoom: zoom });
      },
    }),
    {
      name: "camera",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate(persisted: unknown, version: number) {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          return {
            trackingMode: state.trackingMode,
            followUserLocation: state.followUserLocation ?? true,
            lastCenter: state.center,
            lastZoom: state.zoom,
          } as State & Actions;
        }
        return state as unknown as State & Actions;
      },
    }
  )
)
