import { OfflineStatusButton } from "@/charts/components/OfflineStatusButton";
import { SelectChartButton } from "@/charts/components/SelectChartButton";
import { useSheetOffset } from "@/map/hooks/useSheetPosition";
import NavigationHUD from "@/navigation/components/NavigationHUD";
import TrackRecordButton from "@/tracks/components/TrackRecordButton";
import { Host, VStack } from "@expo/ui/swift-ui";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapControls } from "./MapControls";

export default function MapOverlay() {
  const sheetOffset = useSheetOffset();

  return (
    <>
      <NavigationHUD />
      <Animated.View style={[{ position: "absolute", bottom: 0, left: 0, right: 0 }, sheetOffset]}>
        <SafeAreaView style={{ position: "absolute", bottom: 0, right: 16, gap: 16 }}>
          <MapControls />
        </SafeAreaView>
        <SafeAreaView style={{ position: "absolute", bottom: 0, left: 16, gap: 16 }}>
          <TrackRecordButton />
          <Host matchContents>
            <VStack spacing={16}>
              <OfflineStatusButton />
              <SelectChartButton />
            </VStack>
          </Host>
        </SafeAreaView>
      </Animated.View>
    </>
  );
}
