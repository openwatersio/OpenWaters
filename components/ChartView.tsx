import { useCameraState } from "@/hooks/useCameraState";
import { useCameraView } from "@/hooks/useCameraView";
import { mapRef } from "@/hooks/useMapRef";
import { useSheetOffset } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { mapStyles, useViewOptions } from "@/hooks/useViewOptions";
import { useWaypoints } from "@/hooks/useWaypoints";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import { Camera, Map, UserLocation } from "@maplibre/maplibre-react-native";
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import HeadsUpDisplay from "./HeadsUpDisplay";
import { MapControls } from "./MapControls";
import TrackOverlay from "./TrackOverlay";
import WaypointOverlay from "./WaypointOverlay";
import { Annotation } from "./map/Annotation";
import TrackRecordButton from "./map/TrackRecordButton";

export default function ChartView() {
  const mapStyleId = useViewOptions((s) => s.mapStyleId);
  const trackingMode = useCameraState((s) => s.trackingMode);
  const saveViewport = useCameraState((s) => s.saveViewport);
  const setFollowUserLocation = useCameraState((s) => s.setFollowUserLocation);
  const sheetOffset = useSheetOffset();
  const pathname = usePathname();
  const theme = useTheme();
  const mapStyle = mapStyles.find(style => style.id === mapStyleId)?.style || mapStyles[0].style;
  const cameraRef = useRef<CameraRef>(null);

  useEffect(() => {
    useWaypoints.getState().loadWaypoints();
  }, []);

  const { coords } = useGlobalSearchParams<{ coords?: string }>();
  const selectedCoords = useMemo(
    () => coords ? coords.split(",").map(Number) as [number, number] : null,
    [coords]
  );

  const handleDragEnd = useCallback(
    (e: { nativeEvent: { lngLat: [number, number] } }) =>
      router.setParams({ coords: `${e.nativeEvent.lngLat[0]},${e.nativeEvent.lngLat[1]}` }),
    []
  );

  useEffect(() => {
    useCameraView.getState().setCameraRef(cameraRef);
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
      onRegionIsChanging={(e) => {
        useCameraView.getState().onRegionIsChanging(e.nativeEvent.bearing);
      }}
      onRegionDidChange={(e) => {
        const { bearing, bounds, zoom, center } = e.nativeEvent;
        useCameraView.getState().onRegionDidChange(bearing, bounds, zoom);
        saveViewport(center, zoom);
      }}
      onPress={(e) => {
        const { lngLat } = e.nativeEvent;
        const href = { pathname: "/location/[coords]" as const, params: { coords: `${lngLat[0]},${lngLat[1]}` } };
        if (pathname.startsWith("/location/")) {
          router.setParams({ coords: `${lngLat[0]},${lngLat[1]}` });
        } else {
          router.navigate(href);
        }
      }}
      logo={false}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{
          zoom: useCameraState.getState().lastZoom,
          center: useCameraState.getState().lastCenter,
        }}
        trackUserLocation={trackingMode}
        easing="ease"
        duration={300}
        pitch={0}
        onTrackUserLocationChange={(e) => {
          setFollowUserLocation(e.nativeEvent.trackUserLocation !== null);
        }}
      />
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
      <UserLocation heading />
      <TrackOverlay />
      <WaypointOverlay />
    </Map>
    <SafeAreaView style={{ position: "absolute", top: 0, left: 16, right: 16, alignItems: "center" }}>
      <HeadsUpDisplay />
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
