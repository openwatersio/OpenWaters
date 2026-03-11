import { GeolocationPosition, LocationManager } from "@maplibre/maplibre-react-native";
import { create } from "zustand";

const SPEED_THRESHOLD = 0.25; // m/s = 0.5 knots
const MOORED_TIMEOUT = 5 * 1000; // 10 seconds

export enum NavigationState {
  Moored,
  Underway
}

interface State extends Partial<GeolocationPosition> {
  state: NavigationState;
}

interface Actions {
}

export const useNavigationState = create<State & Actions>()((set) => {
  let setMooredTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  function setMoored() {
    set({ state: NavigationState.Moored });
  }

  LocationManager.addListener((location) => {
    set(location);

    if (!location.coords?.speed || location.coords?.speed <= 0) {
      setMoored();
    } else if (location?.coords?.speed && location?.coords?.speed > SPEED_THRESHOLD) {
      set({ state: NavigationState.Underway });
      clearTimeout(setMooredTimeout);
      setMooredTimeout = setTimeout(setMoored, MOORED_TIMEOUT);
    }
  });

  return {
    state: NavigationState.Moored,
  }
})
