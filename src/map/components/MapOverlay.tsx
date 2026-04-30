import { OfflineStatusButton } from "@/charts/components/OfflineStatusButton";
import { SelectChartButton } from "@/charts/components/SelectChartButton";
import { Compass } from "@/map/components/Compass";
import { FollowLocationButton } from "@/map/components/FollowLocationButton";
import { MenuButton } from "@/map/components/MenuButton";
import { ZoomButtons } from "@/map/components/ZoomButtons";
import InstrumentsOverlay from "@/instruments/components/InstrumentsOverlay";
import { useSheetOffset } from "@/map/hooks/useSheetPosition";
import TrackRecordButton from "@/tracks/components/TrackRecordButton";
import {
  GlassEffectContainer,
  Host,
  Namespace,
  VStack
} from "@expo/ui/swift-ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

export const NS_ID = "map-controls";

export default function MapOverlay() {
  const sheetOffset = useSheetOffset();

  return (
    <>
      <InstrumentsOverlay />
      <Animated.View
        style={[
          { position: "absolute", bottom: 0, left: 0, right: 0 },
          sheetOffset,
        ]}
        pointerEvents="box-none"
      >
        <SafeAreaView
          style={{ flexDirection: "row", justifyContent: "space-between", "alignItems": "flex-end", paddingHorizontal: 16 }}
          pointerEvents="box-none"
        >
          <Host matchContents>
            <Namespace id={NS_ID}>
              <GlassEffectContainer>
                <VStack spacing={16}>
                  <TrackRecordButton />
                  <OfflineStatusButton />
                  <SelectChartButton />
                </VStack>
              </GlassEffectContainer>
            </Namespace>
          </Host>
          <Host matchContents>
            <Namespace id={NS_ID}>
              <GlassEffectContainer>
                <VStack spacing={16} modifiers={[tint("primary")]}>
                  <Compass />
                  <ZoomButtons />
                  <FollowLocationButton />
                  <MenuButton />
                </VStack>
              </GlassEffectContainer>
            </Namespace>
          </Host>
        </SafeAreaView>
      </Animated.View>
    </>
  );
}
