import { useEffect, useState } from "react";

/**
 * Returns the elapsed milliseconds since `since`, ticking once per second
 * while active. Pass `null` to pause (returns 0). Accepts either a numeric
 * epoch ms or an ISO date string.
 *
 * The interval lives inside the hook, so views don't have to manage their
 * own timers and the underlying store stays free of clock state.
 */
export function useElapsedMs(since: number | string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since == null) return;
    // Resync immediately when the timer (re)starts; the interval below only
    // backfills after the first second.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  if (since == null) return 0;
  const start = typeof since === "string" ? new Date(since).getTime() : since;
  return Math.max(0, now - start);
}
