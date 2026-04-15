import AsyncStorage from "@react-native-async-storage/async-storage";
import { snapshot, subscribe } from "valtio";

export type PersistOptions<T extends object, S = T> = {
  /** AsyncStorage key. */
  name: string;
  /**
   * Map the live state into the value to persist. Return `null` to skip
   * writing (and clear any existing entry). Defaults to the full snapshot.
   */
  partialize?: (state: T) => S | null;
  /**
   * Apply a previously-persisted value to the live state. Defaults to
   * `Object.assign(state, persisted)`. Receives `null` if nothing was
   * persisted, so callers can run post-hydration setup either way.
   */
  hydrate?: (state: T, persisted: S | null) => void;
};

/**
 * Wire a Valtio proxy up to AsyncStorage.
 *
 * - Hydrates from storage once on call (async); the returned promise
 *   resolves after `hydrate` has run.
 * - Subscribes to proxy changes and writes the partialized snapshot back.
 */
export function persistProxy<T extends object, S = T>(
  state: T,
  options: PersistOptions<T, S>,
): Promise<void> {
  const { name: key, partialize, hydrate } = options;

  const hydration = AsyncStorage.getItem(key)
    .then((raw) => {
      let persisted: S | null = null;
      if (raw) {
        try {
          persisted = JSON.parse(raw) as S;
        } catch (err) {
          console.warn(`persistProxy(${key}): failed to parse storage`, err);
        }
      }
      if (hydrate) {
        hydrate(state, persisted);
      } else if (persisted) {
        assignWritable(state, persisted);
      }
    })
    .catch((err) => {
      console.warn(`persistProxy(${key}): failed to read storage`, err);
      hydrate?.(state, null);
    });

  subscribe(state, () => {
    const snap = snapshot(state) as T;
    const value = partialize
      ? partialize(snap)
      : (pickWritable(state, snap) as unknown as S);
    if (value === null) {
      AsyncStorage.removeItem(key).catch((err) =>
        console.warn(`persistProxy(${key}): failed to clear storage`, err),
      );
      return;
    }
    AsyncStorage.setItem(key, JSON.stringify(value)).catch((err) =>
      console.warn(`persistProxy(${key}): failed to write storage`, err),
    );
  });

  return hydration;
}

/**
 * Like `Object.assign`, but skips keys on the target whose descriptor is a
 * getter-only accessor. Lets callers persist full snapshots (which
 * materialize computed getters as values) without crashing on hydrate when
 * we try to write those same keys back.
 */
function assignWritable<T extends object>(target: T, source: object): void {
  for (const key of Object.keys(source)) {
    if (!isWritableKey(target, key)) continue;
    (target as Record<string, unknown>)[key] = (
      source as Record<string, unknown>
    )[key];
  }
}

/**
 * Pick only the keys from `source` that correspond to writable data
 * properties on `reference`. Used to strip computed getters out of a
 * snapshot before persisting, so we don't store derived values.
 */
function pickWritable<T extends object>(reference: T, source: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (!isWritableKey(reference, key)) continue;
    out[key] = (source as Record<string, unknown>)[key];
  }
  return out as Partial<T>;
}

function isWritableKey(obj: object, key: string): boolean {
  const descriptor = findDescriptor(obj, key);
  if (!descriptor) return true;
  return descriptor.writable === true || typeof descriptor.set === "function";
}

function findDescriptor(
  obj: object,
  key: string,
): PropertyDescriptor | undefined {
  let cur: object | null = obj;
  while (cur) {
    const d = Object.getOwnPropertyDescriptor(cur, key);
    if (d) return d;
    cur = Object.getPrototypeOf(cur);
  }
  return undefined;
}
