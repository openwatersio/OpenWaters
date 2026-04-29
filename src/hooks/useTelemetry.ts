import { persistProxy } from "@/persistProxy";
import { proxy, useSnapshot } from "valtio";

interface State {
  enabled: boolean;
}

const INITIAL_STATE: State = {
  enabled: true,
};

export const telemetryState = proxy<State>({ ...INITIAL_STATE });

persistProxy(telemetryState, { name: "telemetry" });

export function useTelemetry() {
  return useSnapshot(telemetryState);
}

export function setTelemetryEnabled(enabled: boolean) {
  telemetryState.enabled = enabled;
}
