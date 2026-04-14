import { getInstrumentData } from "@/hooks/useInstruments";
import type { GeolocationPosition } from "@maplibre/maplibre-react-native";
import { LocationManager } from "@maplibre/maplibre-react-native";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";

export enum NavigationState {
  Moored,
  Underway,
}

export type NavigationSource = "device" | "signalk";

interface State {
  latitude: number | null;
  longitude: number | null;
  speed: number | null; // m/s (SOG)
  course: number | null; // radians (COG true)
  heading: number | null; // degrees (for puck rotation)
  accuracy: number | null; // meters
  timestamp: number | null;
  source: NavigationSource;
  state: NavigationState;
}

export const useNavigation = create<State>()(() => ({
  latitude: null,
  longitude: null,
  speed: null,
  course: null,
  heading: null,
  accuracy: null,
  timestamp: null,
  source: "device" as NavigationSource,
  state: NavigationState.Moored,
}));

// --- Shadow objects (module-scoped, not in the store) ---

type NavValues = {
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  course: number | null;
  heading: number | null; // degrees
  accuracy: number | null;
  timestamp: number;
};

const EMPTY: NavValues = {
  latitude: null,
  longitude: null,
  speed: null,
  course: null,
  heading: null,
  accuracy: null,
  timestamp: 0,
};

let _device: NavValues = { ...EMPTY };
let _signalk: NavValues = { ...EMPTY };

// --- Source priority ---

const STALE_MS = 10_000;

function isFresh(values: NavValues): boolean {
  return values.latitude !== null && Date.now() - values.timestamp < STALE_MS;
}

function resolve() {
  const useSignalK = isFresh(_signalk);
  const src = useSignalK ? _signalk : _device;

  if (src.latitude === null) return; // No data from either source yet

  // Per-field fallback: use Signal K if available, else device
  const pick = <K extends keyof NavValues>(field: K): NavValues[K] =>
    useSignalK && _signalk[field] !== null ? _signalk[field] : _device[field];

  const speed = pick("speed");

  const resolvedState =
    ((speed as number | null) ?? 0) > SPEED_THRESHOLD
      ? NavigationState.Underway
      : NavigationState.Moored;

  scheduleMoored(resolvedState);

  useNavigation.setState({
    latitude: src.latitude,
    longitude: src.longitude,
    speed,
    course: pick("course"),
    heading: pick("heading"),
    accuracy: pick("accuracy"),
    timestamp: src.timestamp,
    source: useSignalK ? "signalk" : "device",
    state: resolvedState,
  });
}

// --- Moored/underway timeout ---

const SPEED_THRESHOLD = 0.25; // m/s ≈ 0.5 knots
const MOORED_TIMEOUT = 5_000;

let mooredTimeout: ReturnType<typeof setTimeout> | undefined;

function scheduleMoored(currentState: NavigationState) {
  clearTimeout(mooredTimeout);
  if (currentState === NavigationState.Underway) {
    mooredTimeout = setTimeout(() => {
      mooredTimeout = undefined;
      useNavigation.setState({ state: NavigationState.Moored });
    }, MOORED_TIMEOUT);
  }
}

// --- Update functions ---

/** Called from LocationManager listener (device GPS) */
export function updateFromDevice(location: GeolocationPosition) {
  if (!location) return;
  const { coords } = location;
  _device = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed: coords.speed,
    // FIXME: why switch course to radians and not heading? Both should be store in the same unit
    course: coords.heading !== null ? (coords.heading * Math.PI) / 180 : null, // degrees → radians
    heading: coords.heading,
    accuracy: coords.accuracy,
    timestamp: location.timestamp,
  };
  resolve();
}

const NAV_THROTTLE = 200; // ms
let navThrottleTimer: ReturnType<typeof setTimeout> | null = null;
let navDirty = false;

/** Called after instrument data update to resolve navigation from instrument store */
export function updateFromSignalK() {
  navDirty = true;
  if (navThrottleTimer) return;
  navThrottleTimer = setTimeout(() => {
    navThrottleTimer = null;
    if (!navDirty) return;
    navDirty = false;
    resolveFromInstruments();
  }, NAV_THROTTLE);
}

/** Force-resolve navigation from instruments immediately (for tests) */
export function flushNavigation() {
  if (navThrottleTimer) {
    clearTimeout(navThrottleTimer);
    navThrottleTimer = null;
  }
  navDirty = false;
  resolveFromInstruments();
}

function resolveFromInstruments() {
  const data = getInstrumentData();

  const pos = data["navigation.position"];
  const sog = data["navigation.speedOverGround"];
  const cog = data["navigation.courseOverGroundTrue"];
  const hdg = data["navigation.headingTrue"];

  if (!pos || pos.value === null) return;
  const position = pos.value as { latitude: number; longitude: number };

  _signalk = {
    latitude: position.latitude,
    longitude: position.longitude,
    speed: typeof sog?.value === "number" ? sog.value : null,
    course: typeof cog?.value === "number" ? cog.value : null,
    heading:
      typeof hdg?.value === "number" ? (hdg.value * 180) / Math.PI : null, // radians → degrees
    accuracy: null, // Signal K doesn't provide GPS accuracy
    timestamp: pos.timestamp,
  };
  resolve();
}

// --- Convenience selectors ---

/** Select position as a geolib-compatible object, or null */
export function usePosition(): { latitude: number; longitude: number } | null {
  return useNavigation(
    useShallow((s) =>
      s.latitude !== null && s.longitude !== null
        ? { latitude: s.latitude, longitude: s.longitude }
        : null,
    ),
  );
}

// --- Wire device GPS listener at module scope ---

LocationManager.addListener((location) => {
  updateFromDevice(location);
});
