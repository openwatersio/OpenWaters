import { Button, HStack, Image, Spacer, Text } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

export type NavigationLinkProps = {
  label: string;
  destination: Parameters<typeof router.push>[0];
};

export function NavigationLink({ destination, label }: NavigationLinkProps) {
  return (
    <Button onPress={() => router.push(destination)}>
      <HStack>
        <Text modifiers={[foregroundStyle("primary")]}>
          {label}
        </Text>
        <Spacer />
        <Image systemName="chevron.right" size={13} color="secondary" />
      </HStack>
    </Button>

  );
}
