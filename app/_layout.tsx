import "@/lib/backgroundLocation"; // Register background task at module scope
import { CloseButton } from "@/components/CloseButton";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="track/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          // Updated dynamically in component
          sheetAllowedDetents: [0, 0.5],
          sheetGrabberVisible: true,
          headerShown: false,
        }} />
        <Stack.Screen name="ViewOptions" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          title: "View Options",
          headerRight: () => <CloseButton />,
        }} />
        <Stack.Screen name="MainSheet" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.25],
          sheetGrabberVisible: true,
          headerShown: false,
        }} />
        <Stack.Screen name="tracks" options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          title: "Tracks",
          headerRight: () => <CloseButton />,
        }} />
      </Stack>
    </ThemeProvider>
  );
}
