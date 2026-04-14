import useTheme from "@/hooks/useTheme";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

export type ButtonProps = {
  label?: string;
  onPress?: () => void;
  role?: "default" | "cancel" | "destructive";
  systemImage?: SymbolViewProps["name"];
  variant?: "default" | "bordered";
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export default function Button({ label, onPress, systemImage, role, variant = "default", color, style: containerStyle }: ButtonProps) {
  const theme = useTheme();
  const tint = color ?? (role === "destructive" ? theme.danger : theme.primary);
  const foreground = variant === "bordered" ? theme.surface : tint;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        !label && styles.iconOnly,
        variant === "bordered" && { backgroundColor: tint },
        pressed && styles.pressed,
        containerStyle,
      ]}
    >
      {systemImage && <SymbolView name={systemImage} size={18} tintColor={foreground} />}
      {label && <Text style={[styles.label, { color: foreground }]}>
        {label}
      </Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  iconOnly: {
    paddingHorizontal: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
  },
});
