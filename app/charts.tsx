import SheetView from "@/components/ui/SheetView";
import { mapStyles, useViewOptions } from "@/hooks/useViewOptions";
import { Button, Host, List, Section, VStack } from "@expo/ui/swift-ui";

export default function Charts() {
  const viewOptions = useViewOptions();

  return (
    <SheetView id="charts">
      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section>
              {mapStyles.map(({ id, name }) => {
                const image = viewOptions.mapStyleId === id ? "checkmark.circle.fill" : "circle";
                return (
                  <Button
                    key={id}
                    systemImage={image}
                    label={name}
                    onPress={() => viewOptions.set({ mapStyleId: id })}
                  />
                );
              })}
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
