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

let mooredTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

export const useNavigationState = create<State>()((set) => {
  LocationManager.addListener(updateLocation);

  return { state: NavigationState.Moored }
})

function scheduleMoored() {
  if (mooredTimeout) clearTimeout(mooredTimeout);

  mooredTimeout = setTimeout(() => {
    mooredTimeout = undefined;
    useNavigationState.setState({ state: NavigationState.Moored });
  }, MOORED_TIMEOUT);
}

export function updateLocation(location: GeolocationPosition) {
  // This should not happen, but does when first launching the app.
  if (!location) return;

  let state = NavigationState.Moored;
  const speed = location.coords?.speed ?? 0;

  if (speed > SPEED_THRESHOLD) {
    state = NavigationState.Underway;
  }

  useNavigationState.setState({ ...location, state });

  // Reset watchdog — if no further updates arrive within the timeout,
  // we'll fall back to moored (handles GPS loss / backgrounding).
  scheduleMoored();
}
