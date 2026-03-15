import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useSheetReporter } from "@/hooks/useSheetPosition";
import { Host, List, Picker, Section, Text, VStack } from "@expo/ui/swift-ui";
import { tag } from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

export default function Settings() {
  const units = usePreferredUnits();
  const { onLayout: onSheetLayout } = useSheetReporter("settings");

  return (
    <View style={{ flex: 1 }} onLayout={onSheetLayout}>
      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section title="Preferred Units">
              <Picker
                label="Speed"
                selection={units.speed}
                onSelectionChange={(unit) => units.set({ speed: unit })}
              >
                {units.speedUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {units.describe(unit).plural}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Distance"
                selection={units.distance}
                onSelectionChange={(unit) => units.set({ distance: unit })}
              >
                {units.distanceUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {units.describe(unit).plural}
                  </Text>
                ))}
              </Picker>
            </Section>
          </List>
        </VStack>
      </Host>
    </View>
  );
}
