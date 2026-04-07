import useTheme from "@/hooks/useTheme";
import { ViewAnnotation, type ViewAnnotationProps } from "@maplibre/maplibre-react-native";
import { useCallback, useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AnnotationIcon, AnnotationIconProps } from "./AnnotationIcon";

const DOT_SIZE = 20;
const PIN_SIZE = 44;
const TAIL_BORDER = 13; // borderTopWidth that creates the triangle
const TAIL_OVERLAP = 2; // negative marginTop overlap with circle
const EXPANDED_CONTENT = PIN_SIZE + TAIL_BORDER - TAIL_OVERLAP; // 55 — total layout height when expanded

const SPRING_CONFIG = { damping: 30, stiffness: 700 };

type AnnotationProps = Omit<ViewAnnotationProps, "children"> & {
  icon: AnnotationIconProps["name"];
  color: string;
};

export function Annotation({
  icon,
  color,
  selected,
  draggable,
  onDragEnd,
  onPress,
  ...props
}: AnnotationProps) {
  const theme = useTheme();
  const prevSelected = useRef(selected);

  // --- Animations ---

  // Entrance
  const entranceY = useSharedValue(-50);
  const entranceScale = useSharedValue(0);

  useEffect(() => {
    entranceScale.value = withSpring(1, { damping: 50, stiffness: 1000 });
    entranceY.value = withSpring(0, { damping: 70, stiffness: 1000 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection transition: 0 = collapsed (dot), 1 = expanded (pin)
  const expansion = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (prevSelected.current !== selected) {
      expansion.value = withSpring(selected ? 1 : 0, SPRING_CONFIG);
    }
    prevSelected.current = selected;
  }, [selected, expansion]);

  // Drag lift/scale feedback — driven by native drag start/end callbacks.
  // MapLibre handles the actual position update natively; these only apply
  // a visual "pick up" effect on top.
  const dragLift = useSharedValue(0);
  const dragScale = useSharedValue(1);

  // With anchor="center", the coordinate is at the container's vertical center.
  // paddingBottom pushes content up so the anchor point stays at center:
  //   collapsed (e=0): container = dot(20), center = 10 = dot center ✓
  //   expanded (e=1): container = content(55) + padding(55) = 110, center = 55 = tail tip ✓
  // Layout-based positioning keeps the native view frame aligned with hit testing.
  const containerStyle = useAnimatedStyle(() => ({
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: interpolate(expansion.value, [0, 1], [0, EXPANDED_CONTENT]),
    transform: [
      { translateY: entranceY.value + dragLift.value },
      { scale: entranceScale.value * dragScale.value },
    ],
  }));

  // Circle: animates between dot and pin size
  const circleSize = useAnimatedStyle(() => {
    const size = interpolate(expansion.value, [0, 1], [DOT_SIZE, PIN_SIZE]);
    return {
      width: size,
      height: size,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: size / 2,
      borderWidth: interpolate(expansion.value, [0, 1], [1, 2]),
    };
  });

  // Icon: scales smoothly between collapsed and expanded.
  // Explicit width/height + position:absolute keeps the 26px icon from being
  // shrunk by the smaller (20px) collapsed circle, which would otherwise
  // clip it to the bottom-right instead of keeping it centered.
  const iconStyle = useAnimatedStyle(() => ({
    position: "absolute",
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scale: interpolate(expansion.value, [0, 1], [12 / 26, 1]) }],
  }));

  // Tail: animate layout height (borderTopWidth + marginTop) so it collapses
  // to zero space when not selected, keeping the dot flush with the anchor.
  const tailStyle = useAnimatedStyle(() => ({
    opacity: expansion.value,
    borderTopWidth: interpolate(expansion.value, [0, 1], [0, TAIL_BORDER]),
    marginTop: interpolate(expansion.value, [0, 1], [0, -TAIL_OVERLAP]),
  }));

  // Stop the React event from bubbling up to Map.onPress so a tap on the
  // annotation doesn't also fire the map's location-sheet handler.
  const wrappedOnPress = useCallback<NonNullable<ViewAnnotationProps["onPress"]>>((e) => {
    e.stopPropagation();
    onPress?.(e);
  }, [onPress]);

  const handleDragStart = useCallback<NonNullable<ViewAnnotationProps["onDragStart"]>>(() => {
    dragLift.value = withSpring(-10, { damping: 12, stiffness: 300 });
    dragScale.value = withSpring(1.15, { damping: 12, stiffness: 300 });
  }, [dragLift, dragScale]);

  const handleDragEnd = useCallback<NonNullable<ViewAnnotationProps["onDragEnd"]>>((e) => {
    dragLift.value = withSpring(0, { damping: 30, stiffness: 350 });
    dragScale.value = withSpring(1, { damping: 30, stiffness: 350 });
    onDragEnd?.(e);
  }, [onDragEnd, dragLift, dragScale]);

  return (
    <ViewAnnotation
      anchor="center"
      style={{ zIndex: selected ? 1 : 0 }}
      draggable={draggable}
      onPress={wrappedOnPress}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      {...props}
    >
      <Animated.View style={containerStyle}>
        <Animated.View style={[styles.circle, { backgroundColor: color, borderColor: theme.surface }, circleSize]}>
          <Animated.View style={iconStyle}>
            <AnnotationIcon name={icon} color="white" size={26} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.tail, { borderTopColor: theme.surface }, tailStyle]} />
      </Animated.View>
    </ViewAnnotation>
  );
}


const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderLeftColor: "transparent",
    borderRightWidth: 9,
    borderRightColor: "transparent",
  },
});
