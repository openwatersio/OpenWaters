import { useCallback, useEffect, useRef } from "react";
import { type LayoutChangeEvent, type View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";

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

export const useSheetStore = create<{
  sheets: Record<string, SheetEntry>;
  setHeight: (id: string, height: number) => void;
  removeSheet: (id: string) => void;
}>((set) => ({
  sheets: {},
  setHeight: (id, height) =>
    set((state) => {
      const existing = state.sheets[id];
      const wasOpen = existing && existing.height > 0;
      const isOpen = height > 0;
      return {
        sheets: {
          ...state.sheets,
          [id]: {
            height,
            presentedAt:
              !wasOpen && isOpen ? Date.now() : (existing?.presentedAt ?? 0),
          },
        },
      };
    }),
  removeSheet: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.sheets;
      return { sheets: rest };
    }),
}));

/** Height of the topmost open sheet (0 if none). */
export function getTopSheetHeight(sheets: Record<string, SheetEntry>): number {
  const entries = Object.values(sheets).filter((e) => e.height > 0);
  if (entries.length === 0) return 0;
  return entries.reduce((a, b) => (a.presentedAt > b.presentedAt ? a : b))
    .height;
}

/**
 * Returns the topmost sheet height as a plain number, re-renders on change.
 */
export function useTopSheetHeight(): number {
  return useSheetStore((s) => getTopSheetHeight(s.sheets));
}

/**
 * Returns the topmost sheet height as an animated shared value.
 */
export function useSheetHeight(): SharedValue<number> {
  const animated = useSharedValue(
    getTopSheetHeight(useSheetStore.getState().sheets),
  );

  useEffect(() => {
    return useSheetStore.subscribe((s) => {
      animated.value = withTiming(getTopSheetHeight(s.sheets), {
        duration: 50,
      });
    });
  }, [animated]);

  return animated;
}

/**
 * Returns a ref that always holds the current topmost sheet height
 * without triggering re-renders.
 */
export function useSheetHeightRef(): React.RefObject<number> {
  const ref = useRef(getTopSheetHeight(useSheetStore.getState().sheets));
  useEffect(() => {
    return useSheetStore.subscribe((s) => {
      ref.current = getTopSheetHeight(s.sheets);
    });
  }, []);
  return ref;
}

/**
 * Call from each formSheet screen's root View onLayout.
 * Reports the sheet's content height continuously.
 */
export function useSheetReporter(id: string) {
  const setHeight = useSheetStore((s) => s.setHeight);
  const removeSheet = useSheetStore((s) => s.removeSheet);

  useEffect(() => {
    return () => removeSheet(id);
  }, [id, removeSheet]);

  const viewRef = useRef<View>(null);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      setHeight(id, height);
    },
    [id, setHeight],
  );

  return { onLayout, ref: viewRef };
}

/**
 * Returns an animated style that shifts content up by the topmost sheet's height.
 */
export function useSheetOffset() {
  const sheetHeight = useSheetHeight();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -sheetHeight.value }],
  }));

  return animatedStyle;
}
