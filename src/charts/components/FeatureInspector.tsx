import useTheme from "@/hooks/useTheme";
import { SymbolView } from "expo-symbols";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { FullWindowOverlay } from "react-native-screens";

type Props = {
  /** Any JSON-serializable value to inspect; the raw GeoJSON feature here. */
  value: unknown;
  visible: boolean;
  onClose: () => void;
  title?: string;
};

/**
 * Full-screen overlay that pretty-prints a value as selectable, scrollable JSON
 * with a Copy action. A developer affordance for inspecting the raw feature
 * behind a chart detail sheet.
 *
 * Uses react-native-screens' `FullWindowOverlay` rather than a React Native
 * `Modal`: the detail sheet is itself a native `formSheet`, and a `Modal`
 * presented from inside one doesn't reliably receive touches. The overlay
 * renders in its own window above the sheet and stays in the React tree, so
 * its Pressables work.
 */
export default function FeatureInspector({ value, visible, onClose, title = "Feature" }: Props) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const json = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const copy = async () => {
    await Clipboard.setStringAsync(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!visible) return null;

  return (
    <FullWindowOverlay>
      <SafeAreaProvider style={StyleSheet.absoluteFill}>
        <SafeAreaView
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]}
          edges={["top", "bottom"]}
        >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: theme.separator,
          }}
        >
          <Text style={{ flex: 1, fontSize: 17, fontWeight: "600", color: theme.label }}>
            {title}
          </Text>
          <Pressable onPress={copy} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 20 }}>
            <SymbolView
              name={copied ? "checkmark" : "doc.on.doc"}
              size={18}
              tintColor={theme.accent}
            />
            <Text style={{ fontSize: 15, color: theme.accent }}>
              {copied ? "Copied" : "Copy"}
            </Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8}>
            <SymbolView name="xmark.circle.fill" size={24} tintColor={theme.labelSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          showsHorizontalScrollIndicator
        >
          <Text
            selectable
            style={{
              fontFamily: "Menlo",
              fontSize: 12,
              lineHeight: 17,
              color: theme.label,
            }}
          >
            {json}
          </Text>
        </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </FullWindowOverlay>
  );
}
