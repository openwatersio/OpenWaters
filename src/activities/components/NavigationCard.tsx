import ActivityCard from "@/activities/components/ActivityCard";
import InstrumentCell from "@/activities/components/InstrumentCell";
import { toSpeed } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { NavigationState, useNavigation } from "@/navigation/hooks/useNavigation";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { SymbolView } from "expo-symbols";
import { StyleSheet, View } from "react-native";

export function useNavigationCardVisible(): boolean {
  const { state } = useNavigation();
  const { isRecording } = useTrackRecording();
  return state === NavigationState.Underway || isRecording;
}

export default function NavigationCard() {
  const { speed, course, heading, source } = useNavigation();
  const theme = useTheme();

  const sog = toSpeed(speed ?? undefined);


  return (
    <ActivityCard>
      <View style={styles.stack}>
        <View style={styles.row}>
          <SymbolView
            name={source === "signalk" && false ? "antenna.radiowaves.left.and.right" : "location.fill"}
            tintColor={theme.accent}
          />
          <InstrumentCell label="SOG" value={sog.value} unit={sog.abbr} />
          <InstrumentCell label="COG" value={formatDegrees(course)} unit="°" />
          <InstrumentCell
            label="HDG"
            value={heading !== null ? `${Math.round(heading)}` : "--"}
            unit="°"
          />
        </View>
      </View>
    </ActivityCard>
  );
}

function formatDegrees(radians: number | null): string {
  if (radians === null) return "--";
  return `${Math.round((((radians * 180) / Math.PI) + 360) % 360)}`;
}

const styles = StyleSheet.create({
  stack: { gap: 4 },
  sourceRow: { alignItems: "center" },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    gap: 16,
  },
});
