import useTheme from "@/hooks/useTheme";
import { ViewAnnotation, ViewAnnotationProps } from "@maplibre/maplibre-react-native";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import OverlayView from "../ui/OverlayView";
import { AnnotationIcon, AnnotationIconProps } from "./AnnotationIcon";

const DOT_SIZE = 20;
const PIN_SIZE = 44;
const TAIL_HEIGHT = 11; // borderTopWidth(13) - marginTop(2)

// With anchor="bottom", collapsed dot center needs to shift down
const COLLAPSED_OFFSET = DOT_SIZE / 2;

const SPRING_CONFIG = { damping: 20, stiffness: 300 };

type AnnotationProps = Omit<ViewAnnotationProps, "children"> & {
  icon: AnnotationIconProps["name"];
  color: string;
  label?: string;
  onLabelPress?: () => void;
  onPress?: () => void;
};

export function Annotation({
  icon,
  color,
  label,
  onLabelPress,
  selected,
  onPress,
  onDrag,
  onDragStart,
  onDragEnd,
  ...props
}: AnnotationProps) {
  const theme = useTheme();
  const isDragging = useRef(false);
  const prevSelected = useRef(selected);

  // Entrance animation
  const entranceY = useSharedValue(-50);
  const entranceScale = useSharedValue(0);

  useEffect(() => {
    entranceScale.value = withSpring(1, { damping: 50, stiffness: 1000 });
    entranceY.value = withSpring(0, { damping: 70, stiffness: 1000 });
  }, [entranceScale, entranceY]);

  // Selection transition: 0 = collapsed (dot), 1 = expanded (pin)
  const expansion = useSharedValue(selected ? 1 : 0);

  // Drag lift
  const dragLift = useSharedValue(0);
  const dragScale = useSharedValue(1);

  useEffect(() => {
    if (prevSelected.current !== selected) {
      expansion.value = withSpring(selected ? 1 : 0, SPRING_CONFIG);
    }
    prevSelected.current = selected;
  }, [selected, expansion]);

  // Outer container: entrance + drag
  const containerStyle = useAnimatedStyle(() => ({
    alignItems: "center" as const,
    transform: [
      { translateY: entranceY.value + dragLift.value + interpolate(expansion.value, [0, 1], [COLLAPSED_OFFSET, 0]) },
      { scale: entranceScale.value * dragScale.value },
    ],
  }));

  // Circle: animates between dot and pin size
  const circleSize = useAnimatedStyle(() => {
    const size = interpolate(expansion.value, [0, 1], [DOT_SIZE, PIN_SIZE]);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: interpolate(expansion.value, [0, 1], [1, 2]),
    };
  });

  // Icon: scales smoothly between collapsed and expanded
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(expansion.value, [0, 1], [12 / 26, 1]) }],
  }));

  // Tail: fades in/out and scales
  const tailStyle = useAnimatedStyle(() => ({
    opacity: expansion.value,
    transform: [{ scaleY: expansion.value }],
  }));

  // Label: fades in
  const labelStyle = useAnimatedStyle(() => ({
    opacity: expansion.value,
  }));

  return (
    <ViewAnnotation
      anchor="bottom"
      onDragStart={(e) => {
        isDragging.current = true;
        dragLift.value = withSpring(-10, { damping: 12, stiffness: 300 });
        dragScale.value = withSpring(1.15, { damping: 12, stiffness: 300 });
        onDragStart?.(e);
      }}
      onDrag={(e) => onDrag?.(e)}
      onDragEnd={(e) => {
        isDragging.current = false;
        dragLift.value = withSpring(0, { damping: 30, stiffness: 350 });
        dragScale.value = withSpring(1, { damping: 30, stiffness: 350 });
        onDragEnd?.(e);
      }}
      style={{ zIndex: selected ? 1 : 0 }}
      {...props}
    >
      <Pressable onPress={onPress} hitSlop={16}>
        <Animated.View style={containerStyle}>
          {/* Circle (animates between dot and pin sizes) */}
          <Animated.View style={[styles.circle, { backgroundColor: color, borderColor: theme.surface }, circleSize]}>
            <Animated.View style={iconStyle}>
              <AnnotationIcon name={icon} color="white" size={26} />
            </Animated.View>
          </Animated.View>

          {/* Tail (fades in when expanded) */}
          <Animated.View style={[styles.tail, { borderTopColor: theme.surface }, tailStyle]} />

          {/* Label (fades in when expanded) */}
          {label && (
            <Animated.View style={labelStyle}>
              <Pressable onPress={onLabelPress} disabled={!onLabelPress}>
                <OverlayView style={styles.labelOverlay}>
                  <Text style={[styles.label, { color: onLabelPress ? theme.danger : theme.textPrimary }]}>{label}</Text>
                </OverlayView>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
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
    borderTopWidth: TAIL_HEIGHT + 2,
    marginTop: -2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelOverlay: {
    overflow: "hidden",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 30,
  },
});
