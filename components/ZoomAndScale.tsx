import { useCameraState } from "@/hooks/useCameraState";
import { StyleSheet, View } from "react-native";
import OverlayButton from './ui/OverlayButton';
import OverlayView from './ui/OverlayView';

export default function ZoomAndScale() {
  const camera = useCameraState();

  return (
    <OverlayView style={styles.group}>
      <OverlayButton onPress={() => camera.zoomIn()} icon="zoom-in" glass={false} />
      <View style={styles.divider} />
      <OverlayButton onPress={() => camera.zoomOut()} icon="zoom-out" glass={false} />
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
});
