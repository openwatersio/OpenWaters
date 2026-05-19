import AISLayer from "@/ais/components/AISLayer";
import AtoNLayer from "@/aton/components/AtoNLayer";
import { DownloadRegionOverlay } from "@/charts/components/DownloadRegionOverlay";
import { useMapStyle } from "@/charts/hooks/useCharts";
import { findNearestLegIndex, metersPerPixel } from "@/geo";
import { cameraPositionState } from "@/map/hooks/useCameraPosition";
import { mapRef } from "@/map/hooks/useMapRef";
import { useSelectionHandler } from "@/map/hooks/useSelection";
import MarkerOverlay from "@/markers/components/MarkerOverlay";
import { DividerGesture } from "@/measurements/components/DividerGesture";
import { DividerOverlay } from "@/measurements/components/DividerOverlay";
import { RangeRings } from "@/measurements/components/RangeRings";
import { handleRegionDidChange, handleRegionIsChanging, NavigationCamera } from "@/navigation/components/NavigationCamera";
import { NavigationPuck } from "@/navigation/components/NavigationPuck";
import RouteOverlay from "@/routes/components/RouteOverlay";
import {
  addRouteWaypoint,
  getActiveRoute,
  RouteMode,
  setActiveIndex
} from "@/routes/hooks/useRoutes";
import TrackOverlay from "@/tracks/components/TrackOverlay";
import { Images, Map, PressEvent } from "@maplibre/maplibre-react-native";
import { useCallback } from "react";
import { LogBox, NativeSyntheticEvent } from "react-native";
import { MARKER_IMAGES } from "./AnnotationIcon";
import MapOverlay from "./MapOverlay";
import SelectedLocationAnnotation from "./SelectedLocationAnnotation";

// Downgrade expected MapLibre network errors from red overlay to warnings.
LogBox.ignoreLogs([
  "Internet connection appears to be offline",
  "HTTP status code 429",
]);

export default function ChartView() {
  const mapStyle = useMapStyle();
  const navigate = useSelectionHandler();

  const handlePress = useCallback((e: NativeSyntheticEvent<PressEvent>) => {
    const { lngLat } = e.nativeEvent;
    const active = getActiveRoute();
    if (active?.mode === RouteMode.Editing && active?.activeIndex != null) {
      setActiveIndex(null);
    } else {
      navigate("location", lngLat.join(','));
    }
  }, [navigate]);

  const handleLongPress = useCallback((e: NativeSyntheticEvent<PressEvent>) => {
    const [lon, lat] = e.nativeEvent.lngLat;

    // Only add waypoints when a route is loaded (not while navigating).
    // `addRouteWaypoint` flips mode to "editing" implicitly.
    const active = getActiveRoute();
    if (!active || active.mode === RouteMode.Navigating) return;

    // Scale the leg-hit threshold with zoom so it's always ~LEG_HIT_PIXELS
    // of screen slop regardless of how zoomed in/out the map is.
    const LEG_HIT_PIXELS = 44;
    const zoom = cameraPositionState.zoom ?? 10;
    const thresholdMeters = metersPerPixel(zoom, lat) * LEG_HIT_PIXELS;

    // Check if near a leg line — insert between waypoints, otherwise append
    const insertIndex = findNearestLegIndex(lat, lon, active.points, thresholdMeters);
    addRouteWaypoint({ latitude: lat, longitude: lon }, insertIndex ?? undefined);
  }, []);

  return <>
    <DividerGesture>
      <Map
        ref={mapRef}
        style={{ flex: 1 }}
        mapStyle={mapStyle}
        touchRotate={false}
        touchPitch={false}
        dragMinimumPressDuration={0}
        attribution={false}
        compass={false}
        compassPosition={{ top: -2000, right: -2000 }}
        onRegionIsChanging={handleRegionIsChanging}
        onRegionDidChange={handleRegionDidChange}
        onLongPress={handleLongPress}
        onPress={handlePress}
        logo={false}
      >
        <NavigationCamera />
        <Images images={{
          "vessel-default": { source: require("@/assets/map/png/vessel-default.png"), sdf: true },
          "vessel-unknown": { source: require("@/assets/map/png/vessel-unknown.png"), sdf: true },
          "vessel-cargo": { source: require("@/assets/map/png/vessel-cargo.png"), sdf: true },
          "vessel-tanker": { source: require("@/assets/map/png/vessel-tanker.png"), sdf: true },
          "vessel-passenger": { source: require("@/assets/map/png/vessel-passenger.png"), sdf: true },
          "vessel-sailing": { source: require("@/assets/map/png/vessel-sailing.png"), sdf: true },
          "vessel-pleasure": { source: require("@/assets/map/png/vessel-pleasure.png"), sdf: true },
          "vessel-highspeed": { source: require("@/assets/map/png/vessel-highspeed.png"), sdf: true },
          "vessel-fishing": { source: require("@/assets/map/png/vessel-fishing.png"), sdf: true },
          "vessel-tug": { source: require("@/assets/map/png/vessel-tug.png"), sdf: true },
          "nav-puck": { source: require("@/assets/map/png/vessel-puck.png"), sdf: true },
          "divider-scope": { source: require("@/assets/map/png/divider-scope.png"), sdf: true },
          "aton-default": { source: require("@/assets/map/png/aton-default.png"), sdf: true },
          ...MARKER_IMAGES,
        }} />
        <RangeRings />
        <TrackOverlay />
        <RouteOverlay />
        <DividerOverlay />
        <MarkerOverlay />
        <AISLayer />
        <AtoNLayer />
        <SelectedLocationAnnotation />
        <NavigationPuck />
      </Map>
    </DividerGesture>
    <DownloadRegionOverlay />
    <MapOverlay />
  </>;
}
