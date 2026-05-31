import useTheme from "@/hooks/useTheme";
import { useSelection } from "@/map/hooks/useSelection";
import type { ViewAnnotationProps } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { useCallback } from "react";
import { Annotation } from "./Annotation";

export default function SelectedLocationAnnotation() {
  const selection = useSelection();
  const theme = useTheme();

  // id is "lon,lat" for a bare location, or "lon,lat,LNAM" once a chart feature
  // has been identified — take only the coordinate.
  const selectedCoords = selection?.type === "location"
    ? (selection.id.split(",").slice(0, 2).map(Number) as [number, number])
    : null;

  // Dropping the pin re-selects the bare coordinate (dropping any LNAM hint), so
  // LocationDetail re-runs the lookup at the new spot.
  const handleDragEnd = useCallback<NonNullable<ViewAnnotationProps["onDragEnd"]>>(
    (e) =>
      router.setParams({ id: e.nativeEvent.lngLat.join(',') }),
    []
  );

  if (!selectedCoords) return null;

  return (
    <Annotation
      id="selected-location"
      lngLat={selectedCoords}
      icon="pin"
      color={theme.userLocation}
      selected
      draggable
      onDragEnd={handleDragEnd}
    />
  );
}
