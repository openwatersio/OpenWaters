import useTheme from "@/hooks/useTheme";
import { HStack, Text, VStack } from "@expo/ui/swift-ui";
import { background, cornerRadius, font, foregroundStyle, frame, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";

type Props = {
  label: string;
  value: string;
  unit?: string;
};

export default function Stat({ label, value, unit }: Props) {
  const theme = useTheme();

  return (
    <VStack spacing={2} modifiers={[
      frame({ maxWidth: Infinity }),
      padding({ all: 12 }),
      background(theme.surfaceElevated),
      cornerRadius(12),
    ]}>
      <Text modifiers={[
        font({ size: 12, weight: "semibold" }),
        foregroundStyle(theme.textSecondary),
      ]}>
        {label}
      </Text>
      {unit ? (
        <HStack alignment="firstTextBaseline" spacing={2}>
          <Text modifiers={[
            font({ size: 24, weight: "bold" }),
            monospacedDigit(),
            foregroundStyle(theme.textPrimary),
          ]}>
            {value}
          </Text>
          <Text modifiers={[
            font({ size: 16, weight: "medium" }),
            foregroundStyle(theme.textSecondary),
          ]}>
            {unit}
          </Text>
        </HStack>
      ) : (
        <Text modifiers={[
          font({ size: 24, weight: "bold" }),
          monospacedDigit(),
          foregroundStyle(theme.textPrimary),
        ]}>
          {value}
        </Text>
      )}
    </VStack>
  );
}
