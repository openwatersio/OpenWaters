import {
  calculateDestinationProgress,
  calculateWaypointProgress,
  MIN_VMG_FOR_ETA,
  type DestinationProgress,
  type WaypointProgress,
} from "@/geo";
import { navigationState } from "@/navigation/hooks/useNavigation";
import { activeRouteState } from "@/routes/hooks/useRoutes";
import { proxy, subscribe, useSnapshot } from "valtio";

/** EMA time-constant scales with distance to the active waypoint: short tau
 *  near the mark (racing finish — every tick matters), long tau on passage
 *  (don't care if ETA is 1:33 or 1:37). Log-interpolated between anchors. */
const NEAR_DISTANCE_M = 1852; // 1 nm
const NEAR_TAU_SECONDS = 5;
const FAR_DISTANCE_M = 100 * 1852; // 100 nm
const FAR_TAU_SECONDS = 300;

function tauForDistance(distance: number): number {
  if (distance <= NEAR_DISTANCE_M) return NEAR_TAU_SECONDS;
  if (distance >= FAR_DISTANCE_M) return FAR_TAU_SECONDS;
  const t =
    Math.log(distance / NEAR_DISTANCE_M) /
    Math.log(FAR_DISTANCE_M / NEAR_DISTANCE_M);
  return NEAR_TAU_SECONDS + t * (FAR_TAU_SECONDS - NEAR_TAU_SECONDS);
}

type ProgressState = {
  waypoint: WaypointProgress | null;
  destination: DestinationProgress | null;
};

export const routeProgressState = proxy<ProgressState>({
  waypoint: null,
  destination: null,
});

type Smoothed = {
  vmg: number | null;
  legVmg: number | null;
  sog: number | null;
  activeIndex: number | null;
  lastTimestamp: number | null;
};

const smoothed: Smoothed = {
  vmg: null,
  legVmg: null,
  sog: null,
  activeIndex: null,
  lastTimestamp: null,
};

function resetSmoothing() {
  smoothed.vmg = null;
  smoothed.legVmg = null;
  smoothed.sog = null;
  smoothed.activeIndex = null;
  smoothed.lastTimestamp = null;
}

function ema(prev: number | null, sample: number, alpha: number): number {
  return prev === null ? sample : prev + alpha * (sample - prev);
}

function recompute() {
  const ar = activeRouteState;
  const nav = navigationState;

  if (!ar.isNavigating || nav.latitude === null || nav.longitude === null) {
    routeProgressState.waypoint = null;
    routeProgressState.destination = null;
    resetSmoothing();
    return;
  }

  const idx = ar.activeIndex ?? 0;
  const target = ar.points[idx];
  if (!target) {
    routeProgressState.waypoint = null;
    routeProgressState.destination = null;
    return;
  }
  const previous = idx > 0 ? (ar.points[idx - 1] ?? null) : null;
  const position = { latitude: nav.latitude, longitude: nav.longitude };
  const rawSog = nav.speed ?? 0;
  const rawHeading = nav.heading ?? 0;

  const raw = calculateWaypointProgress(
    position,
    rawSog,
    rawHeading,
    target,
    previous,
  );

  // Reset on leg change — legVmg projection axis is leg-specific, so carrying
  // it across is wrong. vmg/sog get reset too for consistency.
  if (smoothed.activeIndex !== idx) {
    smoothed.activeIndex = idx;
    smoothed.vmg = null;
    smoothed.legVmg = null;
    smoothed.sog = null;
    smoothed.lastTimestamp = null;
  }

  // Time-constant EMA: alpha = 1 - exp(-dt / TAU). Gives identical behavior
  // regardless of GPS cadence (device 1 Hz vs Signal K up to 5 Hz).
  const ts = nav.timestamp;
  const dt =
    ts !== null && smoothed.lastTimestamp !== null
      ? Math.max(0, (ts - smoothed.lastTimestamp) / 1000)
      : null;
  const tau = tauForDistance(raw.distance);
  const alpha = dt === null ? 1 : 1 - Math.exp(-dt / tau);

  smoothed.vmg = ema(smoothed.vmg, raw.vmg, alpha);
  if (raw.legVmg !== null) {
    smoothed.legVmg = ema(smoothed.legVmg, raw.legVmg, alpha);
  }
  smoothed.sog = ema(smoothed.sog, rawSog, alpha);
  smoothed.lastTimestamp = ts;

  const effectiveVmg = previous ? smoothed.legVmg : smoothed.vmg;
  const eta =
    effectiveVmg !== null && effectiveVmg > MIN_VMG_FOR_ETA
      ? raw.distance / effectiveVmg
      : null;

  const waypoint: WaypointProgress = {
    distance: raw.distance,
    bearing: raw.bearing,
    vmg: smoothed.vmg ?? raw.vmg,
    legVmg: smoothed.legVmg,
    eta,
    progress: raw.progress,
  };

  const destination = calculateDestinationProgress(
    waypoint,
    ar.points,
    idx,
    smoothed.sog ?? rawSog,
  );

  Object.assign(routeProgressState, { waypoint, destination });
}

subscribe(navigationState, recompute);
subscribe(activeRouteState, recompute);
recompute();

export function useRouteProgress() {
  return useSnapshot(routeProgressState);
}
