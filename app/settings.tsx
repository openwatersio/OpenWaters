import SheetView from "@/components/ui/SheetView";
import { ARRIVAL_RADIUS_OPTIONS, describeUnit, getDepthUnits, getDistanceUnits, getSpeedUnits, getTemperatureUnits, setPreferredUnits, usePreferredUnits, type ArrivalRadius } from "@/hooks/usePreferredUnits";
import { Host, List, Picker, Section, Text, Toggle, VStack } from "@expo/ui/swift-ui";
import { tag } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";

export default function Settings() {
  const speed = usePreferredUnits((s) => s.speed);
  const distance = usePreferredUnits((s) => s.distance);
  const depth = usePreferredUnits((s) => s.depth);
  const temperature = usePreferredUnits((s) => s.temperature);
  const arrivalRadius = usePreferredUnits((s) => s.arrivalRadius);
  const arriveOnCircleOnly = usePreferredUnits((s) => s.arriveOnCircleOnly);

  return (
    <SheetView id="settings">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
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
              <Picker
                label="Depth"
                selection={depth}
                onSelectionChange={(unit) => setPreferredUnits({ depth: unit })}
              >
                {getDepthUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Temperature"
                selection={temperature}
                onSelectionChange={(unit) => setPreferredUnits({ temperature: unit })}
              >
                {getTemperatureUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
            </Section>
            <Section title="Routes">
              <Picker
                label="Arrival radius"
                selection={String(arrivalRadius)}
                onSelectionChange={(value) =>
                  setPreferredUnits({ arrivalRadius: Number(value) as ArrivalRadius })
                }
              >
                {ARRIVAL_RADIUS_OPTIONS.map((meters) => (
                  <Text key={meters} modifiers={[tag(String(meters))]}>
                    {meters} m
                  </Text>
                ))}
              </Picker>
              <Toggle
                label="Advance on arrival circle only"
                isOn={arriveOnCircleOnly}
                onIsOnChange={(value) =>
                  setPreferredUnits({ arriveOnCircleOnly: value })
                }
              />
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
