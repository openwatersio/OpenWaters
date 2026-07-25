import type { Theme } from "@/charts/catalog/types";
import { Coordinates } from "@/geo";
import { persistProxy } from "@/persistProxy";
import { getTimes, getPosition } from "suncalc";
import { proxy, useSnapshot } from "valtio";

export type ThemePreference = Theme | "auto";

interface ThemeState {
  /** User's preference: "day", "dusk", "night", or "auto" (time-based). */
  preference: ThemePreference;
}

export const themePreferenceState = proxy<ThemeState>({
  preference: "auto",
});

persistProxy(themePreferenceState, { name: "chart-theme" });

export function useThemePreference() {
  return useSnapshot(themePreferenceState);
}

export function setThemePreference(preference: ThemePreference): void {
  themePreferenceState.preference = preference;
}

// ---------------------------------------------------------------------------
// Auto-mode theme resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the active theme for a given preference.
 *
 * For "auto", uses the device's location and current time to pick between
 * day, dusk, and night based on civil twilight boundaries:
 * - Day: sun is fully above the horizon (after `sunriseEnd`, before `sunsetStart`)
 * - Dusk: civil twilight (dawn→sunriseEnd in the morning, sunsetStart→dusk in the evening)
 * - Night: sun is below the civil twilight threshold (before `dawn`, after `dusk`)
 *
 * If preference is a specific theme, returns it directly.
 * If preference is "auto" and no location is available, falls back to "day".
 */
export function resolveTheme(
  preference: ThemePreference,
  position?: Coordinates | null,
): Theme {
  if (preference !== "auto") return preference;
  if (!position) return "day";

  const now = new Date();
  const times = getTimes(now, position.latitude, position.longitude);
  const t = now.getTime();
  // suncalc 2.x returns null (not an invalid Date) for times the sun never
  // reaches on a given day; coerce to NaN so the fallback-by-altitude below
  // still triggers.
  const dawn = times.dawn?.getTime() ?? NaN;
  const sunriseEnd = times.sunriseEnd?.getTime() ?? NaN;
  const sunsetStart = times.sunsetStart?.getTime() ?? NaN;
  const dusk = times.dusk?.getTime() ?? NaN;

  // Polar regions: any of these may be NaN if the sun doesn't cross the
  // relevant threshold on this day. Fall back by sun altitude.
  if (Number.isNaN(dawn) || Number.isNaN(dusk)) {
    const { altitude } = getPosition(
      now,
      position.latitude,
      position.longitude,
    );
    // suncalc 2.0 returns altitude in degrees (it was radians in 1.x);
    // 0.1 rad ≈ 5.7°.
    if (altitude > 5.7) return "day";
    if (altitude > -5.7) return "dusk";
    return "night";
  }

  if (t < dawn) return "night";
  if (t < sunriseEnd) return "dusk";
  if (t < sunsetStart) return "day";
  if (t < dusk) return "dusk";
  return "night";
}
