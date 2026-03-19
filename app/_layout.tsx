import CloseButton from "@/components/ui/CloseButton";
import "@/hooks/useTrackRecording"; // Register background task at module scope
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="track/record" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          // Updated dynamically,
          sheetAllowedDetents: [0],
          sheetGrabberVisible: true,
          headerShown: false,
        }} />
        <Stack.Screen name="track/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.15, 0.5, 1],
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="charts" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          title: "Charts",
          headerRight: () => <CloseButton />,
        }} />
        <Stack.Screen name="settings" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          title: "Settings",
          headerRight: () => <CloseButton />,
        }} />
        <Stack.Screen name="location/[coords]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.3, 0.5],
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="MainSheet" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5],
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
          headerLargeTitleEnabled: true,
          // headerRight: () => <CloseButton />,
        }} />
        <Stack.Screen name="waypoints/index" options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          title: "Waypoints",
          headerLargeTitleEnabled: true,
        }} />
        <Stack.Screen name="waypoint/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.4, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="waypoint/new" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.6, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="waypoint/edit" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.6],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }} />
      </Stack>
    </ThemeProvider>
  );
}
