import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type State = {
  activeRouteId: number | null;
  activePointIndex: number;
};

export const useRouteNavigation = create<State>()(
  persist(
    () => ({
      activeRouteId: null as number | null,
      activePointIndex: 0,
    }),
    {
      name: "route-navigation",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function startNavigation(routeId: number, startIndex = 0) {
  useRouteNavigation.setState({
    activeRouteId: routeId,
    activePointIndex: startIndex,
  });
}

export function advanceToNext() {
  useRouteNavigation.setState((s) => ({
    activePointIndex: s.activePointIndex + 1,
  }));
}

export function goToPrevious() {
  useRouteNavigation.setState((s) => ({
    activePointIndex: Math.max(0, s.activePointIndex - 1),
  }));
}

export function stopNavigation() {
  useRouteNavigation.setState({
    activeRouteId: null,
    activePointIndex: 0,
  });
}
