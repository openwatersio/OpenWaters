import { resolveSemanticColor } from "expo-platform-colors";
import { useColorScheme } from "react-native";

/**
 * Theme tokens are named by role. UIKit-backed tokens borrow their value from
 * the corresponding `UIColor` semantic color; app-specific tokens either
 * declare an explicit light/dark pair or a single canonical hex whose dark
 * variant is derived via the HSL adaptation below.
 */
type Token =
  | { ios: string }
  | { custom: string }
  | { custom: { light: string; dark: string } };

const tokens = {
  // ── Backgrounds ───────────────────────────────────────────
  // Surfaces you paint on, from back to front.
  background: { ios: "systemBackground" },
  surface: { ios: "secondarySystemBackground" },
  surfaceFloating: {
    custom: {
      light: "rgba(255, 255, 255, 0.85)",
      dark: "rgba(44, 44, 46, 0.9)",
    },
  },

  // ── Foregrounds ───────────────────────────────────────────
  // "label" family: text/icons on a background or surface.
  label: { ios: "label" },
  labelSecondary: { ios: "secondaryLabel" },
  labelTertiary: { ios: "tertiaryLabel" },
  // "contrast": foreground on any saturated fill (accent or map overlay)
  // or on the nautical chart.
  contrast: { custom: "#FFFFFF" },

  // ── Accents ───────────────────────────────────────────────
  // Saturated role colors for UI fills.
  accent: { ios: "systemBlue" },
  success: { ios: "systemGreen" },
  warning: { ios: "systemOrange" },
  danger: { ios: "systemRed" },

  // ── Map features ──────────────────────────────────────────
  // Saturated app-specific colors for map overlays. Single hex — dark
  // variant auto-derived via HSL adaptation.
  userLocation: { ios: "systemRed" },
  tracks: { custom: "#FF3B30" },
  routes: { custom: "#EE22EE" },
  markers: { custom: "#007AFF" },
  ais: { custom: "#25AC00" },
  aton: { custom: "#F59E0B" },

  // ── Chrome ────────────────────────────────────────────────
  separator: { ios: "opaqueSeparator" },
  fill: { ios: "systemFill" },
} satisfies Record<string, Token>;

type Scheme = "light" | "dark";
type Palette = { readonly [K in keyof typeof tokens]: string };

export type Theme = Palette & {
  /**
   * Returns a scheme-adjusted version of an arbitrary hex color. In light
   * mode returns the input unchanged; in dark mode reduces lightness and
   * saturation via HSL so saturated colors don't stab at night. Used both
   * for user-picked colors at runtime and for deriving dark variants of
   * single-value theme tokens at module load.
   */
  adapt: (hex: string) => string;
};

// ── Color adaptation ──────────────────────────────────────────
// HSL transform applied to any saturated hex in dark mode. Multipliers
// chosen so a saturated mid-tone reads as "quieter same color" in dark,
// without crushing blues/greens to near-black.
const DARK_SATURATION = 0.95;
const DARK_LIGHTNESS = 0.5;

const adaptCache = new Map<string, string>();

function adaptColor(hex: string, scheme: Scheme): string {
  if (scheme === "light") return hex;
  const key = `${scheme}:${hex}`;
  const cached = adaptCache.get(key);
  if (cached) return cached;
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const { h, s, l } = rgbToHsl(rgb);
  const out = hslToHex({
    h,
    s: clamp01(s * DARK_SATURATION),
    l: clamp01(l * DARK_LIGHTNESS),
  });
  adaptCache.set(key, out);
  return out;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) =>
    Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueToRgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

// ── Palette materialization ───────────────────────────────────
function resolve(token: Token, scheme: Scheme): string {
  if ("ios" in token) return resolveSemanticColor(token.ios, scheme);
  if (typeof token.custom === "string") return adaptColor(token.custom, scheme);
  return token.custom[scheme];
}

function build(scheme: Scheme): Palette {
  const entries = (Object.keys(tokens) as (keyof typeof tokens)[]).map(
    (name) => [name, resolve(tokens[name], scheme)] as const,
  );
  return Object.freeze(Object.fromEntries(entries)) as Palette;
}

/** Materialized once at module load; static for the lifetime of the JS runtime. */
const themes = Object.freeze({
  light: Object.freeze({
    ...build("light"),
    adapt: (hex: string) => adaptColor(hex, "light"),
  }),
  dark: Object.freeze({
    ...build("dark"),
    adapt: (hex: string) => adaptColor(hex, "dark"),
  }),
});

/**
 * Returns the active color palette. The window's user interface style is
 * driven app-wide by `setOverrideUserInterfaceStyle` (wired to the chart
 * theme), so `useColorScheme()` reflects the app theme rather than the OS
 * setting.
 *
 * Returns the same object identity for a given scheme so memoized consumers
 * (like `createStyles`) don't re-evaluate on every render.
 */
export default function useTheme(): Theme {
  return useColorScheme() === "dark" ? themes.dark : themes.light;
}
