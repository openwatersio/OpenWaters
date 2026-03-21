import { mapRef } from "@/hooks/useMapRef";
import { loadMarkers } from "@/hooks/useMarkers";
import { addDraftPoint, insertDraftPointAt, useRouteDraft } from "@/hooks/useRouteDraft";
import { useSelection, useSelectionHandler } from "@/hooks/useSelection";
import { useSheetOffset } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { mapStyles, useViewOptions } from "@/hooks/useViewOptions";
import { getDistance } from "geolib";
import { Images, Map } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { Fragment, useCallback, useEffect } from "react";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import AISLayer from "./AISLayer";
import AtoNLayer from "./AtoNLayer";
import { MapControls } from "./MapControls";
import MarkerOverlay from "./MarkerOverlay";
import NavigationHUD from "./NavigationHUD";
import RouteOverlay from "./RouteOverlay";
import TrackOverlay from "./TrackOverlay";
import { Annotation } from "./map/Annotation";
import { NavigationCamera, handleRegionDidChange, handleRegionIsChanging } from "./map/NavigationCamera";
import { NavigationPuck } from "./map/NavigationPuck";
import TrackRecordButton from "./map/TrackRecordButton";

/**
 * Find the index of the leg segment closest to a point.
 * Returns the index to insert at (i.e. after points[index-1], before points[index]),
 * or null if no leg is within the threshold.
 */
function findNearestLegIndex(
  lat: number,
  lon: number,
  points: { latitude: number; longitude: number }[],
  thresholdMeters: number,
): number | null {
  if (points.length < 2) return null;

  let bestDist = Infinity;
  let bestIndex: number | null = null;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    // Project point onto segment using simple lat/lon interpolation
    const dx = b.longitude - a.longitude;
    const dy = b.latitude - a.latitude;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = Math.max(0, Math.min(1, ((lon - a.longitude) * dx + (lat - a.latitude) * dy) / lenSq));
    const projLat = a.latitude + t * dy;
    const projLon = a.longitude + t * dx;
    const dist = getDistance({ latitude: lat, longitude: lon }, { latitude: projLat, longitude: projLon });
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i + 1; // insert after point i
    }
  }

  return bestDist <= thresholdMeters ? bestIndex : null;
}

export default function ChartView() {
  const mapStyleId = useViewOptions((s) => s.mapStyleId);
  const selection = useSelection();
  const sheetOffset = useSheetOffset();
  const theme = useTheme();
  const mapStyle = mapStyles.find(style => style.id === mapStyleId)?.style || mapStyles[0].style;

  useEffect(() => {
    loadMarkers();
  }, []);

  const navigate = useSelectionHandler();
  const draftActive = useRouteDraft((s) => s.points.length > 0);
  const selectedCoords = selection?.type === "location"
    ? selection.id.split(",").map(Number) as [number, number]
    : null;

  const handleLongPress = useCallback((e: { nativeEvent: { lngLat: [number, number] } }) => {
    const points = useRouteDraft.getState().points;
    if (points.length === 0) return;

    const [lon, lat] = e.nativeEvent.lngLat;

    // Check if near a leg line — insert between waypoints
    const insertIndex = findNearestLegIndex(lat, lon, points, 500);
    if (insertIndex !== null) {
      insertDraftPointAt(insertIndex, { latitude: lat, longitude: lon });
    } else {
      // Append to end
      addDraftPoint({ latitude: lat, longitude: lon });
    }
  }, []);

  const handleDragEnd = useCallback(
    (e: { nativeEvent: { lngLat: [number, number] } }) =>
      router.setParams({ id: `${e.nativeEvent.lngLat[0]},${e.nativeEvent.lngLat[1]}` }),
    []
  );

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
      onLongPress={draftActive ? handleLongPress : undefined}
      onPress={(e) => {
        const { lngLat } = e.nativeEvent;
        navigate("location", `${lngLat[0]},${lngLat[1]}`);
      }}
      logo={false}
    >
      <NavigationCamera />
      {selectedCoords && (
        <Annotation
          id="selected-location"
          lngLat={selectedCoords}
          icon="mappin"
          color={theme.danger}
          selected
          draggable
          onDragEnd={handleDragEnd}
        />
      )}
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
      <Fragment key={mapStyleId}>
        <TrackOverlay />
        <MarkerOverlay />
        <RouteOverlay />
        <AISLayer />
        <AtoNLayer />
        <NavigationPuck />
      </Fragment>
    </Map>
    <SafeAreaView style={{ position: "absolute", top: 0, left: 16, right: 16, alignItems: "center" }}>
      <NavigationHUD />
    </SafeAreaView>
    <Animated.View style={[{ position: "absolute", bottom: 0, left: 0, right: 0 }, sheetOffset]}>
      <SafeAreaView style={{ position: "absolute", bottom: 0, right: 16, gap: 16 }}>
        <MapControls />
      </SafeAreaView>
      <SafeAreaView style={{ position: "absolute", bottom: 0, left: 16, gap: 16 }}>
        <TrackRecordButton />
      </SafeAreaView>
    </Animated.View>
  </>;
}
