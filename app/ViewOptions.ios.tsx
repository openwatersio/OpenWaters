import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import {
  Button,
  Host,
  List,
  Picker,
  Section,
  Text,
  VStack
} from '@expo/ui/swift-ui';
import { tag } from '@expo/ui/swift-ui/modifiers';

export default function ViewOptions() {
  const viewOptions = useViewOptions();
  const units = usePreferredUnits();

  return (
    <Host style={{ flex: 1 }}>
      <VStack alignment="leading">
        <List>
          <Section title="Charts">
            {
              mapStyles.map(({ id, name }) => {
                const image = viewOptions.mapStyleId === id ? 'checkmark.circle.fill' : 'circle';
                return (
                  <Button
                    key={id}
                    systemImage={image}
                    label={name}
                    onPress={() => viewOptions.set({ mapStyleId: id })}
                  />
                );
              })
            }
          </Section>

          <Section title="Prefered Units">
            <Picker
              label="Speed"
              selection={units.speed}
              onSelectionChange={(unit) => units.set({ speed: unit })}
            >
              {units.possibilities('speed').map((unit) => (
                <Text key={unit} modifiers={[tag(unit)]}>
                  {units.describe(unit).plural}
                </Text>
              ))}
            </Picker>
          </Section>
        </List>
      </VStack>
    </Host>
  );
}
