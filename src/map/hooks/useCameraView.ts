import { expandBounds } from "@/geo";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { useEffect, useRef, useState } from "react";
import { proxy, useSnapshot } from "valtio";
import { subscribeKey } from "valtio/utils";

interface State {
  bearing: number;
  bounds: LngLatBounds | undefined;
  zoom: number;
}

export const cameraViewState = proxy<State>({
  bearing: 0,
  bounds: undefined,
  zoom: 0,
});

export function useCameraView() {
  return useSnapshot(cameraViewState);
}

export function onRegionIsChanging(bearing: number) {
  cameraViewState.bearing = bearing;
}

export function onRegionDidChange(
  bearing: number,
  bounds: LngLatBounds,
  zoom: number,
) {
  Object.assign(cameraViewState, { bearing, bounds, zoom });
}

/**
 * Returns true when `next` has NOT moved far enough from `baseline` to
 * warrant a new query — i.e. the viewport still fits within the outer
 * deadband and still covers the inner deadband.
 */
export function withinDeadband(
  baseline: LngLatBounds,
  next: LngLatBounds,
  threshold: number,
): boolean {
  const [oW, oS, oE, oN] = expandBounds(baseline, threshold);
  const [iW, iS, iE, iN] = expandBounds(baseline, -threshold);
  return (
    next[0] >= oW &&
    next[1] >= oS &&
    next[2] <= oE &&
    next[3] <= oN &&
    next[0] <= iW &&
    next[1] <= iS &&
    next[2] >= iE &&
    next[3] >= iN
  );
}

/**
 * Returns stable bounds for query use. Expands by `buffer` and only
 * re-commits when the viewport moves more than `hysteresis` × its own span.
 * Uses an imperative subscription so callers only re-render on a commit.
 */
export function useBounds({
  buffer = 0,
  hysteresis = 0,
}: { buffer?: number; hysteresis?: number } = {}): LngLatBounds | undefined {
  const baselineRef = useRef<LngLatBounds | undefined>(undefined);
  const [committed, setCommitted] = useState<LngLatBounds | undefined>(() => {
    const b = cameraViewState.bounds;
    if (!b) return undefined;
    baselineRef.current = b;
    return buffer > 0 ? expandBounds(b, buffer) : b;
  });

  useEffect(() => {
    return subscribeKey(
      cameraViewState,
      "bounds",
      (raw) => {
        const baseline = baselineRef.current;

        if (!raw) {
          baselineRef.current = undefined;
          setCommitted(undefined);
          return;
        }

        if (
          baseline &&
          hysteresis > 0 &&
          withinDeadband(baseline, raw, hysteresis)
        ) {
          return;
        }

        baselineRef.current = raw;
        setCommitted(buffer > 0 ? expandBounds(raw, buffer) : raw);
      },
      true,
    );
  }, [buffer, hysteresis]);

  return committed;
}
