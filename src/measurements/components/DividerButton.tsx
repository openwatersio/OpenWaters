import { toggleDivider, useDivider } from "@/measurements/useDivider";
import { Button, Image } from "@expo/ui/swift-ui";
import {
  frame,
  glassEffect,
  glassEffectId,
} from "@expo/ui/swift-ui/modifiers";

const NS_ID = "map-controls";

/**
 * Toggle button for the divider tool. Glass-capsule styled to visually
 * group with the other right-edge map controls via Liquid Glass namespace.
 */
export function DividerButton() {
  const { active } = useDivider();

  return (
    <Button
      onPress={toggleDivider}
      modifiers={[
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" }),
        glassEffectId("divider", NS_ID),
      ]}
    >
      <Image systemName={active ? "ruler.fill" : "ruler"} size={17} />
    </Button>
  );
}
