import useTheme from "@/hooks/useTheme";
import { Stack, router } from "expo-router";
import { Dimensions, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
  onPressTitle?: () => void;
};

export default function SheetHeader({ title, subtitle, onPressTitle }: Props) {
  const theme = useTheme();
  const { width } = Dimensions.get("window");

  return (
    <>
      <Stack.Screen options={{
        headerTitle: () => (
          <View style={{ gap: 2, width: width - 160, alignItems: "center" }}>
            <Text
              numberOfLines={1}
              onPress={onPressTitle}
              style={{ color: theme.textPrimary, fontSize: 20, fontWeight: "700" }}
            >
              {title}
            </Text>
            {subtitle != null && (
              <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 15 }}>
                {subtitle}
              </Text>
            )}
          </View>
        ),
      }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}
