import { useCameraState, saveViewport, setFollowUserLocation } from "@/hooks/useCameraState";
import { setCameraRef, onRegionIsChanging, onRegionDidChange } from "@/hooks/useCameraView";
import { mapRef } from "@/hooks/useMapRef";
import { loadMarkers } from "@/hooks/useMarkers";
import { useSelection } from "@/hooks/useSelection";
import { useSheetOffset } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { mapStyles, useViewOptions } from "@/hooks/useViewOptions";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import { Camera, Map, UserLocation } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import HeadsUpDisplay from "./HeadsUpDisplay";
import { MapControls } from "./MapControls";
import MarkerOverlay from "./MarkerOverlay";
import TrackOverlay from "./TrackOverlay";
import { Annotation } from "./map/Annotation";
import TrackRecordButton from "./map/TrackRecordButton";

export default function ChartView() {
  const mapStyleId = useViewOptions((s) => s.mapStyleId);
  const trackingMode = useCameraState((s) => s.trackingMode);
  const selection = useSelection();
  const sheetOffset = useSheetOffset();
  const theme = useTheme();
  const mapStyle = mapStyles.find(style => style.id === mapStyleId)?.style || mapStyles[0].style;
  const cameraRef = useRef<CameraRef>(null);

  useEffect(() => {
    loadMarkers();
  }, []);

  const selectedCoords = selection?.type === "location" ? selection.coords : null;

  const handleDragEnd = useCallback(
    (e: { nativeEvent: { lngLat: [number, number] } }) =>
      router.setParams({ coords: `${e.nativeEvent.lngLat[0]},${e.nativeEvent.lngLat[1]}` }),
    []
  );

  useEffect(() => {
    setCameraRef(cameraRef);
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
        onRegionIsChanging(e.nativeEvent.bearing);
      }}
      onRegionDidChange={(e) => {
        const { bearing, bounds, zoom, center } = e.nativeEvent;
        onRegionDidChange(bearing, bounds, zoom);
        saveViewport(center, zoom);
      }}
      onPress={(e) => {
        const { lngLat } = e.nativeEvent;
        const coords = `${lngLat[0]},${lngLat[1]}`;
        const href = { pathname: "/location/[coords]" as const, params: { coords } };
        if (selection?.type === "location") {
          router.setParams({ coords });
        } else if (selection) {
          router.replace(href);
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
      <MarkerOverlay />
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
