import { GeolocationPosition, LocationManager } from "@maplibre/maplibre-react-native";
import { create } from "zustand";

const SPEED_THRESHOLD = 0.25; // m/s ≈ 0.5 knots
const MOORED_TIMEOUT = 5_000; // 5 seconds without speed before marking moored

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
  let mooredTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

  function scheduleMoored() {
    clearTimeout(mooredTimeout);
    mooredTimeout = setTimeout(() => {
      mooredTimeout = undefined;
      set({ state: NavigationState.Moored });
    }, MOORED_TIMEOUT);
  }

  // If no location updates ever arrive, we stay moored (the initial state).
  // Once updates start, we reset the timeout on every update so that if
  // updates stop (GPS lost, app backgrounded), we fall back to moored.
  LocationManager.addListener((location) => {
    set(location);

    const speed = location.coords?.speed ?? 0;

    if (speed > SPEED_THRESHOLD) {
      clearTimeout(mooredTimeout);
      mooredTimeout = undefined;
      set({ state: NavigationState.Underway });
    } else {
      set({ state: NavigationState.Moored });
    }

    // Reset watchdog — if no further updates arrive within the timeout,
    // we'll fall back to moored (handles GPS loss / backgrounding).
    scheduleMoored();
  });

  return {
    state: NavigationState.Moored,
  }
})
