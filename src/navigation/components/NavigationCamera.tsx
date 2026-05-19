import { isInsideBounds } from "@/geo";
import { cameraPositionState, saveViewport } from "@/map/hooks/useCameraPosition";
import { cameraState, setFollowUserLocation } from "@/map/hooks/useCameraState";
import { cameraViewState, onRegionDidChange, onRegionIsChanging } from "@/map/hooks/useCameraView";
import { NavigationState, navigationState } from "@/navigation/hooks/useNavigation";
import type { CameraRef, LngLatBounds, ViewPadding, ViewStateChangeEvent } from "@maplibre/maplibre-react-native";
import { Camera } from "@maplibre/maplibre-react-native";
import type { ComponentProps } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Dimensions, type NativeSyntheticEvent } from "react-native";
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
        const { latitude, longitude, course, speed, state } = navigationState;
        if (!followUserLocation || latitude === null || longitude === null) return;

        const padding = state === NavigationState.Underway
          ? lookaheadPadding(course, speed ?? 0, trackingMode)
          : undefined;

        cameraRef.current?.easeTo({
          center: [longitude, latitude],
          bearing: trackingMode === "course" && course !== null
            ? (course * 180) / Math.PI
            : undefined,
          padding,
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
          resetSmoothedCourse();
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

/**
 * Fly to a position only if it falls outside the current camera viewport.
 */
export function ensureVisible(
  position: { latitude: number; longitude: number },
  duration = 600,
) {
  const { bounds } = cameraViewState;
  if (!bounds || !isInsideBounds(position, bounds)) {
    flyTo({ center: [position.longitude, position.latitude], duration });
  }
}

// --- Lookahead ---

/** Fraction of the screen dimension to shift the camera ahead of the user. */
const LOOKAHEAD_RATIO = 0.4;

/**
 * Exponential moving average on sin/cos components of course heading.
 * Smooths out jittery heading changes so the viewport doesn't swing
 * with every GPS update in north-up mode. Using sin/cos avoids the
 * 0°/360° wraparound problem.
 *
 * Alpha ≈ 0.08 means ~12 updates to reach ~63% of a new heading,
 * which at 1 Hz GPS corresponds to roughly a 12 second settling time.
 */
const ALPHA_MIN = 0.05; // near-stationary: very smooth
const ALPHA_MAX = 0.4;  // fast moving: responsive
const SPEED_FOR_MAX_ALPHA = 5; // m/s (~10 knots)

let _smoothSin = 0;
let _smoothCos = 1; // default: north
let _smoothInitialized = false;

function smoothCourse(course: number, speed: number): number {
  const sinC = Math.sin(course);
  const cosC = Math.cos(course);

  if (!_smoothInitialized) {
    _smoothSin = sinC;
    _smoothCos = cosC;
    _smoothInitialized = true;
  } else {
    const t = Math.min(speed / SPEED_FOR_MAX_ALPHA, 1);
    const alpha = ALPHA_MIN + t * (ALPHA_MAX - ALPHA_MIN);
    _smoothSin += alpha * (sinC - _smoothSin);
    _smoothCos += alpha * (cosC - _smoothCos);
  }

  return Math.atan2(_smoothSin, _smoothCos);
}

/** Reset the smoothed heading when follow mode is re-engaged. */
function resetSmoothedCourse() {
  _smoothInitialized = false;
}

/**
 * Compute viewport padding that biases the camera ahead of the user's
 * direction of travel, placing the location puck roughly in the trailing
 * third of the screen.
 *
 * In "course" mode the map rotates with heading, so "ahead" is always the
 * top of the screen → constant top padding. In "default" (north-up) mode,
 * the smoothed heading is decomposed into screen-space padding via sin/cos.
 */
function lookaheadPadding(
  course: number | null,
  speed: number,
  trackingMode: "default" | "course" | undefined,
): ViewPadding | undefined {
  if (course === null) return undefined;

  const { width, height } = Dimensions.get("window");

  if (trackingMode === "course") {
    return { top: height * LOOKAHEAD_RATIO };
  }

  // North-up: project smoothed course onto screen axes.
  // Use height for vertical padding, width for horizontal.
  const smoothed = smoothCourse(course, speed);
  const sinC = Math.sin(smoothed);
  const cosC = Math.cos(smoothed);

  return {
    top: Math.max(0, cosC) * height * LOOKAHEAD_RATIO,
    bottom: Math.max(0, -cosC) * height * LOOKAHEAD_RATIO,
    right: Math.max(0, sinC) * width * LOOKAHEAD_RATIO,
    left: Math.max(0, -sinC) * width * LOOKAHEAD_RATIO,
  };
}
