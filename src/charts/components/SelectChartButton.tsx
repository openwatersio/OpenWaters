import { Button } from "@expo/ui/swift-ui";
import {
  frame,
  glassEffect,
  glassEffectId,
  labelStyle
} from "@expo/ui/swift-ui/modifiers";
import { router, usePathname } from "expo-router";

const NS_ID = "map-controls";

export function SelectChartButton() {
  const isOpen = usePathname() === "/charts/select";

  return (
    <Button
      label="Chart Options"
      systemImage={"square.3.layers.3d"}
      modifiers={[
        labelStyle("iconOnly"),
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" }),
        glassEffectId("chart-type", NS_ID),
      ]}
      onPress={() => (isOpen ? router.dismiss() : router.push("/charts/select"))}
    />
  );
}
