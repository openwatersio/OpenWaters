import { stopNavigation } from "@/routes/hooks/useRoutes";
import {
  stopTrackRecording,
  trackRecordingState,
} from "@/tracks/hooks/useTrackRecording";
import * as Haptics from "expo-haptics";
import { ActionSheetIOS, Alert } from "react-native";

export function showRouteActions() {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: "Route Navigation",
      options: ["Stop Route", "Cancel"],
      destructiveButtonIndex: 0,
      cancelButtonIndex: 1,
    },
    (index) => {
      if (index === 0) confirmStopRoute();
    },
  );
}

function confirmStopRoute() {
  Alert.alert(
    "Stop Route?",
    "Do you want to stop this route?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Stop",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          stopNavigation();
          if (trackRecordingState.isRecording) {
            stopTrackRecording();
          }
        },
      },
    ],
    { cancelable: false },
  );
}
