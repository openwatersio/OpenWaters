import { Button, ButtonProps, Host } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, labelStyle, tint } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

export default function CloseButton(props: ButtonProps = {}) {
  return (
    <Host matchContents>
      <Button
        onPress={() => router.dismiss()}
        systemImage="xmark"
        label="Close"
        modifiers={[
          labelStyle("iconOnly"),
          buttonStyle("borderless"),
          controlSize("extraLarge"),
          tint("primary"),
        ]}
        {...props}
      />
    </Host>
  );
}
