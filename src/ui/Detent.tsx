import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useWindowDimensions, View, type LayoutChangeEvent, type ViewProps } from "react-native";
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
  /** When true, adds a first detent sized to the native navigation header. */
  headerDetent?: boolean;
  /** Fixed fractional detents (e.g. [0.5, 1]) appended after measured detents. */
  additionalDetents?: number[];
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
export function DetentProvider({ gap = 16, initialDetentIndex, headerDetent, additionalDetents, children }: DetentProviderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const nextIndex = useRef(0);
  const heights = useRef<number[]>([]);
  const rawHeaderHeight = useHeaderHeight();
  // Add padding below the header to account for header spacing
  const headerHeight = headerDetent && rawHeaderHeight > 0 ? rawHeaderHeight + 6 : 0;

  const { height: screenHeight } = useWindowDimensions();

  const recompute = useCallback(() => {
    const h = heights.current;
    const maxHeight = screenHeight - insets.top - insets.bottom;

    // Wait until measured Detents have reported (skip intermediate layouts
    // where Host matchContents hasn't finished sizing yet).
    const hasMeasured = h.length > 0;
    if (hasMeasured && h.some((v) => v < 10)) return;

    // Wait for header height if headerDetent is enabled
    if (headerHeight > 0 || !headerDetent) {
      const detents: number[] = [];
      let cumulative = headerHeight;

      // Add a detent for the header itself
      if (headerHeight > 0) {
        detents.push(Math.min(cumulative / maxHeight, 1));
      }

      // Add measured <Detent> children
      for (let i = 0; i < h.length; i++) {
        cumulative += (i > 0 || headerHeight > 0 ? gap : 0) + h[i];
        detents.push(Math.min(cumulative / maxHeight, 1));
      }

      // Append fixed fractional detents
      if (additionalDetents) {
        for (const d of additionalDetents) {
          if (!detents.some((v) => Math.abs(v - d) < 0.001)) {
            detents.push(d);
          }
        }
        detents.sort((a, b) => a - b);
      }

      if (detents.length > 0) {
        navigation.setOptions({ sheetAllowedDetents: detents });
      }
    }
  }, [navigation, insets.top, insets.bottom, screenHeight, gap, headerHeight, additionalDetents, headerDetent]);

  // Recompute when headerHeight or additionalDetents change (not triggered by
  // <Detent> children reporting, so we need an explicit effect).
  useEffect(() => {
    recompute();
  }, [recompute]);

  // Set initial detent index on mount
  useEffect(() => {
    if (initialDetentIndex != null) {
      navigation.setOptions({ sheetInitialDetentIndex: initialDetentIndex });
    }
  }, [initialDetentIndex, navigation]);

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
    [ctx],
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
