import useTheme from "@/hooks/useTheme";
import { startTrackRecording, useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import OverlayView from "@/ui/OverlayView";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export default function TrackRecordButton() {
  const { isRecording } = useTrackRecording();
  const theme = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(isRecording ? 0 : 1, { duration: 250 });
  }, [isRecording, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <OverlayView
      style={[styles.container, animatedStyle]}
      layout={LinearTransition}
    >
      <View style={styles.row}>
        <Pressable
          onPress={startTrackRecording}
          disabled={isRecording}
          style={styles.button}
        >
          <View style={styles.dotWrap}>
            <SymbolView
              name="circle.fill"
              size={12}
              tintColor={theme.tracks}
            />
          </View>
        </Pressable>
      </View>
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    borderRadius: 22,
    justifyContent: "center",
    marginLeft: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  dotWrap: {
    padding: 4,
    borderRadius: 44,
  },
});
