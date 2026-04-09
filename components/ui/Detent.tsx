import { useNavigation } from "@react-navigation/native";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useWindowDimensions, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// -- Context --

type DetentContextValue = {
  register: () => number;
  reportHeight: (index: number, height: number) => void;
  gap: number;
};

const DetentContext = createContext<DetentContextValue | null>(null);

// -- Provider --

type DetentProviderProps = {
  /** Uniform gap between detent sections (default 16). */
  gap?: number;
  /** Which detent index to open at initially (default 0). */
  initialDetentIndex?: number;
  children: ReactNode;
};

/**
 * Manages dynamic sheet detents based on measured child `<Detent>` heights.
 * Wrap your sheet content in this provider and use `<Detent>` to mark each
 * progressive disclosure section.
 *
 * Each `<Detent>` boundary means: "the sheet can stop here." The first Detent's
 * content defines the smallest detent, the first + second defines the next, etc.
 */
export function DetentProvider({ gap = 16, initialDetentIndex, children }: DetentProviderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const nextIndex = useRef(0);
  const heights = useRef<number[]>([]);

  const { height: screenHeight } = useWindowDimensions();

  const recompute = useCallback(() => {
    const h = heights.current;
    // Wait until all registered Detents have reported, and skip intermediate
    // layouts where Host matchContents hasn't finished sizing yet.
    if (h.length === 0 || h.some((v) => v < 10)) return;

    // maximumDetentValue from UIKit = screenHeight - top - bottom (verified
    // via native NSLog: 874 - 62 - 34 = 778 on iPhone 17 Pro).
    const maxHeight = screenHeight - insets.top - insets.bottom;
    const detents: number[] = [];
    let cumulative = 0;

    for (let i = 0; i < h.length; i++) {
      cumulative += (i > 0 ? gap : 0) + h[i];
      detents.push(Math.min(cumulative / maxHeight, 1));
    }

    navigation.setOptions({ sheetAllowedDetents: detents });
  }, [navigation, insets.top, insets.bottom, screenHeight, gap]);

  // Set initial detent index on mount
  useEffect(() => {
    if (initialDetentIndex != null) {
      navigation.setOptions({ sheetInitialDetentIndex: initialDetentIndex });
    }
  }, []);

  const register = useCallback(() => {
    const index = nextIndex.current++;
    // Ensure the heights array has a slot
    while (heights.current.length <= index) {
      heights.current.push(0);
    }
    return index;
  }, []);

  const reportHeight = useCallback(
    (index: number, height: number) => {
      if (heights.current[index] === height) return;
      heights.current[index] = height;
      recompute();
    },
    [recompute],
  );

  return (
    <DetentContext.Provider value={{ register, reportHeight, gap }}>
      {children}
    </DetentContext.Provider>
  );
}

// -- Detent --

/**
 * Marks a progressive disclosure boundary inside a `<DetentProvider>`.
 * Each `<Detent>` measures its children and reports the height. The provider
 * computes cumulative heights and sets sheet detents accordingly.
 *
 * All content is always rendered — detents control how much of the sheet
 * is visible, not what is mounted.
 */
export function Detent({ children, style, ...props }: ViewProps) {
  const ctx = useContext(DetentContext);
  if (!ctx) {
    throw new Error("<Detent> must be used inside a <DetentProvider>");
  }

  const indexRef = useRef<number | null>(null);
  if (indexRef.current === null) {
    indexRef.current = ctx.register();
  }

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      ctx.reportHeight(indexRef.current!, e.nativeEvent.layout.height);
    },
    [ctx.reportHeight],
  );

  return (
    <View
      {...props}
      style={[
        { flexGrow: 0, flexShrink: 0 },
        style,
        indexRef.current > 0 ? { marginTop: ctx.gap } : undefined
      ]}
      onLayout={onLayout}
    >
      {children}
    </View>
  );
}
