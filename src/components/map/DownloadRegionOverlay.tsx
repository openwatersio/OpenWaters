import { useDownloadOverlay } from "@/hooks/useDownloadOverlay";
import { useTopSheetHeight } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

const PADDING = 8;
const BORDER_RADIUS = 16;

export function DownloadRegionOverlay() {
  const visible = useDownloadOverlay((s) => s.visible);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const sheetHeight = useTopSheetHeight();

  if (!visible) return null;

  const { width: W, height: H } = Dimensions.get("window");
  const rectX = PADDING;
  const rectY = insets.top + PADDING;
  const rectW = W - PADDING * 2;
  const rectH = H - rectY - sheetHeight - PADDING;
  const r = BORDER_RADIUS;

  // Outer rect (full screen) + inner rounded rect (hole), evenodd fills the difference
  const path = [
    // Outer rectangle (clockwise)
    `M0,0 H${W} V${H} H0 Z`,
    // Inner rounded rectangle (counter-clockwise for evenodd cutout)
    `M${rectX + r},${rectY}`,
    `H${rectX + rectW - r}`,
    `A${r},${r} 0 0 1 ${rectX + rectW},${rectY + r}`,
    `V${rectY + rectH - r}`,
    `A${r},${r} 0 0 1 ${rectX + rectW - r},${rectY + rectH}`,
    `H${rectX + r}`,
    `A${r},${r} 0 0 1 ${rectX},${rectY + rectH - r}`,
    `V${rectY + r}`,
    `A${r},${r} 0 0 1 ${rectX + r},${rectY}`,
    `Z`,
  ].join(" ");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={W} height={H}>
        <Path d={path} fill="rgba(0,0,0,0.4)" fillRule="evenodd" />
      </Svg>

      {/* Border + label positioned over the cutout */}
      <View
        style={[
          styles.border,
          {
            top: rectY,
            left: rectX,
            width: rectW,
            height: rectH,
            borderColor: theme.primary,
            borderRadius: r,
          },
        ]}
      >
        <View style={[styles.label, { backgroundColor: theme.primary }]}>
          <Text style={styles.labelText}>Select Download Area</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  border: {
    position: "absolute",
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  labelText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
