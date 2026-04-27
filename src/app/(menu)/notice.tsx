import NoticeBody from "@/disclaimer/components/NoticeBody";
import useTheme from "@/hooks/useTheme";
import SheetView from "@/ui/SheetView";
import { router, Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

export default function Notice() {
  const theme = useTheme();
  return (
    <SheetView id="notice">
      <Stack.Screen options={{ title: "Safety Notice" }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <NoticeBody />
      </ScrollView>
    </SheetView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },
});
