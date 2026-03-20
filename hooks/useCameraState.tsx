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

export const useCameraState = create<State>()(
  persist(
    (): State => ({
      followUserLocation: true,
      trackingMode: "default",
      lastCenter: undefined,
      lastZoom: undefined,
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
          } as State;
        }
        return state as unknown as State;
      },
    }
  )
)

export function setFollowUserLocation(follow: boolean) {
  if (follow) {
    useCameraState.setState((state) => ({
      followUserLocation: true,
      trackingMode: state.trackingMode ?? "default",
    }));
  } else {
    useCameraState.setState({ followUserLocation: false, trackingMode: undefined });
  }
}

export function cycleTrackingMode() {
  useCameraState.setState((state) => {
    if (state.followUserLocation && state.trackingMode === "default") {
      return { trackingMode: "course" as const };
    }
    return { followUserLocation: true, trackingMode: "default" as const };
  });
}

export function saveViewport(center: LngLat, zoom: number) {
  useCameraState.setState({ lastCenter: center, lastZoom: zoom });
}
