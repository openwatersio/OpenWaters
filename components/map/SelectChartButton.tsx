import { useCharts } from "@/hooks/useCharts";
import { setViewOptions } from "@/hooks/useViewOptions";
import { Button, Divider, Menu } from "@expo/ui/swift-ui";
import {
  contentShape,
  frame,
  glassEffect,
  glassEffectId,
  labelStyle,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

const NS_ID = "map-controls";

export function SelectChartButton() {
  const charts = useCharts();

  return (
    <Menu
      label="Map Type"
      systemImage={"square.3.layers.3d"}
      modifiers={[
        labelStyle("iconOnly"),
        frame({ width: 44, height: 44 }),
        contentShape(shapes.circle()),
        glassEffect({ glass: { variant: "regular" }, shape: "circle" }),
        glassEffectId("chart-type", NS_ID),
      ]}
    >
      {/* SwiftUI orders menu items bottom to top, and @expo/ui doesn't support menuOrder modifier */}
      {charts.map(({ id, name }) => (
        <Button
          key={id}
          label={name}
          systemImage="map"
          onPress={() => setViewOptions({ mapStyleId: id })}
        />
      ))}
      <Divider />
      <Button
        label="Manage Charts…"
        systemImage="slider.horizontal.3"
        onPress={() => router.navigate("/charts")}
      />

    </Menu>
  );
}
