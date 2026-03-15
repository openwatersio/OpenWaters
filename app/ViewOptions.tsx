import { useSheetReporter } from "@/hooks/useSheetPosition";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export default function ViewOptions() {
  const viewOptions = useViewOptions();
  const units = usePreferredUnits();
  const theme = useTheme();
  const { onLayout: onSheetLayout } = useSheetReporter("viewOptions");
  const styles = makeStyles(theme);

  return (
    <ScrollView style={styles.container} onLayout={onSheetLayout}>
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
      {units.speedUnits().map((unit) => {
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

      <Text style={styles.label}>Distance</Text>
      {units.distanceUnits().map((unit) => {
        const selected = units.distance === unit;
        return (
          <TouchableOpacity
            key={unit}
            style={styles.row}
            onPress={() => units.set({ distance: unit })}
          >
            <Text style={styles.rowText}>{units.describe(unit).plural}</Text>
            {selected && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 8,
    },
    label: {
      fontSize: 13,
      color: theme.textSecondary,
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
      borderBottomColor: theme.border,
      backgroundColor: theme.surface,
    },
    rowText: {
      fontSize: 16,
      color: theme.textPrimary,
    },
    checkmark: {
      fontSize: 16,
      color: theme.primary,
      fontWeight: "600",
    },
  });
}
