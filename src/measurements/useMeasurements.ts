import { persistProxy } from "@/persistProxy";
import { proxy, useSnapshot } from "valtio";

interface State {
  /** When true, draws adaptive range rings around the user's vessel. */
  rangeRings: boolean;
}

const INITIAL_STATE: State = {
  rangeRings: true,
};

export const measurementsState = proxy<State>({ ...INITIAL_STATE });

persistProxy(measurementsState, { name: "measurements" });

export function useMeasurements() {
  return useSnapshot(measurementsState);
}

export function setMeasurements(state: Partial<State>) {
  Object.assign(measurementsState, state);
}

/** Reset to defaults. Exposed for tests. */
export function resetMeasurements() {
  Object.assign(measurementsState, INITIAL_STATE);
}
