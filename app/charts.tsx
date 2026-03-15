import { useSheetReporter } from "@/hooks/useSheetPosition";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import { Button, Host, List, Section, VStack } from "@expo/ui/swift-ui";
import { View } from "react-native";

export default function Charts() {
  const viewOptions = useViewOptions();
  const { onLayout: onSheetLayout } = useSheetReporter("charts");

  return (
    <View style={{ flex: 1 }} onLayout={onSheetLayout}>
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
    </View>
  );
}
