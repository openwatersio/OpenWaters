import { useSheetStore } from "@/hooks/useSheetPosition";
import { useCameraRef } from "@/hooks/useCameraRef";
import { useCameraState } from "@/hooks/useCameraState";
import { useMapView } from "@/hooks/useMapView";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import { useTracks } from "@/hooks/useTracks";
import { addPointRecordedListener } from "@/lib/backgroundLocation";
import { getTrackPoints } from "@/lib/database";
import type { LngLatBounds } from "@maplibre/maplibre-react-native";
import {
  Animated,
  GeoJSONSource,
  Layer,
  LocationManager,
} from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Easing } from "react-native";

const LINE_PAINT = {
  "line-color": "#e53e3e",
  "line-width": 3,
  "line-opacity": 0.8,
};

const LINE_LAYOUT = {
  "line-cap": "round" as const,
  "line-join": "round" as const,
};

// Match the UserLocation puck animation: 1000ms linear
const ANIMATION_DURATION = 1000;

type Coord = [number, number];

/**
 * Clip coordinates to the visible viewport with a generous margin,
 * preserving connectivity by including one point outside each edge.
 */
// TODO: extract this do a lib/utility module, maybe the geo.ts
function clipToViewport(coords: Coord[], bounds: LngLatBounds): Coord[] {
  if (coords.length === 0) return coords;

  const [west, south, east, north] = bounds;
  // Add margin so panning doesn't reveal gaps
  const lngSpan = east - west;
  const latSpan = north - south;
  const marginLng = lngSpan * 0.5;
  const marginLat = latSpan * 0.5;
  const w = west - marginLng;
  const s = south - marginLat;
  const e = east + marginLng;
  const n = north + marginLat;

  function inBounds(c: Coord): boolean {
    return c[0] >= w && c[0] <= e && c[1] >= s && c[1] <= n;
  }

  // Find the range of indices that are visible (plus one neighbor on each side)
  let firstVisible = -1;
  let lastVisible = -1;
  for (let i = 0; i < coords.length; i++) {
    if (inBounds(coords[i])) {
      if (firstVisible === -1) firstVisible = i;
      lastVisible = i;
    }
  }

  if (firstVisible === -1) return []; // nothing in viewport

  // Include one point before and after for line continuity
  const start = Math.max(0, firstVisible - 1);
  const end = Math.min(coords.length - 1, lastVisible + 1);
  return coords.slice(start, end + 1);
}

export default function TrackOverlay() {
  return (
    <>
      <ActiveTrackOverlay />
      <SelectedTrackOverlay />
    </>
  );
}

function ActiveTrackOverlay() {
  const isRecording = useTrackRecording((s) => s.isRecording);
  const activeTrackId = useTrackRecording((s) => s.activeTrackId);
  const bounds = useMapView((s) => s.bounds);

  // All recorded coordinates for the active track
  const allCoordsRef = useRef<Coord[]>([]);
  const [coordVersion, setCoordVersion] = useState(0);

  // Load historical coordinates from DB on mount/resume
  useEffect(() => {
    if (!isRecording || !activeTrackId) {
      allCoordsRef.current = [];
      setCoordVersion(0);
      return;
    }

    getTrackPoints(activeTrackId).then((points) => {
      allCoordsRef.current = points.map((p) => [p.longitude, p.latitude]);
      setCoordVersion((v) => v + 1);
    });
  }, [isRecording, activeTrackId]);

  // Subscribe to new points and append incrementally
  useEffect(() => {
    if (!isRecording) return;

    return addPointRecordedListener((lat, lon) => {
      allCoordsRef.current.push([lon, lat]);
      setCoordVersion((v) => v + 1);
    });
  }, [isRecording]);

  // Build viewport-clipped, smoothed GeoJSON for the static track
  const trackData = useMemo(() => {
    // Touch coordVersion to trigger recalc
    void coordVersion;
    const coords = allCoordsRef.current;
    if (coords.length < 2) return null;

    const visible = bounds ? clipToViewport(coords, bounds) : coords;
    if (visible.length < 2) return null;

    return JSON.stringify({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: visible,
      },
    });
  }, [coordVersion, bounds]);

  // --- Animated tail: bridges last recorded point → current puck position ---
  const animatedCoords = useRef<InstanceType<
    typeof Animated.CoordinatesArray
  > | null>(null);
  const animatedShape = useRef<InstanceType<typeof Animated.GeoJSON> | null>(
    null,
  );
  const [tailReady, setTailReady] = useState(false);

  const getAnchor = useCallback((): Coord | null => {
    const coords = allCoordsRef.current;
    return coords.length > 0 ? coords[coords.length - 1] : null;
  }, []);

  useEffect(() => {
    if (!isRecording) {
      animatedCoords.current = null;
      animatedShape.current = null;
      setTailReady(false);
      return;
    }

    const onLocation = (position: {
      coords: { longitude: number; latitude: number };
    }) => {
      const anchor = getAnchor();
      if (!anchor) return;
      const target: Coord = [
        position.coords.longitude,
        position.coords.latitude,
      ];

      if (!animatedCoords.current) {
        // First location update — create the animated objects
        animatedCoords.current = new Animated.CoordinatesArray([
          anchor,
          target,
        ]);
        animatedShape.current = new Animated.GeoJSON({
          type: "LineString",
          coordinates: animatedCoords.current,
        });
        setTailReady(true);
      }

      animatedCoords.current
        .timing({
          toValue: [anchor, target],
          duration: ANIMATION_DURATION,
          easing: Easing.linear,
        })
        .start();
    };

    LocationManager.addListener(onLocation);
    return () => {
      LocationManager.removeListener(onLocation);
    };
  }, [isRecording, getAnchor]);

  if (!isRecording) return null;

  return (
    <>
      {trackData && (
        <GeoJSONSource id="active-track" data={trackData}>
          <Layer
            id="active-track-line"
            type="line"
            paint={LINE_PAINT}
            layout={LINE_LAYOUT}
          />
        </GeoJSONSource>
      )}
      {tailReady && animatedShape.current && (
        <Animated.GeoJSONSource
          id="active-track-tail"
          data={animatedShape.current}
        >
          <Layer
            id="active-track-tail-line"
            type="line"
            paint={LINE_PAINT}
            layout={LINE_LAYOUT}
          />
        </Animated.GeoJSONSource>
      )}
    </>
  );
}

const SELECTED_LINE_PAINT = {
  "line-color": "#007AFF",
  "line-width": 3,
  "line-opacity": 0.8,
};

function computeBounds(coords: Coord[]): LngLatBounds | null {
  if (coords.length === 0) return null;
  let west = coords[0][0], east = coords[0][0];
  let south = coords[0][1], north = coords[0][1];
  for (const [lng, lat] of coords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return [west, south, east, north];
}

function SelectedTrackOverlay() {
  const selectedId = useTracks((s) => s.selectedId);
  const sheetHeight = useSheetStore((s) => {
    const entry = s.sheets["trackSheet"];
    return entry?.height ?? 0;
  });
  const bounds = useMapView((s) => s.bounds);
  const cameraRef = useCameraRef();
  const [coords, setCoords] = useState<Coord[]>([]);

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
    useCameraState.getState().setFollowUserLocation(false);
    cameraRef.current?.fitBounds(trackBounds, {
      padding: { top: 60, right: 60, bottom: 60 + sheetHeight, left: 60 },
      duration: 300,
    });
  }, [coords, sheetHeight, cameraRef]);

  const trackData = useMemo(() => {
    if (coords.length < 2) return null;
    const visible = bounds ? clipToViewport(coords, bounds) : coords;
    if (visible.length < 2) return null;
    return JSON.stringify({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: visible },
    });
  }, [coords, bounds]);

  if (!selectedId || !trackData) return null;

  return (
    <GeoJSONSource id="selected-track" data={trackData}>
      <Layer
        id="selected-track-line"
        type="line"
        paint={SELECTED_LINE_PAINT}
        layout={LINE_LAYOUT}
      />
    </GeoJSONSource>
  );
}
