import useTheme from "@/hooks/useTheme";
import log from "@/logger";
import MarkdownView from "@/ui/MarkdownView";
import SheetView from "@/ui/SheetView";
import { useAssets } from "expo-asset";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";

const logger = log.extend("license");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LICENSE_ASSET = require("../../../LICENSE.md");

export default function License() {
  const theme = useTheme();
  const [assets] = useAssets([LICENSE_ASSET]);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!assets?.[0]) return;
    fetch(assets[0].localUri ?? assets[0].uri)
      .then((r) => r.text())
      .then(setSource)
      .catch((err) => logger.warn("failed to load LICENSE.md", err));
  }, [assets]);

  return (
    <SheetView id="license">
      <Stack.Screen options={{ title: "License" }} />
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
        {source == null ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : (
          <MarkdownView source={source} />
        )}
      </ScrollView>
    </SheetView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  loading: {
    paddingVertical: 48,
    alignItems: "center",
  },
});
