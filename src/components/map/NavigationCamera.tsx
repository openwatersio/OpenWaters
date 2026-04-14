import { saveViewport, useCameraPosition } from "@/hooks/useCameraPosition";
import { setFollowUserLocation, useCameraState } from "@/hooks/useCameraState";
import { onRegionDidChange, onRegionIsChanging, useCameraView } from "@/hooks/useCameraView";
import { useNavigation } from "@/hooks/useNavigation";
import type { CameraRef, LngLatBounds, ViewStateChangeEvent } from "@maplibre/maplibre-react-native";
import { Camera } from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { NativeSyntheticEvent } from "react-native";

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
      const unsubNav = useNavigation.subscribe((nav) => {
        const { followUserLocation, trackingMode } = useCameraState.getState();
        if (!followUserLocation || nav.latitude === null || nav.longitude === null) return;

        cameraRef.current?.easeTo({
          center: [nav.longitude, nav.latitude],
          bearing: trackingMode === "course" && nav.course !== null
            ? (nav.course * 180) / Math.PI
            : undefined,
          duration: 1000,
          easing: "linear",
        });
      });

      const unsubCamera = useCameraState.subscribe((state, prev) => {
        if (state.trackingMode === "default" && prev.trackingMode !== "default") {
          resetNorth();
        }

        if (state.followUserLocation && !prev.followUserLocation) {
          const nav = useNavigation.getState();
          if (nav.latitude !== null && nav.longitude !== null) {
            cameraRef.current?.easeTo({
              center: [nav.longitude, nav.latitude],
              duration: 1000,
              easing: "linear",
            });
          }
        }
      });

      return () => {
        unsubNav();
        unsubCamera();
      };
    }, []);

    return (
      <Camera
        ref={cameraRef}
        initialViewState={useCameraPosition.getState()}
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
  const { zoom } = useCameraView.getState();
  _cameraRef.current?.zoomTo(zoom + 1, { duration: 300 });
}

export function zoomOut() {
  const { zoom } = useCameraView.getState();
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
