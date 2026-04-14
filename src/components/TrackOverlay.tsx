import { fitBounds } from "@/components/map/NavigationCamera";
import { useSelection } from "@/hooks/useSelection";
import { useSheetStore } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { subscribeToLocationUpdate, useTrackRecording } from "@/hooks/useTrackRecording";
import { getTrackPoints, Track } from "@/lib/database";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import { getBounds } from "geolib";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrackLine from "./TrackLine";

type Coordinate = [longitude: number, latitude: number];

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
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);

  // Load historical coordinates from DB on mount/resume
  useEffect(() => {
    console.log("loading track points for active recording:", track.id);
    getTrackPoints(track.id).then((points) => {
      setCoordinates(points.map((p) => [p.longitude, p.latitude]));
    });
  }, [track]);

  useEffect(() => {
    return subscribeToLocationUpdate((location) => {
      setCoordinates((prev) => [...prev, [location.coords.longitude, location.coords.latitude]]);
    });
  }, [track]);

  return <TrackLine id="active-track" coordinates={coordinates} color={theme.danger} />;
}

function computeBounds(coords: Coordinate[]): LngLatBounds | null {
  if (coords.length === 0) return null;
  const { minLng, minLat, maxLng, maxLat } = getBounds(coords);
  return [minLng, minLat, maxLng, maxLat];
}

function SelectedTrackOverlay() {
  const theme = useTheme();
  const selection = useSelection();
  const selectedId = selection?.type === "track" ? Number(selection.id) : null;
  const sheetHeight = useSheetStore((s) => {
    const entry = s.sheets["track"];
    return entry?.height ?? 0;
  });
  const [coords, setCoords] = useState<Coordinate[]>([]);
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
    fitBounds(trackBounds, {
      padding: { top: insets.top + 16, right: 16, bottom: 16 + sheetHeight, left: 16 },
      duration: 300,
    });
  }, [coords, sheetHeight, insets]);

  if (!selectedId) return null;

  return <TrackLine id="selected-track" coordinates={coords} color={theme.primary} />;
}
