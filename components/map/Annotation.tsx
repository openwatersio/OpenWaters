import useTheme from "@/hooks/useTheme";
import { ViewAnnotation, ViewAnnotationProps } from "@maplibre/maplibre-react-native";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import OverlayView from "../ui/OverlayView";
import { AnnotationIcon, AnnotationIconProps } from "./AnnotationIcon";

type AnnotationProps = Omit<ViewAnnotationProps, "children"> & {
  icon: AnnotationIconProps["name"];
  color: string;
  label?: string;
  onPress?: () => void;
};

export function Annotation({
  icon,
  color,
  label,
  selected,
  onPress,
  onDrag,
  onDragStart,
  onDragEnd,
  ...props
}: AnnotationProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const isDragging = useRef(false);

  const liftY = useSharedValue(-50);
  const liftScale = useSharedValue(0);

  useEffect(() => {
    liftScale.value = withSpring(1, { damping: 50, stiffness: 1000 });
    liftY.value = withSpring(0, { damping: 70, stiffness: 1000 });
  }, []);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: liftY.value },
      { scale: liftScale.value },
    ],
  }));

  return (
    <ViewAnnotation
      anchor="bottom"
      onDragStart={(e) => {
        isDragging.current = true;
        liftY.value = withSpring(-10, { damping: 12, stiffness: 300 });
        liftScale.value = withSpring(1.15, { damping: 12, stiffness: 300 });
        onDragStart?.(e);
      }}
      onDrag={(e) => onDrag?.(e)}
      onDragEnd={(e) => {
        isDragging.current = false;
        liftY.value = withSpring(0, { damping: 30, stiffness: 350 });
        liftScale.value = withSpring(1, { damping: 30, stiffness: 350 });
        onDragEnd?.(e);
      }}
      style={{ zIndex: selected ? 1 : 0 }}
      {...props}
    >
      <Animated.View style={liftStyle}>
        {selected ? (
          <View style={styles.pinContainer}>
            <View style={[styles.pinCircle, { backgroundColor: color }]}>
              <AnnotationIcon name={icon} color="white" size={26} />
            </View>
            <View style={styles.pinTail} />
            {label && (
              <OverlayView style={styles.labelOverlay}>
                <Text style={styles.label}>{label}</Text>
              </OverlayView>
            )}
          </View>
        ) : (
          <Pressable onPress={onPress} hitSlop={16}>
            <View style={[styles.dot, { backgroundColor: color }]}>
              <AnnotationIcon name={icon} color="white" size={12} />
            </View>
          </Pressable>
        )}
      </Animated.View>
    </ViewAnnotation>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    pinContainer: {
      alignItems: "center",
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
    },
    pinCircle: {
      width: 44,
      height: 44,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: theme.surface,
    },
    pinTail: {
      width: 0,
      height: 0,
      borderLeftWidth: 9,
      borderLeftColor: "transparent",
      borderRightWidth: 9,
      borderRightColor: "transparent",
      borderTopWidth: 13,
      borderTopColor: theme.surface,
      marginTop: -2,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    labelOverlay: {
      overflow: "hidden",
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 30,
    },
    dot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
    },
  });
}
