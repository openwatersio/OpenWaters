import { useColorScheme } from "react-native";

export default function useTheme(colorScheme: "light" | "dark" = (useColorScheme() as "light" | "dark") ?? "light") {
  const isDark = colorScheme === "dark";

  return {
    background: isDark ? "#000000" : "#f2f2f7",
    surface: isDark ? "#1c1c1e" : "#ffffff",
    surfaceSecondary: isDark ? "#2c2c2e" : "#f1f5f9",
    textPrimary: isDark ? "#ffffff" : "#1a1a1a",
    textSecondary: isDark ? "#a1a1aa" : "#64748b",
    textTertiary: isDark ? "#71717a" : "#94a3b8",
    primary: isDark ? "#007AFF" : "#0066CC",
    success: isDark ? "#30d158" : "#22c55e",
    warning: isDark ? "#ff9f0a" : "#f59e0b",
    danger: isDark ? "#ff453a" : "#ef4444",
    buttonBackground: isDark ? "#3a3a3c" : "#e2e8f0",
    buttonBackgroundActive: isDark ? "#30d158" : "#22c55e",
    border: isDark ? "#38383a" : "#e2e8f0",
    borderActive: isDark ? "#30d158" : "#16a34a",
    shadowColor: isDark ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.3)",
    glowColor: isDark ? "rgba(48, 209, 88, 0.4)" : "rgba(34, 197, 94, 0.3)",
    primaryGlow: isDark ? "rgba(0, 122, 255, 0.4)" : "rgba(0, 102, 204, 0.3)",
    // Semi-transparent card/panel backgrounds that float above map content
    surfaceElevated: isDark ? "rgba(44, 44, 46, 0.9)" : "rgba(255, 255, 255, 0.85)",
    userLocation: isDark ? "#ff453a" : "#ef4444",
  };
};
