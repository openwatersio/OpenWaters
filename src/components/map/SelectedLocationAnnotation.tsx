import { useSelection } from "@/hooks/useSelection";
import useTheme from "@/hooks/useTheme";
import type { ViewAnnotationProps } from "@maplibre/maplibre-react-native";
import { router } from "expo-router";
import { useCallback } from "react";
import { Annotation } from "./Annotation";

export default function SelectedLocationAnnotation() {
  const selection = useSelection();
  const theme = useTheme();

  const selectedCoords = selection?.type === "location"
    ? selection.id.split(",").map(Number) as [number, number]
    : null;

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
      icon="mappin"
      color={theme.danger}
      selected
      draggable
      onDragEnd={handleDragEnd}
    />
  );
}
