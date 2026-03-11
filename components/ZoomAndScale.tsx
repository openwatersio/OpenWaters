import { useCameraState } from "@/hooks/useCameraState";
import { Pressable, StyleSheet, View } from "react-native";
import { IconSymbol } from './ui/IconSymbol';
import OverlayView from './ui/OverlayView';

export default function ZoomAndScale() {
  const camera = useCameraState();

  return (
    <OverlayView style={styles.group}>
      <Pressable onPress={() => camera.zoomIn()} style={styles.button}>
        <IconSymbol name="zoom-in" />
      </Pressable>
      <View style={styles.divider} />
      <Pressable onPress={() => camera.zoomOut()} style={styles.button}>
        <IconSymbol name="zoom-out" />
      </Pressable>
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  button: {
    padding: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
});
