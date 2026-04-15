import { cameraPositionState, saveViewport } from "@/map/hooks/useCameraPosition";
import { cameraState, setFollowUserLocation } from "@/map/hooks/useCameraState";
import { cameraViewState, onRegionDidChange, onRegionIsChanging } from "@/map/hooks/useCameraView";
import { navigationState } from "@/navigation/hooks/useNavigation";
import type { CameraRef, LngLatBounds, ViewStateChangeEvent } from "@maplibre/maplibre-react-native";
import { Camera } from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { NativeSyntheticEvent } from "react-native";
import { subscribe } from "valtio";
import { subscribeKey } from "valtio/utils";

/** Module-scoped camera ref accessible by exported imperative functions */
let _cameraRef: React.RefObject<CameraRef | null> = { current: null };

type NavigationCameraProps = Omit<
  ComponentProps<typeof Camera>,
  "trackUserLocation" | "onTrackUserLocationChange" | "center" | "bearing"
>;

/**
 * Drop-in replacement for MapLibre's Camera that follows the unified
 * navigation position via reactive props. The native Camera component
 * handles animation lifecycle internally, smoothly redirecting in-flight
 * animations when the target changes.
 */
export const NavigationCamera = forwardRef<CameraRef, NavigationCameraProps>(
  function NavigationCamera(props, ref) {
    const cameraRef = useRef<CameraRef>(null);

    useImperativeHandle(ref, () => cameraRef.current!, []);

    useEffect(() => {
      _cameraRef = cameraRef;
    }, []);

    // Follow user location imperatively to avoid re-renders on every GPS tick
    useEffect(() => {
      const unsubNav = subscribe(navigationState, () => {
        const { followUserLocation, trackingMode } = cameraState;
        const { latitude, longitude, course } = navigationState;
        if (!followUserLocation || latitude === null || longitude === null) return;

        cameraRef.current?.easeTo({
          center: [longitude, latitude],
          bearing: trackingMode === "course" && course !== null
            ? (course * 180) / Math.PI
            : undefined,
          duration: 1000,
          easing: "linear",
        });
      });

      // (state, prev) Zustand idiom → subscribeKey per field with captured prev.
      let prevTrackingMode = cameraState.trackingMode;
      const unsubTracking = subscribeKey(cameraState, "trackingMode", (next) => {
        if (next === "default" && prevTrackingMode !== "default") resetNorth();
        prevTrackingMode = next;
      });

      let prevFollow = cameraState.followUserLocation;
      const unsubFollow = subscribeKey(cameraState, "followUserLocation", (next) => {
        if (next && !prevFollow) {
          const { latitude, longitude } = navigationState;
          if (latitude !== null && longitude !== null) {
            cameraRef.current?.easeTo({
              center: [longitude, latitude],
              duration: 1000,
              easing: "linear",
            });
          }
        }
        prevFollow = next;
      });

      return () => {
        unsubNav();
        unsubTracking();
        unsubFollow();
      };
    }, []);

    return (
      <Camera
        ref={cameraRef}
        initialViewState={{ ...cameraPositionState }}
        pitch={0}
        {...props}
      />
    );
  },
);

// --- Map event handlers ---

/** Handler for Map's onRegionIsChanging event */
export function handleRegionIsChanging(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
  const { bearing, userInteraction } = e.nativeEvent;
  onRegionIsChanging(bearing);
  if (userInteraction) setFollowUserLocation(false);
}

/** Handler for Map's onRegionDidChange event */
export function handleRegionDidChange(e: NativeSyntheticEvent<ViewStateChangeEvent>) {
  const { bearing, bounds, zoom, center, userInteraction } = e.nativeEvent;
  onRegionDidChange(bearing, bounds, zoom);
  saveViewport(center, zoom);
  if (userInteraction) setFollowUserLocation(false);
}

// --- Imperative camera actions ---

export function zoomIn() {
  const { zoom } = cameraViewState;
  _cameraRef.current?.zoomTo(zoom + 1, { duration: 300 });
}

export function zoomOut() {
  const { zoom } = cameraViewState;
  _cameraRef.current?.zoomTo(zoom - 1, { duration: 300 });
}

export function resetNorth() {
  _cameraRef.current?.setStop({ bearing: 0, duration: 300 });
}

export function fitBounds(
  bounds: LngLatBounds,
  options?: Parameters<CameraRef["fitBounds"]>[1],
) {
  setFollowUserLocation(false);
  _cameraRef.current?.fitBounds(bounds, options);
}

export function flyTo(
  options: Parameters<CameraRef["flyTo"]>[0],
) {
  setFollowUserLocation(false);
  _cameraRef.current?.flyTo(options);
}
