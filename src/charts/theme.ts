import type { Theme } from "@/charts/catalog/types";
import { Coordinates } from "@/geo";
import { persistProxy } from "@/persistProxy";
import { sunAltAz } from "@openwaters/almanac";
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
 * For "auto", uses the Sun's altitude at the device's location now:
 * - Day: the whole disc is above the horizon
 * - Dusk: between that and the end of civil twilight
 * - Night: the Sun is below civil twilight
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

  // sunAltAz is refracted. The whole disc clears the horizon once the center
  // is a semidiameter (0.27°) up; civil twilight's -6° geometric reads about
  // -5.4° refracted.
  const { altDeg } = sunAltAz(new Date(), {
    latitudeDeg: position.latitude,
    longitudeDeg: position.longitude,
  });
  if (altDeg > 0.27) return "day";
  if (altDeg > -5.4) return "dusk";
  return "night";
}
