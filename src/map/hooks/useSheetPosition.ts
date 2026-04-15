import { useCallback, useEffect, useRef } from "react";
import { type LayoutChangeEvent, type View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { proxy, subscribe, useSnapshot } from "valtio";

/**
 * Tracks the height of the topmost formSheet so overlay buttons
 * on the parent screen can stay above it.
 *
 * Usage in a formSheet screen:
 *   const { onLayout } = useSheetReporter("track");
 *   return <View onLayout={onLayout}>...</View>
 *
 * Usage in the parent (map) screen:
 *   const offsetStyle = useSheetOffset();
 *   return <Animated.View style={offsetStyle}>...buttons...</Animated.View>
 */

type SheetEntry = {
  height: number;
  presentedAt: number;
};

export const sheetState = proxy<Record<string, SheetEntry>>({});

export function useSheets() {
  return useSnapshot(sheetState);
}

export function setSheetHeight(id: string, height: number) {
  const existing = sheetState[id];
  const wasOpen = existing && existing.height > 0;
  const isOpen = height > 0;
  sheetState[id] = {
    height,
    presentedAt:
      !wasOpen && isOpen ? Date.now() : (existing?.presentedAt ?? 0),
  };
}

export function removeSheet(id: string) {
  delete sheetState[id];
}

/** Height of the topmost open sheet (0 if none). */
export function getTopSheetHeight(
  sheets: Record<string, SheetEntry> = sheetState,
): number {
  const entries = Object.values(sheets).filter((e) => e.height > 0);
  if (entries.length === 0) return 0;
  return entries.reduce((a, b) => (a.presentedAt > b.presentedAt ? a : b))
    .height;
}

/** Topmost sheet height as a plain number, re-renders on change. */
export function useTopSheetHeight(): number {
  return getTopSheetHeight(useSheets());
}

/** Topmost sheet height as an animated shared value. */
export function useSheetHeight(): SharedValue<number> {
  const animated = useSharedValue(getTopSheetHeight());

  useEffect(() => {
    return subscribe(sheetState, () => {
      animated.value = withTiming(getTopSheetHeight(), { duration: 50 });
    });
  }, [animated]);

  return animated;
}

/** Ref that always holds the current topmost sheet height without re-renders. */
export function useSheetHeightRef(): React.RefObject<number> {
  const ref = useRef(getTopSheetHeight());
  useEffect(() => {
    return subscribe(sheetState, () => {
      ref.current = getTopSheetHeight();
    });
  }, []);
  return ref;
}

/**
 * Call from each formSheet screen's root View onLayout. Reports the
 * sheet's content height continuously.
 */
export function useSheetReporter(id: string) {
  useEffect(() => {
    return () => removeSheet(id);
  }, [id]);

  const viewRef = useRef<View>(null);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      setSheetHeight(id, height);
    },
    [id],
  );

  return { onLayout, ref: viewRef };
}

/** Animated style that shifts content up by the topmost sheet's height. */
export function useSheetOffset() {
  const sheetHeight = useSheetHeight();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -sheetHeight.value }],
  }));

  return animatedStyle;
}
