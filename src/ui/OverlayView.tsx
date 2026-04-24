import useTheme from "@/hooks/useTheme";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useColorScheme, View, type StyleProp, type ViewStyle } from "react-native";

const liquidGlass = isLiquidGlassAvailable();

type OverlayViewProps = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function OverlayView({ style, children }: OverlayViewProps) {
  const theme = useTheme();
  // useColorScheme() reflects the app-wide theme because _layout.tsx drives
  // UIWindow.overrideUserInterfaceStyle from the chart theme.
  const colorScheme = useColorScheme() === "dark" ? "dark" : "light";

  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme={colorScheme}
        style={style}
        isInteractive
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[{ backgroundColor: theme.surface }, style]}>{children}</View>
  );
}
