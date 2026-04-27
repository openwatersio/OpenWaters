import NoticeBody from "@/disclaimer/components/NoticeBody";
import { acknowledgeDisclaimer } from "@/disclaimer/hooks/useDisclaimer";
import useTheme from "@/hooks/useTheme";
import { SymbolView } from "expo-symbols";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DisclaimerScreen() {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.iconWrap}>
          <SymbolView
            name="exclamationmark.triangle.fill"
            size={56}
            tintColor={theme.warning}
          />
        </View>
        <Text style={[styles.title, { color: theme.label }]}>
          Important Safety Notice
        </Text>
        <NoticeBody />
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.separator }]}>
        <Pressable
          accessibilityRole="button"
          onPress={acknowledgeDisclaimer}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.buttonLabel, { color: theme.contrast }]}>
            I Understand and Agree
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  iconWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
