import type { Theme } from "@/charts/catalog/types";
import { persistProxy } from "@/persistProxy";
import SunCalc from "suncalc";
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
  options: { latitude?: number; longitude?: number; now?: Date } = {},
): Theme {
  if (preference !== "auto") return preference;

  const { latitude, longitude, now = new Date() } = options;
  if (latitude == null || longitude == null) return "day";

  const times = SunCalc.getTimes(now, latitude, longitude);
  const t = now.getTime();
  const dawn = times.dawn.getTime();
  const sunriseEnd = times.sunriseEnd.getTime();
  const sunsetStart = times.sunsetStart.getTime();
  const dusk = times.dusk.getTime();

  // Polar regions: any of these may be NaN if the sun doesn't cross the
  // relevant threshold on this day. Fall back by sun altitude.
  if (Number.isNaN(dawn) || Number.isNaN(dusk)) {
    const { altitude } = SunCalc.getPosition(now, latitude, longitude);
    if (altitude > 0.1) return "day";
    if (altitude > -0.1) return "dusk";
    return "night";
  }

  if (t < dawn) return "night";
  if (t < sunriseEnd) return "dusk";
  if (t < sunsetStart) return "day";
  if (t < dusk) return "dusk";
  return "night";
}
