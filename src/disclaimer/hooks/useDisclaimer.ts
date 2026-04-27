import { persistProxy } from "@/persistProxy";
import Constants from "expo-constants";
import { proxy, useSnapshot } from "valtio";

interface State {
  acknowledgedVersion: string | null;
  acknowledgedAt: number | null;
  hydrated: boolean;
}

const INITIAL_STATE: State = {
  acknowledgedVersion: null,
  acknowledgedAt: null,
  hydrated: false,
};

export const disclaimerState = proxy<State>({ ...INITIAL_STATE });

persistProxy<State, Pick<State, "acknowledgedVersion" | "acknowledgedAt">>(
  disclaimerState,
  {
    name: "disclaimer",
    partialize: (s) => ({
      acknowledgedVersion: s.acknowledgedVersion,
      acknowledgedAt: s.acknowledgedAt,
    }),
    hydrate: (state, persisted) => {
      if (persisted) {
        state.acknowledgedVersion = persisted.acknowledgedVersion ?? null;
        state.acknowledgedAt = persisted.acknowledgedAt ?? null;
      }
      state.hydrated = true;
    },
  },
);

export function useDisclaimer() {
  return useSnapshot(disclaimerState);
}

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

export function acknowledgeDisclaimer(): void {
  disclaimerState.acknowledgedVersion = getCurrentAppVersion();
  disclaimerState.acknowledgedAt = Date.now();
}

export function resetDisclaimer(): void {
  disclaimerState.acknowledgedVersion = null;
  disclaimerState.acknowledgedAt = null;
  disclaimerState.hydrated = false;
}

/**
 * True when the user must (re-)acknowledge the disclaimer. Re-prompts only on
 * a major-version bump; matching or higher minors/patches are accepted.
 */
export function needsAcknowledgment(
  currentVersion: string,
  acknowledgedVersion: string | null,
): boolean {
  if (!acknowledgedVersion) return true;
  const current = majorVersion(currentVersion);
  const acked = majorVersion(acknowledgedVersion);
  if (current == null || acked == null) return true;
  return current !== acked;
}

function majorVersion(v: string): number | null {
  const m = v.match(/^(\d+)\./);
  if (!m) return null;
  return Number.parseInt(m[1], 10);
}
