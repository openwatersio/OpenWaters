import { useCameraState } from "@/hooks/useCameraState";
import { useViewOptions } from "@/hooks/useViewOptions";
import mapStyles from "@/styles";
import { Camera, Map, UserLocation } from "@maplibre/maplibre-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CurrentLocationButton from "./CurrentLocationButton";
import SpeedOverGround from "./SpeedOverGround";
import ViewOptionsButton from "./ViewOptionsButton";
import ZoomAndScale from "./ZoomAndScale";

export default function ChartView() {
  const viewOptions = useViewOptions();
  const cameraState = useCameraState();
  const mapStyle = mapStyles.find(style => style.id === viewOptions.mapStyleId)?.style || mapStyles[0].style;

  return <>
    <Map
      style={{ flex: 1 }}
      mapStyle={mapStyle}
      touchRotate={false}
      touchPitch={false}
      attribution={false}
      onRegionDidChange={(e) => cameraState.didChange(e.nativeEvent)}
    >
      <Camera
        trackUserLocation={cameraState.followUserLocation ? "default" : undefined}
        zoom={cameraState.zoom}
        bounds={cameraState.bounds}
        easing="ease"
        duration={1000}
        bearing={0}
        pitch={0}
        onTrackUserLocationChange={(e) => {
          cameraState.set({ followUserLocation: e.nativeEvent.trackUserLocation !== null });
        }}
      />
      <UserLocation />
    </Map>
    <SafeAreaView style={{ position: "absolute", top: 0, right: 20, zIndex: 1 }}>
      <ZoomAndScale />
    </SafeAreaView>
    <SafeAreaView style={{ position: "absolute", bottom: 0, left: 20, zIndex: 1 }}>
      <ViewOptionsButton />
    </SafeAreaView>
    <SafeAreaView style={{ position: "absolute", bottom: 0, right: 20, zIndex: 1 }}>
      <CurrentLocationButton />
    </SafeAreaView>
    <SafeAreaView style={{ position: "absolute", top: 0, left: 90, right: 90, zIndex: 1, alignItems: "center" }}>
      <SpeedOverGround />
    </SafeAreaView>
  </>;
}
