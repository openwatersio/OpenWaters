import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  monospacedDigit,
  textCase,
} from "@expo/ui/swift-ui/modifiers";
import { ReactNode } from "react";

export type StatItemProps = {
  value: string | ReactNode;
  label?: string;
  suffix?: string;
  alignment?: "leading" | "center" | "trailing"
}

export function StatItem({ label, value, suffix, alignment = "leading" }: StatItemProps) {
  return (
    <VStack alignment={alignment} spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment })]}>
      <HStack alignment="firstTextBaseline" spacing={1}>
        {typeof value === "string" ? (
          <Text
            modifiers={[
              font({ size: 24, weight: "semibold" }),
              monospacedDigit(),
            ]}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {suffix && (
          <Text modifiers={[
            textCase("uppercase"),
            font({ size: 14 })
          ]}>
            {suffix}
          </Text>
        )}
      </HStack>
      {label && <Text
        modifiers={[
          textCase("uppercase"),
          font({ size: 13 }),
          foregroundStyle({ type: "hierarchical", style: "secondary" }),
        ]}
      >
        {label}
      </Text>
      }
    </VStack>
  );
}
