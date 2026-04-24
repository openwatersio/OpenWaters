import { createStyles } from "@/hooks/useStyles";
import { StyleSheet, View } from "react-native";

type Props = {
  /** Left inset in points, aligning the separator with the row content rather
   *  than running to the sheet edge. iOS convention is 16. */
  inset?: number;
};

export default function RowSeparator({ inset = 16 }: Props) {
  const styles = useStyles();
  return <View style={[styles.separator, { marginLeft: inset }]} />;
}

const useStyles = createStyles((theme) => ({
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.separator,
  },
}));
