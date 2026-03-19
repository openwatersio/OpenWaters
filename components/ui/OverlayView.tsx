import {
  GlassView,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { StyleSheet, useColorScheme, View, type StyleProp, type ViewStyle } from "react-native";

const liquidGlass = isLiquidGlassAvailable();

type OverlayViewProps = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function OverlayView({
  style,
  children,
}: OverlayViewProps) {
  const isDark = useColorScheme() === "dark";

  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={isDark ? "dark" : "light"} style={style} isInteractive>
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[style, styles.fallback, isDark && styles.fallbackDark]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fallbackDark: {
    backgroundColor: "#1c1c1e",
  },
});
