import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { create } from "zustand";

type SheetEntry = {
  height: number;
  presentedAt: number; // timestamp for ordering
};

const useBottomSheetStore = create<{
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
            // Update presentedAt only when transitioning from closed to open
            presentedAt: !wasOpen && isOpen ? Date.now() : (existing?.presentedAt ?? 0),
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

export { useBottomSheetStore };

/**
 * Returns an animated style that shifts content up by the most recently presented sheet's height.
 */
export function useBottomSheetOffset() {
  const height = useBottomSheetStore((s) => {
    const entries = Object.values(s.sheets).filter((e) => e.height > 0);
    if (entries.length === 0) return 0;
    // Pick the most recently presented sheet
    return entries.reduce((a, b) => (a.presentedAt > b.presentedAt ? a : b)).height;
  });

  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withTiming(height, { duration: 300 });
  }, [height, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -offset.value }],
  }));

  return animatedStyle;
}
