import useTheme, { type Theme } from "@/hooks/useTheme";
import { useMemo } from "react";
import { Platform, Text } from "react-native";
import Markdown, { type RenderRules } from "react-native-markdown-display";

// CommonMark says a soft line break (a single \n inside a paragraph) renders
// as whitespace; the library's default rule emits a literal \n which <Text>
// then shows as a hard wrap. Override to a single space so soft-wrapped
// markdown source reflows correctly at screen width.
const rules: RenderRules = {
  softbreak: (node) => <Text key={node.key}>{" "}</Text>,
};

/**
 * Themed wrapper around `react-native-markdown-display`. Use anywhere we want
 * to render an authored markdown string with the app's typography and palette.
 */
export default function MarkdownView({ source }: { source: string }) {
  const theme = useTheme();
  const styles = useMemo(() => buildStyles(theme), [theme]);
  return <Markdown rules={rules} style={styles}>{source}</Markdown>;
}

const monospace = Platform.select({ ios: "Menlo", default: "monospace" });

function buildStyles(theme: Theme) {
  return {
    body: {
      color: theme.labelSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    heading1: {
      color: theme.label,
      fontSize: 24,
      fontWeight: "700" as const,
      marginTop: 8,
      marginBottom: 16,
    },
    heading2: {
      color: theme.label,
      fontSize: 20,
      fontWeight: "700" as const,
      marginTop: 24,
      marginBottom: 12,
    },
    heading3: {
      color: theme.label,
      fontSize: 17,
      fontWeight: "600" as const,
      marginTop: 20,
      marginBottom: 8,
    },
    paragraph: { marginTop: 0, marginBottom: 12 },
    strong: { color: theme.label, fontWeight: "600" as const },
    em: { fontStyle: "italic" as const },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    list_item: { marginBottom: 6 },
    bullet_list_icon: { color: theme.labelSecondary, marginRight: 8 },
    code_inline: {
      backgroundColor: theme.fill,
      color: theme.label,
      fontFamily: monospace,
      fontSize: 13,
      paddingHorizontal: 4,
      borderRadius: 3,
    },
    code_block: {
      backgroundColor: theme.surface,
      color: theme.label,
      fontFamily: monospace,
      fontSize: 12,
      lineHeight: 18,
      padding: 12,
      borderRadius: 6,
      marginBottom: 12,
    },
    fence: {
      backgroundColor: theme.surface,
      color: theme.label,
      fontFamily: monospace,
      fontSize: 12,
      lineHeight: 18,
      padding: 12,
      borderRadius: 6,
      marginBottom: 12,
    },
    link: { color: theme.accent },
    hr: { backgroundColor: theme.separator, height: 1, marginVertical: 16 },
    blockquote: {
      backgroundColor: theme.surface,
      borderLeftColor: theme.separator,
      borderLeftWidth: 3,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 12,
    },
  };
}
