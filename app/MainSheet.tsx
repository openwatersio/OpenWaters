import { useSheetReporter } from "@/hooks/useSheetPosition";
import { Button, Host, List, Section } from "@expo/ui/swift-ui";
import { router } from "expo-router";
import { View } from "react-native";

export default function MainSheet() {
  const { onLayout, ref } = useSheetReporter("main");

  return (
    <View ref={ref} onLayout={onLayout} style={{ flex: 1 }}>
      <Host style={{ flex: 1 }}>
        <List>
          <Section>
            <Button
              systemImage="point.bottomleft.forward.to.arrow.triangle.scurvepath"
              label="Tracks"
              onPress={() => router.push("/tracks")}
            />
          </Section>
          <Section>
            <Button
              systemImage="square.3.layers.3d"
              label="View Options"
              onPress={() => router.push("/ViewOptions")}
            />
          </Section>
        </List>
      </Host>
    </View>
  );
}
