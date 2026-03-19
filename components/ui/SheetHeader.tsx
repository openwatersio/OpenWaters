import useTheme from "@/hooks/useTheme";
import { Stack, StackScreenProps, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Dimensions, Text, View } from "react-native";

type Props = StackScreenProps & {
  title: string;
  subtitle?: string;
  headerLeft?: () => ReactNode;
  headerRight?: () => ReactNode;
};

export default function SheetHeader({ title, subtitle, headerLeft, ...props }: Props) {
  const theme = useTheme();
  const { width } = Dimensions.get("window");
  const router = useRouter();

  return (
    <Stack.Screen options={{
      headerTitle: () => (
        <View style={{ gap: 2, width: width - 160, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "700" }}>
            {title}
          </Text>
          {subtitle != null && (
            <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 13 }}>
              {subtitle}
            </Text>
          )}
        </View>
      ),
      ...(headerLeft != null ? { headerLeft } : {
        unstable_headerRightItems: () => {
          return [
            {
              type: "button",
              label: "Close",
              icon: {
                type: "sfSymbol",
                name: "xmark",
              },
              onPress: () => router.dismiss(),
            }
          ];
        }
      }),
      ...props
    }} />
  );
}
