import SheetView from "@/components/ui/SheetView";
import { describeUnit, getDistanceUnits, getSpeedUnits, setPreferredUnits, usePreferredUnits } from "@/hooks/usePreferredUnits";
import { Host, List, Picker, Section, Text, VStack } from "@expo/ui/swift-ui";
import { tag } from "@expo/ui/swift-ui/modifiers";

export default function Settings() {
  const speed = usePreferredUnits((s) => s.speed);
  const distance = usePreferredUnits((s) => s.distance);

  return (
    <SheetView id="settings">
      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section title="Preferred Units">
              <Picker
                label="Speed"
                selection={speed}
                onSelectionChange={(unit) => setPreferredUnits({ speed: unit })}
              >
                {getSpeedUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Distance"
                selection={distance}
                onSelectionChange={(unit) => setPreferredUnits({ distance: unit })}
              >
                {getDistanceUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
