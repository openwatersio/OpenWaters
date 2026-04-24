import useTheme, { type Theme } from "@/hooks/useTheme";
import { useMemo } from "react";
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Builds a memoized StyleSheet keyed on the active theme. Use for styles that
 * reference theme tokens; plain `StyleSheet.create` is still fine for
 * layout-only styles.
 *
 *   const useStyles = createStyles((theme) => ({
 *     container: { backgroundColor: theme.background },
 *     label: { color: theme.label },
 *   }));
 *
 *   function Foo() {
 *     const styles = useStyles();
 *     return <View style={styles.container} />;
 *   }
 */
export function createStyles<T extends NamedStyles<T>>(
  factory: (theme: Theme) => T,
): () => T {
  return function useStyles() {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
