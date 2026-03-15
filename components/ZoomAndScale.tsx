import { useCameraRef } from "@/hooks/useCameraRef";
import useTheme from "@/hooks/useTheme";
import { useMapView } from "@/hooks/useMapView";
import { Pressable, StyleSheet, View } from "react-native";
import { IconSymbol } from './ui/IconSymbol';
import OverlayView from './ui/OverlayView';

export default function ZoomAndScale() {
  const cameraRef = useCameraRef();
  const zoom = useMapView((s) => s.zoom);
  const theme = useTheme();

  return (
    <OverlayView style={styles.group}>
      <Pressable onPress={() => cameraRef.current?.zoomTo(zoom + 1, { duration: 300 })} style={styles.button}>
        <IconSymbol name="zoom-in" />
      </Pressable>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <Pressable onPress={() => cameraRef.current?.zoomTo(zoom - 1, { duration: 300 })} style={styles.button}>
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
  },
});
