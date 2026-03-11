import {
  GlassView,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const liquidGlass =
  Platform.OS === "ios" && isLiquidGlassAvailable();

type OverlayViewProps = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export default function OverlayView({
  style,
  children,
}: OverlayViewProps) {
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" style={style}>
        {children}
      </GlassView>
    );
  }

  return <View style={[style, styles.fallback]}>{children}</View>;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
