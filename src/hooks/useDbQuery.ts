import { addDatabaseChangeListener } from "expo-sqlite";
import { useEffect, useState } from "react";

/**
 * Reactive query primitive backed by `expo-sqlite`'s `addDatabaseChangeListener`.
 *
 * `fetch` is run on mount and re-run whenever any of the listed `tables`
 * change. Bursts of row events (e.g. a save that rewrites 50 route_points)
 * are coalesced via a microtask so the query only fires once per write batch.
 *
 * Caveats:
 * - Fires for any change to the listed tables, not row-level.
 * - The `tables` array must include every table the query reads from.
 * - `fetch` should be stable across renders (e.g. via `useCallback`) or the
 *   effect will re-subscribe on every render.
 */
export function useDbQuery<T>(
  tables: string[],
  fetch: () => Promise<T>,
): T | undefined {
  const [data, setData] = useState<T>();

  useEffect(() => {
    let cancelled = false;
    let pending = false;

    const run = async () => {
      if (pending) return;
      pending = true;
      // microtask coalesce: collapse bursts of row events into one fetch
      await Promise.resolve();
      pending = false;
      const value = await fetch();
      if (!cancelled) setData(value);
    };

    run();

    const subscription = addDatabaseChangeListener((event) => {
      if (tables.includes(event.tableName)) run();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), fetch]);

  return data;
}
