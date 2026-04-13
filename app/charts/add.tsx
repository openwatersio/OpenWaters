import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import useTheme from "@/hooks/useTheme";
import {
  Host,
  List,
  Section,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";

/**
 * Manual chart add flow — placeholder for Phase 5 redesign.
 * Will be replaced with a style builder that writes style.json directly.
 */
export default function AddChartSource() {
  const theme = useTheme();

  return (
    <SheetView id="charts-add">
      <SheetHeader title="Add Chart Source" />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="chevron.left"
          onPress={() => router.back()}
        >
          Back
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section>
              <Text modifiers={[foregroundStyle(theme.textSecondary)]}>
                Manual chart creation is being redesigned. For now, install charts from the catalog.
              </Text>
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
