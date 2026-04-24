import { toSpeed } from "@/hooks/usePreferredUnits";
import { createStyles } from "@/hooks/useStyles";
import { NavigationState, useNavigation } from "@/navigation/hooks/useNavigation";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import OverlayView from "@/ui/OverlayView";
import { Text, View } from "react-native";

function SpeedOverGround() {
  const nav = useNavigation();
  const styles = useStyles();
  const { value, plural } = toSpeed(nav.speed ?? undefined);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>SOG</Text>
      <Text style={styles.sectionValue}>{value ?? "--"}</Text>
      <Text style={styles.sectionUnits}>{plural}</Text>
    </View>
  );
}

export default function HeadsUpDisplay() {
  const nav = useNavigation();
  const { isRecording } = useTrackRecording();
  const styles = useStyles();

  const visible = nav.state === NavigationState.Underway || isRecording;
  if (!visible) return null;

  return (
    <OverlayView style={styles.container}>
      <SpeedOverGround />
    </OverlayView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 100,
  },
  section: { alignItems: "center" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.6,
    color: theme.label,
  },
  sectionUnits: {
    fontSize: 10,
    textTransform: "uppercase",
    opacity: 0.6,
    color: theme.label,
  },
  sectionValue: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
    color: theme.label,
  },
}));
