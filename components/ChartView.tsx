import { useCameraPosition } from "@/hooks/useCameraPosition";
import { mapRef } from "@/hooks/useMapRef";
import {
  addRouteWaypoint,
  getActiveRoute,
  RouteMode,
  setActiveIndex
} from "@/hooks/useRoutes";
import { useSelectionHandler } from "@/hooks/useSelection";
import { useMapStyle } from "@/hooks/useCharts";
import { findNearestLegIndex, metersPerPixel } from "@/lib/geo";
import { Images, Map, PressEvent } from "@maplibre/maplibre-react-native";
import { useCallback } from "react";
import { NativeSyntheticEvent } from "react-native";
import AISLayer from "./AISLayer";
import AtoNLayer from "./AtoNLayer";
import MapOverlay from "./MapOverlay";
import MarkerOverlay from "./MarkerOverlay";
import RouteOverlay from "./RouteOverlay";
import TrackOverlay from "./TrackOverlay";
import { handleRegionDidChange, handleRegionIsChanging, NavigationCamera } from "./map/NavigationCamera";
import { NavigationPuck } from "./map/NavigationPuck";
import SelectedLocationAnnotation from "./map/SelectedLocationAnnotation";

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
    const zoom = useCameraPosition.getState().zoom ?? 10;
    const thresholdMeters = metersPerPixel(zoom, lat) * LEG_HIT_PIXELS;

    // Check if near a leg line — insert between waypoints, otherwise append
    const insertIndex = findNearestLegIndex(lat, lon, active.points, thresholdMeters);
    addRouteWaypoint({ latitude: lat, longitude: lon }, insertIndex ?? undefined);
  }, []);

  return <>
    <Map
      ref={mapRef}
      style={{ flex: 1 }}
      mapStyle={mapStyle}
      touchRotate={false}
      touchPitch={false}
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
        "vessel-default": { source: require("@/assets/vessels/png/default.png"), sdf: true },
        "vessel-unknown": { source: require("@/assets/vessels/png/unknown.png"), sdf: true },
        "vessel-cargo": { source: require("@/assets/vessels/png/cargo.png"), sdf: true },
        "vessel-tanker": { source: require("@/assets/vessels/png/tanker.png"), sdf: true },
        "vessel-passenger": { source: require("@/assets/vessels/png/passenger.png"), sdf: true },
        "vessel-sailing": { source: require("@/assets/vessels/png/sailing.png"), sdf: true },
        "vessel-pleasure": { source: require("@/assets/vessels/png/pleasure.png"), sdf: true },
        "vessel-highspeed": { source: require("@/assets/vessels/png/highspeed.png"), sdf: true },
        "vessel-fishing": { source: require("@/assets/vessels/png/fishing.png"), sdf: true },
        "vessel-tug": { source: require("@/assets/vessels/png/tug.png"), sdf: true },
        "nav-puck": { source: require("@/assets/vessels/png/puck.png"), sdf: true },
        "aton-default": { source: require("@/assets/atons/png/default.png"), sdf: true },
        "aton-buoy": { source: require("@/assets/atons/png/buoy.png"), sdf: true },
        "aton-beacon": { source: require("@/assets/atons/png/beacon.png"), sdf: true },
        "aton-lighthouse": { source: require("@/assets/atons/png/lighthouse.png"), sdf: true },
        "aton-virtual": { source: require("@/assets/atons/png/virtual.png"), sdf: true },
      }} />
      <TrackOverlay />
      <MarkerOverlay />
      <RouteOverlay />
      <AISLayer />
      <AtoNLayer />
      <SelectedLocationAnnotation />
      <NavigationPuck />
    </Map>
    <MapOverlay />
  </>;
}
