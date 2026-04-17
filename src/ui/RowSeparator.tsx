import useTheme from "@/hooks/useTheme";
import { StyleSheet, View } from "react-native";

type Props = {
  /** Left inset in points, aligning the separator with the row content rather
   *  than running to the sheet edge. iOS convention is 16. */
  inset?: number;
};

/**
 * Hairline divider between rows in a `FlatList` via `ItemSeparatorComponent`,
 * or between any stacked elements. Uses `theme.border` for the color and
 * `StyleSheet.hairlineWidth` for the height so it renders as a single
 * device pixel regardless of scale.
 */
export default function RowSeparator({ inset = 16 }: Props) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.separator,
        { backgroundColor: theme.border, marginLeft: inset },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  separator: { height: StyleSheet.hairlineWidth },
});
