import useTheme from "@/hooks/useTheme";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import { Button, Host } from "@expo/ui/swift-ui";
import { frame, glassEffect, glassEffectId } from "@expo/ui/swift-ui/modifiers";
import { router, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const NS_ID = 'map-controls';

export default function TrackRecordButton() {
  const { isRecording } = useTrackRecording();
  const theme = useTheme();
  const pathname = usePathname();
  const trackSheetOpen = pathname.startsWith("/track/");

  const showButton = !trackSheetOpen;

  // Pulse animation when recording is active but sheet is not visible
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isRecording && !trackSheetOpen) {
      pulse.value = withRepeat(
        withTiming(0.75, { duration: 1000 }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, trackSheetOpen, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 1 - (1 - pulse.value) * 0.2 }],
  }));

  if (!showButton) return null;

  return (
    <Host>
      <Button
        onPress={() => router.push("/track/record")}
        modifiers={[
          frame({ width: 44, height: 44, alignment: 'center' }),
          glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'circle' }),
          glassEffectId('menu', NS_ID),
        ]}
      >
        <Animated.View style={[{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }, isRecording ? pulseStyle : undefined]}>
          <SymbolView name={isRecording ? "circle.fill" : "circle.fill"} size={18} tintColor={theme.danger} />
        </Animated.View>
      </Button>
    </Host>
  );
}
