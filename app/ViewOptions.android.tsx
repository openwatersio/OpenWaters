import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function ViewOptions() {
  const viewOptions = useViewOptions();
  const units = usePreferredUnits();

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Charts</Text>
      {mapStyles.map(({ id, name }) => {
        const selected = viewOptions.mapStyleId === id;
        return (
          <TouchableOpacity
            key={id}
            style={styles.row}
            onPress={() => viewOptions.set({ mapStyleId: id })}
          >
            <Text style={styles.rowText}>{name}</Text>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        );
      })}

      <Text style={styles.sectionTitle}>Preferred Units</Text>
      <Text style={styles.label}>Speed</Text>
      {units.possibilities("speed").map((unit) => {
        const selected = units.speed === unit;
        return (
          <TouchableOpacity
            key={unit}
            style={styles.row}
            onPress={() => units.set({ speed: unit })}
          >
            <Text style={styles.rowText}>{units.describe(unit).plural}</Text>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b6b6b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    color: "#6b6b6b",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  rowText: {
    fontSize: 16,
    color: "#000",
  },
  checkmark: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "600",
  },
});
