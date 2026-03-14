import "@/lib/backgroundLocation"; // Register background task at module scope
import { router, Stack } from "expo-router";
import { Button } from 'react-native';

export default function RootLayout() {
  return (
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
        sheetAllowedDetents: [0.5, 1],
        sheetGrabberVisible: true,
        title: "View Options",
        headerRight: () => (
          <Button title="Done" onPress={() => router.dismiss()} />
        ),
      }} />
      <Stack.Screen name="Tracks" options={{
        presentation: "formSheet",
        sheetAllowedDetents: [0.5, 1],
        sheetGrabberVisible: true,
        sheetExpandsWhenScrolledToEdge: true,
        title: "Tracks",
        headerRight: () => (
          <Button title="Done" onPress={() => router.dismiss()} />
        ),
      }} />
    </Stack>
  );
}
