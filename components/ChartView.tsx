import { CameraRefContext } from "@/hooks/useCameraRef";
import { useCameraState } from "@/hooks/useCameraState";
import { useMapView } from "@/hooks/useMapView";
import { useSelectedLocation } from "@/hooks/useSelectedLocation";
import { useSheetHeight, useSheetOffset } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import type { CameraRef, MapRef } from "@maplibre/maplibre-react-native";
import { Camera, Map, Marker, UserLocation } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import CurrentLocationButton from "./CurrentLocationButton";
import HeadsUpDisplay from "./HeadsUpDisplay";
import MenuButton from "./MenuButton";
import TrackOverlay from "./TrackOverlay";
import TrackRecordButton from "./TrackRecordButton";
import ViewOptionsButton from "./ViewOptionsButton";
import ZoomAndScale from "./ZoomAndScale";

export default function ChartView() {
  const viewOptions = useViewOptions();
  const cameraState = useCameraState();
  const mapView = useMapView();
  const selectedLocation = useSelectedLocation();
  const theme = useTheme();
  const sheetHeight = useSheetHeight();
  const sheetOffset = useSheetOffset();
  const mapStyle = mapStyles.find(style => style.id === viewOptions.mapStyleId)?.style || mapStyles[0].style;
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const wasMoving = useRef(false);
  const centering = useRef(false);

  useEffect(() => {
    if (!wasMoving.current && selectedLocation.moving && selectedLocation.coordinates) {
      centering.current = true;
      const { longitude, latitude } = selectedLocation.coordinates;
      cameraRef.current?.easeTo({ center: [longitude, latitude], duration: 300 });
    }
    if (wasMoving.current && !selectedLocation.moving && selectedLocation.coordinates) {
      const { longitude, latitude } = selectedLocation.coordinates;
      mapRef.current?.project([longitude, latitude]).then((point) => {
        mapRef.current?.queryRenderedFeatures(point).then((features) => {
          selectedLocation.select([longitude, latitude], features);
        });
      });
    }
    wasMoving.current = selectedLocation.moving;
  }, [selectedLocation.moving]);

  return <CameraRefContext.Provider value={cameraRef}>
    <Map
      ref={mapRef}
      style={{ flex: 1 }}
      mapStyle={mapStyle}
      touchRotate={false}
      touchPitch={false}
      attribution={false}
      compass={false}
      contentInset={{ bottom: sheetHeight.value }}
      compassPosition={{ top: -2000, right: -2000 }}
      onRegionIsChanging={(e) => {
        mapView.onRegionIsChanging(e.nativeEvent.bearing);
        if (selectedLocation.moving && !centering.current) {
          const { center } = e.nativeEvent;
          selectedLocation.updateCoordinates(center);
        }
      }}
      onRegionDidChange={(e) => {
        const { bearing, bounds, zoom, center } = e.nativeEvent;
        mapView.onRegionDidChange(bearing, bounds, zoom);
        cameraState.saveViewport(center, zoom);
        centering.current = false;
      }}
      onPress={async (e) => {
        const { lngLat, point } = e.nativeEvent;
        const features = await mapRef.current?.queryRenderedFeatures(point) ?? [];
        selectedLocation.select(lngLat, features);
        router.navigate("/location");
      }}
      logo={false}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{
          zoom: cameraState.lastZoom,
          center: cameraState.lastCenter,
        }}
        trackUserLocation={cameraState.trackingMode}
        easing="ease"
        duration={300}
        pitch={0}
        onTrackUserLocationChange={(e) => {
          cameraState.setFollowUserLocation(e.nativeEvent.trackUserLocation !== null);
        }}
      />
      <UserLocation heading />
      <TrackOverlay />
      {selectedLocation.coordinates && (
        <Marker
          id="selected-location"
          lngLat={[selectedLocation.coordinates.longitude, selectedLocation.coordinates.latitude]}
          anchor="bottom"
        >
          <SymbolView name={selectedLocation.moving ? "mappin.and.ellipse" : "mappin"} size={40} tintColor={theme.danger} />
        </Marker>
      )}
    </Map>
    <SafeAreaView style={{ position: "absolute", top: 0, left: 16, right: 16, alignItems: "center" }}>
      <HeadsUpDisplay />
    </SafeAreaView>
    <Animated.View style={[{ position: "absolute", bottom: 0, left: 0, right: 0 }, sheetOffset]}>
      <SafeAreaView style={{ position: "absolute", bottom: 0, left: 16, gap: 16 }}>
        <TrackRecordButton />
        <ViewOptionsButton />
      </SafeAreaView>
      <SafeAreaView style={{ position: "absolute", bottom: 0, right: 16, gap: 16 }}>
        <ZoomAndScale />
        <CurrentLocationButton />
        <MenuButton />
      </SafeAreaView>
    </Animated.View>
  </CameraRefContext.Provider>;
}
