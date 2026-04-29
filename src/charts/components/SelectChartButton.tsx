import { useCharts } from "@/charts/hooks/useCharts";
import { selectChart, useChartStore } from "@/charts/store";
import { Button, Divider, Menu } from "@expo/ui/swift-ui";
import {
  foregroundStyle,
  frame,
  glassEffect,
  glassEffectId,
  labelStyle
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";

const NS_ID = "map-controls";

export function SelectChartButton() {
  const charts = useCharts();
  const { selectedChartId } = useChartStore();

  return (
    <Menu
      label="Map Type"
      systemImage={"square.3.layers.3d"}
      modifiers={[
        labelStyle("iconOnly"),
        foregroundStyle("primary"),
        frame({ width: 44, height: 44 }),
        glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" }),
        glassEffectId("chart-type", NS_ID),
      ]}
    >
      {/* SwiftUI orders menu items bottom to top, and @expo/ui doesn't support menuOrder modifier */}
      {charts.map(({ id, name }) => (
        <Button
          key={id}
          label={name}
          systemImage="map"
          onPress={() => selectChart(id)}
        />
      ))}
      <Divider />
      <Button
        label="Manage Charts…"
        systemImage="slider.horizontal.3"
        onPress={() => router.navigate("/charts")}
      />
      {selectedChartId && (
        <Button
          label="About This Chart"
          systemImage="info.circle"
          onPress={() =>
            router.push({
              pathname: "/charts/[id]",
              params: { id: selectedChartId },
            })
          }
        />
      )}
    </Menu>
  );
}
