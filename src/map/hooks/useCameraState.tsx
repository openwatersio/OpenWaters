import { persistProxy } from "@/persistProxy";
import * as Haptics from "expo-haptics";
import { proxy, useSnapshot } from "valtio";

interface State {
  followUserLocation: boolean;
  trackingMode: undefined | "default" | "course";
}

export const cameraState = proxy<State>({
  followUserLocation: true,
  trackingMode: "default",
});

persistProxy(cameraState, { name: "camera" });

export function useCameraState() {
  return useSnapshot(cameraState);
}

export function setFollowUserLocation(follow: boolean) {
  if (follow) {
    cameraState.followUserLocation = true;
    cameraState.trackingMode = cameraState.trackingMode ?? "default";
  } else {
    cameraState.followUserLocation = false;
    cameraState.trackingMode = undefined;
  }
}

export function cycleTrackingMode() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (cameraState.followUserLocation && cameraState.trackingMode === "default") {
    cameraState.trackingMode = "course";
  } else {
    cameraState.followUserLocation = true;
    cameraState.trackingMode = "default";
  }
}
