import TrackRecordingStats from "@/components/tracks/TrackRecordingStats";
import { Detent } from "@/components/ui/Detent";
import SheetView from "@/components/ui/SheetView";
import { startTrackRecording, stopTrackRecording, useTrackRecording } from "@/hooks/useTrackRecording";
import { Button, Host } from "@expo/ui/swift-ui";
import { buttonStyle, controlSize, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

export default function RecordScreen() {
  const { isRecording } = useTrackRecording();

  // Start recording if not already active
  useEffect(() => {
    if (!isRecording) {
      startTrackRecording();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SheetView id="record" gap={16}>
      <Detent style={{ padding: 12, paddingTop: 14 }}>
        <Host matchContents modifiers={[padding({ all: 12, top: 14 })]}>
          <TrackRecordingStats />
        </Host>
      </Detent>
      <Detent>
        <Host matchContents modifiers={[padding({ all: 16 })]}>
          <Button
            label="Stop"
            systemImage="stop.fill"
            modifiers={[
              buttonStyle("borderedProminent"),
              controlSize("large"),
              frame({ maxWidth: Infinity }),
            ]}
            role="destructive"
            onPress={confirmStop}
          />
        </Host>
      </Detent>
    </SheetView >
  );
}

const confirmStop = () => {
  Alert.alert("Stop Track?", "Do you want to stop this track?", [
    {
      text: "Stop", style: "destructive", onPress: () => {
        stopTrackRecording();
        router.back();
      }
    },
    { text: "Cancel", style: "cancel" },
  ]);
};
