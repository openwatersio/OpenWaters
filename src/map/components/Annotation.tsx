import { createStyles } from "@/hooks/useStyles";
import useTheme from "@/hooks/useTheme";
import { ViewAnnotation, type ViewAnnotationProps } from "@maplibre/maplibre-react-native";
import * as Haptics from "expo-haptics";
import { ReactNode, useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { AnnotationIcon, AnnotationIconProps } from "./AnnotationIcon";

const DOT_SIZE = 22;
export const PIN_SIZE = 44;
const ICON_SIZE = 26;
const TAIL_BORDER = 10; // borderTopWidth that creates the triangle
const TAIL_OVERLAP = 2; // negative marginTop overlap with circle
// Height of the visible pin (circle + tail tip), measured from the top.
const CONTENT_HEIGHT = PIN_SIZE + TAIL_BORDER - TAIL_OVERLAP; // 52
// translateY that drops the (top-aligned) circle so its center sits on the
// coordinate in the collapsed/dot state.
const CIRCLE_COLLAPSE_DY = CONTENT_HEIGHT - PIN_SIZE / 2;
const ACCESSORY_MIN_WIDTH = 140; // container widens to this when an accessory is showing so absolute-positioned accessory can fill natural width

const SPRING_CONFIG = { damping: 30, stiffness: 700 };

export type AnnotationProps = Omit<ViewAnnotationProps, "children" | "onPress"> & {
  icon?: AnnotationIconProps["name"];
  label?: string;
  color: string;
  /** Called when the visible pin is tapped. */
  onPress?: () => void;
  /** Content rendered below the pin while `selected`. Handles its own touches. */
  accessory?: ReactNode;
};

/**
 * Map marker pin (circle + tail) shared by selected markers, the selected
 * location, and selected chart features.
 *
 * Layout is intentionally STATIC: the container is a fixed PIN_SIZE × (2 ×
 * CONTENT_HEIGHT) box, so its vertical center lands on the tail tip and, with
 * `anchor="center"`, the tail tip sits on the coordinate. MapLibre sizes and
 * anchors the hosted view from the React/Yoga frame (`updateLayoutMetrics` →
 * `reactSetFrame:` → `_setCenterOffset:` in MLRNPointAnnotation), so the frame
 * MUST be derivable from the static style tree. All motion is therefore done
 * with TRANSFORM/OPACITY only (never width/height/padding/border) — animating
 * layout props here desyncs Yoga from what reanimated paints, and on the next
 * native relayout the pin collapses into a stretched "tall rectangle".
 */
export function Annotation({
  icon,
  label,
  color,
  selected,
  draggable,
  onDragStart,
  onDragEnd,
  onPress,
  accessory,
  ...props
}: AnnotationProps) {
  const theme = useTheme();
  const styles = useStyles();
  const prevSelected = useRef(selected);

  // --- Animations (transform/opacity only) ---

  // Entrance: drop-in only when the marker is selected on mount (e.g. newly
  // placed). Unselected markers appear instantly at their resting position.
  const entranceY = useSharedValue(selected ? -50 : 0);
  const entranceScale = useSharedValue(selected ? 0 : 1);

  useEffect(() => {
    if (!selected) return;
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

  // Container: entrance + drag, scaled about its center (the coordinate/tail tip).
  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: entranceY.value + dragLift.value },
      { scale: entranceScale.value * dragScale.value },
    ],
  }));

  // Circle: scales between dot and pin, and slides down to center on the
  // coordinate while collapsed (the static box is top-aligned).
  const circleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(expansion.value, [0, 1], [CIRCLE_COLLAPSE_DY, 0]) },
      { scale: interpolate(expansion.value, [0, 1], [DOT_SIZE / PIN_SIZE, 1]) },
    ],
  }));

  // Icon: scales smoothly between collapsed and expanded.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(expansion.value, [0, 1], [12 / ICON_SIZE, 1]) }],
  }));

  // Tail: fades and scales away when collapsed (its layout box stays put so the
  // frame is constant).
  const tailStyle = useAnimatedStyle(() => ({
    opacity: expansion.value,
    transform: [{ scale: expansion.value }],
  }));

  // Stop the React event from bubbling up to Map.onPress so a tap on the
  // annotation doesn't also fire the map's location-sheet handler.
  const wrappedOnPress = useCallback<NonNullable<ViewAnnotationProps["onPress"]>>((e) => {
    e.stopPropagation();
    onPress?.();
  }, [onPress]);

  const handleDragStart = useCallback<NonNullable<ViewAnnotationProps["onDragStart"]>>((e) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dragLift.set(withSpring(-10, { damping: 12, stiffness: 300 }));
    dragScale.set(withSpring(1.15, { damping: 12, stiffness: 300 }));
    onDragStart?.(e);
  }, [onDragStart, dragLift, dragScale]);

  const handleDragEnd = useCallback<NonNullable<ViewAnnotationProps["onDragEnd"]>>((e) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dragLift.set(withSpring(0, { damping: 30, stiffness: 350 }));
    dragScale.set(withSpring(1, { damping: 30, stiffness: 350 }));
    onDragEnd?.(e);
  }, [onDragEnd, dragLift, dragScale]);

  return (
    <ViewAnnotation
      {...props}
      anchor="center"
      style={{ zIndex: selected ? 1 : 0 }}
      draggable={draggable}
      onPress={wrappedOnPress}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <>
        <Animated.View
          style={[
            styles.container,
            selected && accessory ? styles.containerWide : null,
            containerStyle,
          ]}
        >
          <Animated.View style={[styles.circle, { backgroundColor: color }, circleStyle]}>
            <Animated.View style={[styles.icon, iconStyle]}>
              {label != null ? (
                <Animated.Text style={styles.label}>{label}</Animated.Text>
              ) : icon ? (
                <AnnotationIcon name={icon} color={theme.contrast} size={ICON_SIZE} />
              ) : null}
            </Animated.View>
          </Animated.View>
          <Animated.View style={[styles.tail, tailStyle]} />
        </Animated.View>
        {selected && accessory && (
          <View style={styles.accessory} pointerEvents="box-none">
            {accessory}
          </View>
        )}
      </>
    </ViewAnnotation>
  );
}

const useStyles = createStyles((theme) => ({
  // Fixed-size box. The visible pin occupies the top CONTENT_HEIGHT; the equal
  // empty space below puts the box's center (the anchor coordinate) on the tail
  // tip. Constant so MapLibre's frame-derived anchoring never desyncs.
  container: {
    width: PIN_SIZE,
    height: CONTENT_HEIGHT * 2,
    alignItems: "center",
  },
  // Widen for the accessory (absolutely positioned, so it fills container width).
  containerWide: {
    minWidth: ACCESSORY_MIN_WIDTH,
  },
  circle: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.contrast,
    alignItems: "center",
    justifyContent: "center",
  },
  // Absolute + fixed size so the glyph stays centered and isn't shrunk by the
  // circle; the circle's align/justify center it (no insets).
  icon: {
    position: "absolute",
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  // With anchor="center", the container's vertical center is the coordinate,
  // so top:"50%" anchors the accessory's top at the coord point. Absolute
  // positioning keeps the accessory out of the flex layout that the pin+tail
  // rely on for centering.
  accessory: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  tail: {
    width: 0,
    height: 0,
    marginTop: -TAIL_OVERLAP,
    borderLeftWidth: 9,
    borderLeftColor: "transparent",
    borderRightWidth: 9,
    borderRightColor: "transparent",
    borderTopWidth: TAIL_BORDER,
    borderTopColor: theme.contrast,
  },
  label: {
    color: theme.contrast,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
}));
