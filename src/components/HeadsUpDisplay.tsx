
import { NavigationState, useNavigation } from "@/hooks/useNavigation";
import { toSpeed } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import { StyleSheet, Text, View } from "react-native";
import OverlayView from "./ui/OverlayView";

function SpeedOverGround() {
  const nav = useNavigation();
  const theme = useTheme();
  const { value, plural } = toSpeed(nav.speed ?? undefined);

  return (
    <View style={styles.section}>
      <Text style={[{ color: theme.textPrimary }, styles.sectionLabel]}>SOG</Text>
      <Text style={[{ color: theme.textPrimary }, styles.sectionValue]}>{value ?? "--"}</Text>
      <Text style={[{ color: theme.textPrimary }, styles.sectionUnits]}>{plural}</Text>
    </View>
  );
}

export default function HeadsUpDisplay() {
  const nav = useNavigation();
  const { isRecording } = useTrackRecording();

  const visible = nav.state === NavigationState.Underway || isRecording;
  if (!visible) return null;

  return (
    <OverlayView style={styles.container}>
      <SpeedOverGround />
    </OverlayView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 100,
  },
  section: {
    alignItems: "center",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.6,
  },
  sectionUnits: {
    fontSize: 10,
    textTransform: "uppercase",
    opacity: 0.6,
  },
  sectionValue: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
  },
});
