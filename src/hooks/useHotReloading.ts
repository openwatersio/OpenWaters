import { useEffect, useRef, type MutableRefObject } from "react";

/**
 * Returns a ref that flips to `true` immediately before Metro Fast Refresh
 * replaces the calling module. Useful in `useEffect` cleanup to distinguish
 * an HMR-driven unmount from a real unmount.
 *
 * `module.hot` is per-module, so the caller must pass its own `module`:
 *
 * ```ts
 * const isHotReloading = useHotReloading(module);
 *
 * useEffect(() => () => {
 *   if (isHotReloading.current) return;
 *   // real unmount cleanup
 * }, []);
 * ```
 *
 * In release builds (`__DEV__ === false`) the ref stays `false` forever.
 */
export function useHotReloading(mod: unknown): MutableRefObject<boolean> {
  const ref = useRef(false);

  useEffect(() => {
    if (!__DEV__) return;
    const hot = (mod as { hot?: { dispose: (cb: () => void) => void } })?.hot;
    if (!hot) return;
    hot.dispose(() => {
      ref.current = true;
    });
  }, [mod]);

  return ref;
}
