import { useTrackRecording } from "@/hooks/useTrackRecording";
import useTheme from "@/hooks/useTheme";
import { router, usePathname } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { IconSymbol } from "./ui/IconSymbol";
import OverlayView from "./ui/OverlayView";

export default function TrackRecordButton() {
  const { isRecording, activeTrackId, start } = useTrackRecording();
  const theme = useTheme();
  const pathname = usePathname();
  const trackSheetOpen = pathname.startsWith("/track/");

  const showButton = !trackSheetOpen;

  // Pulse animation when recording is active but sheet is not visible
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (isRecording && !trackSheetOpen) {
      pulse.value = withRepeat(
        withTiming(0.5, { duration: 1000 }),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, trackSheetOpen, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  if (!showButton) return null;

  const handlePress = async () => {
    if (isRecording && activeTrackId) {
      router.push(`/track/${activeTrackId}`);
    } else {
      await start();
      const trackId = useTrackRecording.getState().activeTrackId;
      if (trackId) router.push(`/track/${trackId}`);
    }
  };

  return (
    <OverlayView style={styles.buttonOverlay}>
      <Pressable
        onPress={handlePress}
        onLongPress={() => router.push("/tracks")}
        style={styles.button}
      >
        <Animated.View style={isRecording ? pulseStyle : undefined}>
          <IconSymbol name="fiber-manual-record" color={theme.danger} />
        </Animated.View>
      </Pressable>
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  buttonOverlay: {
    borderRadius: 100,
    overflow: "hidden",
  },
  button: {
    padding: 12,
  },
});
