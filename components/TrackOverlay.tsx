import { useCameraState } from "@/hooks/useCameraState";
import { useCameraView } from "@/hooks/useCameraView";
import { useSheetStore } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { subscribeToLocationUpdate, useTrackRecording } from "@/hooks/useTrackRecording";
import { useTracks } from "@/hooks/useTracks";
import { getTrackPoints, Track } from "@/lib/database";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { getBounds } from "geolib";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackLine from "./TrackLine";

type Coord = [longitude: number, latitude: number];

export default function TrackOverlay() {
  const recording = useTrackRecording((s) => s.track);

  return (
    <>
      {recording && <ActiveTrackOverlay track={recording} />}
      <SelectedTrackOverlay />
    </>
  );
}

function ActiveTrackOverlay({ track }: { track: Track }) {
  const theme = useTheme();
  const coordinates = useRef<Coord[]>([]);

  // Load historical coordinates from DB on mount/resume
  useEffect(() => {
    console.log("loading track points for active recording:", track.id);
    getTrackPoints(track.id).then((points) => {
      coordinates.current = points.map((p) => [p.longitude, p.latitude]);
    });
  }, [track]);

  useEffect(() => {
    return subscribeToLocationUpdate((location) => {
      // Append new points as they arrive
      coordinates.current.push([location.coords.longitude, location.coords.latitude]);
    });
  }, [track]);

  const coords = coordinates.current;

  return <TrackLine id="active-track" coords={coords} color={theme.danger} />;
}

function computeBounds(coords: Coord[]): LngLatBounds | null {
  if (coords.length === 0) return null;
  const { minLng, minLat, maxLng, maxLat } = getBounds(coords);
  return [minLng, minLat, maxLng, maxLat];
}

function SelectedTrackOverlay() {
  const theme = useTheme();
  const selectedId = useTracks((s) => s.selectedId);
  const sheetHeight = useSheetStore((s) => {
    const entry = s.sheets["track"];
    return entry?.height ?? 0;
  });
  const cameraRef = useCameraView((s) => s.cameraRef);
  const [coords, setCoords] = useState<Coord[]>([]);
  const insets = useSafeAreaInsets();

  // Load track points when selection changes
  useEffect(() => {
    if (!selectedId) {
      setCoords([]);
      return;
    }
    getTrackPoints(selectedId).then((points) => {
      setCoords(points.map((p) => [p.longitude, p.latitude]));
    });
  }, [selectedId]);

  // Fit camera to track bounds once coords are loaded
  useEffect(() => {
    if (coords.length === 0) return;
    const trackBounds = computeBounds(coords);
    if (!trackBounds) return;
    console.log("Fitting camera to track bounds:", { trackBounds, sheetHeight });
    useCameraState.getState().setFollowUserLocation(false);
    cameraRef?.current?.fitBounds(trackBounds, {
      padding: { top: insets.top + 16, right: 16, bottom: 16 + sheetHeight, left: 16 },
      duration: 300,
    });
  }, [coords, sheetHeight, cameraRef, insets]);

  if (!selectedId) return null;

  return <TrackLine id="selected-track" coords={coords} color={theme.primary} />;
}
