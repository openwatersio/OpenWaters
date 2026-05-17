import { persistProxy } from "@/persistProxy";
import { proxy, useSnapshot } from "valtio";

export type AISStreamStatus = "disconnected" | "connecting" | "connected";

interface State {
  /** User-facing toggle. Defaults on; users can opt out from the Connections sheet. */
  enabled: boolean;
  status: AISStreamStatus;
  error: string | undefined;
}

export const aisStreamState = proxy<State>({
  enabled: true,
  status: "disconnected",
  error: undefined,
});

persistProxy<State, Pick<State, "enabled">>(aisStreamState, {
  name: "aisstream",
  partialize: (s) => ({ enabled: s.enabled }),
});

export function useAISStream() {
  return useSnapshot(aisStreamState);
}

export function setAISStreamEnabled(enabled: boolean) {
  aisStreamState.enabled = enabled;
}

export function setAISStreamStatus(
  status: AISStreamStatus,
  error?: string,
) {
  aisStreamState.status = status;
  aisStreamState.error = error;
}
