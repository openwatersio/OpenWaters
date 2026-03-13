import { useCameraState } from "@/hooks/useCameraState";
import { useMapView } from "@/hooks/useMapView";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "./ui/IconSymbol";
import OverlayView from "./ui/OverlayView";

const SIZE = 24;
const ARROW_SIZE = 5;

function CompassDial({ bearing }: { bearing: number }) {
  return (
    <View style={[styles.dial, { transform: [{ rotate: `${-bearing}deg` }] }]}>
      <View style={styles.arrowUp} />
      <Text style={styles.north}>N</Text>
      <View style={styles.arrowDown} />
    </View>
  );
}

export default function CurrentLocationButton() {
  const { followUserLocation, trackingMode, cycleTrackingMode } =
    useCameraState();
  const bearing = useMapView((s) => s.bearing);

  const isCourseUp = followUserLocation && trackingMode === "course";

  return (
    <OverlayView style={styles.overlay}>
      <Pressable onPress={cycleTrackingMode} style={styles.button}>
        {isCourseUp ? (
          <CompassDial bearing={bearing} />
        ) : (
          <IconSymbol
            name={followUserLocation ? "my-location" : "location-searching"}
          />
        )}
      </Pressable>
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    borderRadius: 100,
    overflow: "hidden",
  },
  button: {
    padding: 12,
  },
  dial: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  north: {
    fontSize: 11,
    fontWeight: "800",
    color: "#d32f2f",
    lineHeight: 13,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE / 2,
    borderRightWidth: ARROW_SIZE / 2,
    borderBottomWidth: ARROW_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#d32f2f",
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE / 2,
    borderRightWidth: ARROW_SIZE / 2,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#666",
  },
});
