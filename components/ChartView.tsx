import { useBottomSheetOffset } from "@/hooks/useBottomSheetOffset";
import { CameraRefContext } from "@/hooks/useCameraRef";
import { useCameraState } from "@/hooks/useCameraState";
import { useMapView } from "@/hooks/useMapView";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import { Camera, Map, UserLocation } from "@maplibre/maplibre-react-native";
import { useRef } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import CurrentLocationButton from "./CurrentLocationButton";
import HeadsUpDisplay from "./HeadsUpDisplay";
import TrackOverlay from "./TrackOverlay";
import TrackRecordButton from "./TrackRecordButton";
import TrackSheet from "./TrackSheet";
import ViewOptionsButton from "./ViewOptionsButton";
import ZoomAndScale from "./ZoomAndScale";

export default function ChartView() {
  const viewOptions = useViewOptions();
  const cameraState = useCameraState();
  const mapView = useMapView();
  const bottomSheetOffset = useBottomSheetOffset();
  const mapStyle = mapStyles.find(style => style.id === viewOptions.mapStyleId)?.style || mapStyles[0].style;
  const cameraRef = useRef<CameraRef>(null);

  return <CameraRefContext.Provider value={cameraRef}>
    <Map
      style={{ flex: 1 }}
      mapStyle={mapStyle}
      touchRotate={false}
      touchPitch={false}
      attribution={false}
      compass={false}
      compassPosition={{ top: -2000, right: -2000 }}
      onRegionIsChanging={(e) => mapView.onRegionIsChanging(e.nativeEvent.bearing)}
      onRegionDidChange={(e) => {
        const { bearing, bounds, zoom, center } = e.nativeEvent;
        mapView.onRegionDidChange(bearing, bounds, zoom);
        cameraState.saveViewport(center, zoom);
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
    </Map>
    <SafeAreaView style={{ position: "absolute", top: 0, left: 16, right: 16, alignItems: "center" }}>
      <HeadsUpDisplay />
    </SafeAreaView>
    <SafeAreaView style={{ position: "absolute", top: 0, right: 16, gap: 16 }}>
    </SafeAreaView>
    <SafeAreaView style={{ position: "absolute", top: 0, left: 16, gap: 16 }}>
      <TrackRecordButton />
    </SafeAreaView>
    <Animated.View style={[{ position: "absolute", bottom: 0, left: 0, right: 0 }, bottomSheetOffset]}>
      <SafeAreaView style={{ position: "absolute", bottom: 0, left: 16, gap: 8 }}>
        <ViewOptionsButton />
      </SafeAreaView>
      <SafeAreaView style={{ position: "absolute", bottom: 0, right: 16, gap: 16 }}>
        <ZoomAndScale />
        <CurrentLocationButton />
      </SafeAreaView>
    </Animated.View>
    <View style={{ position: "absolute" }}>
      <TrackSheet />
    </View>
  </CameraRefContext.Provider>;
}
