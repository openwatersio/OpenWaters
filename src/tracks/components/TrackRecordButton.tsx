import useTheme from "@/hooks/useTheme";
import { startTrackRecording, useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { Button, Image } from "@expo/ui/swift-ui";
import { frame, glassEffect, glassEffectId } from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";

const NS_ID = "map-controls";

export default function TrackRecordButton() {
  const { isRecording } = useTrackRecording();
  const theme = useTheme();

  if (isRecording) return null;

  return (
    <Button
      onPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        startTrackRecording();
      }}
      modifiers={[
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" }),
        glassEffectId("record", NS_ID),
      ]}
    >
      <Image systemName="circle.fill" size={12} color={theme.danger} />
    </Button>
  );
}
