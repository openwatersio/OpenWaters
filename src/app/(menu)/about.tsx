import { NavigationLink } from "@/ui/NavigationLink";
import SheetView from "@/ui/SheetView";
import { Host, LabeledContent, List, Section, Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, frame, listRowBackground, listRowSeparator, multilineTextAlignment, textSelection } from "@expo/ui/swift-ui/modifiers";
import Constants from "expo-constants";
import { router, Stack } from "expo-router";

export default function About() {
  const version = Constants.expoConfig?.version ?? "—";
  const build = Constants.nativeBuildVersion ?? null;

  return (
    <SheetView id="about">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <List>
          <Section>
            <LabeledContent label="Version">
              <Text modifiers={[textSelection(true)]}>
                {version}{build && ` (${build})`}
              </Text>
            </LabeledContent>
          </Section>
          <Section>
            <NavigationLink label="Safety Notice" destination="/notice" />
            <NavigationLink label="License" destination="/license" />
            <NavigationLink label="Source Code" destination="https://github.com/openwatersio/OpenWaters" />
          </Section>
          <Section>
            <VStack
              alignment="center"
              modifiers={[
                frame({ maxWidth: Infinity, alignment: "center" }),
                listRowBackground("clear"),
                listRowSeparator("hidden"),
              ]}
            >
              <Text modifiers={[
                multilineTextAlignment("center"),
                font({ size: 13 }),
                foregroundStyle("secondary"),
              ]}>
                © {new Date().getFullYear()} Open Water Software, LLC and contributors
              </Text>

            </VStack>
          </Section>
        </List>
      </Host>
    </SheetView>
  );
}
