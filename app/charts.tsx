import SheetView from "@/components/ui/SheetView";
import { mapStyles, setViewOptions, useViewOptions } from "@/hooks/useViewOptions";
import { Button, Host, List, Section, VStack } from "@expo/ui/swift-ui";

export default function Charts() {
  const mapStyleId = useViewOptions((s) => s.mapStyleId);

  return (
    <SheetView id="charts">
      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section>
              {mapStyles.map(({ id, name }) => {
                const image = mapStyleId === id ? "checkmark.circle.fill" : "circle";
                return (
                  <Button
                    key={id}
                    systemImage={image}
                    label={name}
                    onPress={() => setViewOptions({ mapStyleId: id })}
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
