import useTheme from "@/hooks/useTheme";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { Dimensions, Text, View } from "react-native";
import CloseButton from "./CloseButton";

type Props = {
  title: string;
  subtitle?: string;
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
};

export default function SheetHeader({ title, subtitle, headerLeft, headerRight }: Props) {
  const theme = useTheme();
  const { width } = Dimensions.get("window");

  return (
    <Stack.Screen options={{
      headerTitle: () => (
        <View style={{ gap: 2, width: width - 160, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "700" }}>
            {title}
          </Text>
          {subtitle != null && (
            <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 15 }}>
              {subtitle}
            </Text>
          )}
        </View>
      ),
      headerLeft,
      headerRight: headerRight ?? (() => <CloseButton />),
    }} />
  );
}
