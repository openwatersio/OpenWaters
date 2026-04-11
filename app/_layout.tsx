import { connectAll, disconnectAll } from "@/hooks/useConnections";
import "@/hooks/useNavigation"; // Register LocationManager listener at module scope
import "@/hooks/useTrackRecording"; // Register background task at module scope
import { LocationManager } from "@maplibre/maplibre-react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Stop native location updates before JS runtime tears down on reload,
  // preventing a crash in the MapLibre turbo module event emitter.
  useEffect(() => {
    return () => {
      LocationManager.removeAllListeners();
    };
  }, []);

  // Auto-connect saved instrument connections on launch
  useEffect(() => {
    connectAll();
    return () => disconnectAll();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="activity" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          // Updated dynamically by DetentProvider
          sheetAllowedDetents: [0],
          sheetGrabberVisible: true,
          headerShown: false,
        }} />
        <Stack.Screen name="charts/index" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          title: "Charts",
        }} />
        <Stack.Screen name="charts/add" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          title: "Add Chart Source",
        }} />
        <Stack.Screen name="charts/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          title: "Edit Chart Source",
        }} />
        <Stack.Screen name="settings" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          title: "Settings",
        }} />
        <Stack.Screen name="feature/[type]/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0, 0.3, 0.5, 1],
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="menu" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.5],
          sheetGrabberVisible: true,
          headerShown: false,
        }} />
        <Stack.Screen name="tracks/index" options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          title: "Tracks",
        }} />
        <Stack.Screen name="routes/index" options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          title: "Routes",
        }} />
        <Stack.Screen name="route/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          // Updated dynamically by DetentProvider
          sheetAllowedDetents: [0.1, 0.5, 1],
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="route/new" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          // Updated dynamically by DetentProvider
          sheetAllowedDetents: [0.1, 0.5, 1],
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="markers/index" options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetExpandsWhenScrolledToEdge: true,
          title: "Markers",
        }} />
        <Stack.Screen name="marker/edit" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [0.6],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="connection/[id]" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
        }} />
        <Stack.Screen name="connections" options={{
          presentation: "formSheet",
          sheetLargestUndimmedDetentIndex: "last",
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          title: "Connections",
        }} />
      </Stack>
    </ThemeProvider>
  );
}
