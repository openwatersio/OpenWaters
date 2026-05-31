import useTheme from "@/hooks/useTheme";
import { GlassView, GlassViewProps, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ComponentPropsWithoutRef } from "react";
import Animated from "react-native-reanimated";

const liquidGlass = isLiquidGlassAvailable();

const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

type AnimatedViewProps = ComponentPropsWithoutRef<typeof AnimatedGlassView>;

type OverlayViewProps = {
  style?: AnimatedViewProps["style"];
  children?: React.ReactNode;
} & GlassViewProps & Pick<AnimatedViewProps, "layout" | "entering" | "exiting">;

export default function OverlayView({ style, children, ...animationProps }: OverlayViewProps) {
  const theme = useTheme();

  if (liquidGlass) {
    return (
      <AnimatedGlassView
        glassEffectStyle="regular"
        style={style}
        isInteractive
        {...animationProps}
      >
        {children}
      </AnimatedGlassView>
    );
  }

  return (
    <Animated.View
      style={[{ backgroundColor: theme.surface }, style]}
      {...animationProps}
    >
      {children}
    </Animated.View>
  );
}
