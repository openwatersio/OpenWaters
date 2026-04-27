import log from "@/logger";
import MarkdownView from "@/ui/MarkdownView";
import { useAssets } from "expo-asset";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

const logger = log.extend("notice");

// eslint-disable-next-line @typescript-eslint/no-require-imports
const NOTICE_ASSET = require("@/disclaimer/notice.md");

/**
 * Loads `disclaimer/notice.md` from the bundle and renders it as markdown.
 * Shows a spinner while the asset resolves. Used by the first-launch
 * disclaimer gate and by the in-app Safety Notice sheet.
 */
export default function NoticeBody() {
  const [assets] = useAssets([NOTICE_ASSET]);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!assets?.[0]) return;
    fetch(assets[0].localUri ?? assets[0].uri)
      .then((r) => r.text())
      .then(setSource)
      .catch((err) => logger.warn("failed to load notice.md", err));
  }, [assets]);

  if (source == null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }
  return <MarkdownView source={source} />;
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 48,
    alignItems: "center",
  },
});
