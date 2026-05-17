import { createStyles } from "@/hooks/useStyles";
import { Text, View } from "react-native";

type Props = {
  label: string;
  value: string;
  unit: string;
  stale?: boolean;
};

export default function InstrumentCell({ label, value, unit, stale = false }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.cell}>
      <Text style={[styles.label, { opacity: stale ? 0.3 : 0.6 }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { opacity: stale ? 0.3 : 1 }]}>{value}</Text>
        <Text style={[styles.unit, { opacity: stale ? 0.3 : 0.6 }]}>{unit}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  cell: { alignItems: "center", minWidth: 56, paddingVertical: 2 },
  valueRow: { flexDirection: "row", alignItems: "baseline" },
  label: { fontSize: 14, textTransform: "uppercase", color: theme.label },
  value: {
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.8,
    fontVariant: ["tabular-nums"],
    color: theme.label,
  },
  unit: { fontSize: 11, textTransform: "uppercase", color: theme.label },
}));
