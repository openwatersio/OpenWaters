import log from "@/logger";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/charts/theme";
import { closeDatabase } from "@/database";
import { ARRIVAL_RADIUS_OPTIONS, describeUnit, getDepthUnits, getDistanceUnits, getSpeedUnits, getTemperatureUnits, setPreferredUnits, usePreferredUnits, type ArrivalRadius } from "@/hooks/usePreferredUnits";
import SheetView from "@/ui/SheetView";
import { Button, Host, List, Picker, Section, Text, Toggle, VStack } from "@expo/ui/swift-ui";
import { tag } from "@expo/ui/swift-ui/modifiers";
import { OfflineManager } from "@maplibre/maplibre-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import { Directory, Paths } from "expo-file-system";
import { hasStartedLocationUpdatesAsync, stopLocationUpdatesAsync } from "expo-location";
import { router, Stack } from "expo-router";
import * as SQLite from "expo-sqlite";
import { Alert } from "react-native";

const logger = log.extend("settings");

function resetAppData() {
  Alert.alert(
    "Reset App Data",
    "This will delete all tracks, routes, markers, downloaded charts, and settings. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          try {
            // Stop active track recording
            const TASK_NAME = "track-recording-location";
            if (await hasStartedLocationUpdatesAsync(TASK_NAME)) {
              await stopLocationUpdatesAsync(TASK_NAME);
            }

            // Close and delete SQLite database
            await closeDatabase();
            await SQLite.deleteDatabaseAsync("app.db");

            // Clear all AsyncStorage (valtio-persisted state)
            await AsyncStorage.clear();

            // Delete downloaded chart files
            const chartsDir = new Directory(Paths.document, "charts");
            if (chartsDir.exists) chartsDir.delete();
            const mbtilesDir = new Directory(Paths.document, "mbtiles");
            if (mbtilesDir.exists) mbtilesDir.delete();

            // Reset MapLibre offline tile cache
            await OfflineManager.resetDatabase();

            // Reload the app
            await reloadAppAsync();
          } catch (error) {
            logger.error("Failed to reset app data:", error);
            Alert.alert("Error", "Failed to reset app data. Please try again.");
          }
        },
      },
    ],
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "day", label: "Day" },
  { value: "dusk", label: "Dusk" },
  { value: "night", label: "Night" },
];

export default function Settings() {
  const { speed, distance, depth, temperature, arrivalRadius, arriveOnCircleOnly } = usePreferredUnits();
  const { preference: themePreference } = useThemePreference();

  return (
    <SheetView id="settings">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section title="Preferred Units">
              <Picker
                label="Speed"
                selection={speed}
                onSelectionChange={(unit) => setPreferredUnits({ speed: unit })}
              >
                {getSpeedUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Distance"
                selection={distance}
                onSelectionChange={(unit) => setPreferredUnits({ distance: unit })}
              >
                {getDistanceUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Depth"
                selection={depth}
                onSelectionChange={(unit) => setPreferredUnits({ depth: unit })}
              >
                {getDepthUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
              <Picker
                label="Temperature"
                selection={temperature}
                onSelectionChange={(unit) => setPreferredUnits({ temperature: unit })}
              >
                {getTemperatureUnits().map((unit) => (
                  <Text key={unit} modifiers={[tag(unit)]}>
                    {describeUnit(unit).plural}
                  </Text>
                ))}
              </Picker>
            </Section>
            <Section title="Chart Theme">
              <Picker
                label="Theme"
                selection={themePreference}
                onSelectionChange={(value) =>
                  setThemePreference(value as ThemePreference)
                }
              >
                {THEME_OPTIONS.map(({ value, label }) => (
                  <Text key={value} modifiers={[tag(value)]}>
                    {label}
                  </Text>
                ))}
              </Picker>
            </Section>
            <Section title="Routes">
              <Picker
                label="Arrival radius"
                selection={String(arrivalRadius)}
                onSelectionChange={(value) =>
                  setPreferredUnits({ arrivalRadius: Number(value) as ArrivalRadius })
                }
              >
                {ARRIVAL_RADIUS_OPTIONS.map((meters) => (
                  <Text key={meters} modifiers={[tag(String(meters))]}>
                    {meters} m
                  </Text>
                ))}
              </Picker>
              <Toggle
                label="Advance on arrival circle only"
                isOn={arriveOnCircleOnly}
                onIsOnChange={(value) =>
                  setPreferredUnits({ arriveOnCircleOnly: value })
                }
              />
            </Section>
            <Section>
              <Button
                systemImage="arrow.down.to.line"
                label="Offline Data"
                onPress={() => router.push("/offline")}
              />
            </Section>
            <Section>
              <Button
                role="destructive"
                systemImage="trash"
                label="Reset App Data"
                onPress={resetAppData}
              />
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
