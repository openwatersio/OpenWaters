import useTheme from "@/hooks/useTheme";
import type { SpeedSample } from "@/hooks/useTrackRecording";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

type Props = {
  samples: readonly SpeedSample[];
  width: number;
  height?: number;
};

export default function SpeedChart({ samples, width, height = 200 }: Props) {
  const theme = useTheme();

  const { path, fillPath } = useMemo(() => {
    if (samples.length < 2) {
      return { path: "", fillPath: "" };
    }

    const speeds = samples.map((s) => s.speed);
    const max = Math.max(...speeds);
    const yMax = max * 1.1 || 1; // 10% headroom

    const chartHeight = height - 8; // small top padding

    const points = samples.map((s, i) => {
      const x = (i / (samples.length - 1)) * width;
      const y = chartHeight - (s.speed / yMax) * chartHeight + 4;
      return { x, y };
    });

    const lineParts = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`));
    const line = lineParts.join(" ");
    const fill = `${line} L${points[points.length - 1].x},${chartHeight + 4} L${points[0].x},${chartHeight + 4} Z`;

    return { path: line, fillPath: fill };
  }, [samples, width, height]);

  if (samples.length < 2) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceElevated }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.primary} stopOpacity={0.6} />
            <Stop offset="1" stopColor={theme.primary} stopOpacity={0.1} />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill="url(#fill)" />
        <Path d={path} stroke={theme.primary} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
  },
});
