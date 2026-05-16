import { ACTIVITY_CARD_HEIGHT } from "@/activities/components/ActivityCard";
import useTheme from "@/hooks/useTheme";
import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const HORIZONTAL_PADDING = 16;
const PAGE_SCALE_MIN = 0.7;
// Higher = more aggressive front-loading. 1 = linear, 2 = quadratic, 3 = cubic.
const SCALE_EASE_POWER = 1;
// Vertical room for the glass shadow to render without iOS scroll-view clipping.
const SHADOW_BLEED = 32;

type Props = {
  children: ReactNode;
};

export default function ActivityCarousel({ children }: Props) {
  const { width } = useWindowDimensions();
  const pageWidth = width - HORIZONTAL_PADDING * 2;
  // pagingEnabled snaps to multiples of the ScrollView's own width.
  // Each page is pageWidth + 2 * HORIZONTAL_PADDING = window width.
  const stride = width;
  const pages = Children.toArray(children).filter(isValidElement);
  const pageKeys = pages.map((p) => String(p.key));
  const keysSignature = pageKeys.join("|");
  const [page, setPage] = useState(0);
  const scrollX = useSharedValue(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const prevKeysRef = useRef<string[]>([]);
  const focusedKeyRef = useRef<string | null>(null);

  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        scrollX.value = e.contentOffset.x;
      },
      onMomentumEnd: (e) => {
        const next = Math.round(e.contentOffset.x / stride);
        scheduleOnRN(setPage, next);
      },
    },
    [stride],
  );

  // Track the key of whichever card is currently snapped, so we can preserve
  // it visually when the pages array changes.
  useEffect(() => {
    focusedKeyRef.current = pageKeys[page] ?? null;
  }, [page, keysSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a card is added: snap (no animation) so the focused card stays in
  // view despite the index shift, then animate-scroll to the new card.
  useLayoutEffect(() => {
    const currentKeys = keysSignature ? keysSignature.split("|") : [];
    const prev = prevKeysRef.current;
    prevKeysRef.current = currentKeys;
    if (prev.length === 0) return;

    const newKeys = currentKeys.filter((k) => !prev.includes(k));
    if (newKeys.length === 0) return;

    const focused = focusedKeyRef.current;
    const oldIdx = focused ? prev.indexOf(focused) : -1;
    const newIdx = focused ? currentKeys.indexOf(focused) : -1;
    if (newIdx !== -1 && oldIdx !== -1 && oldIdx !== newIdx) {
      scrollViewRef.current?.scrollTo({ x: newIdx * stride, animated: false });
      setPage(newIdx);
    }

    const targetIdx = currentKeys.indexOf(newKeys[0]);
    if (targetIdx !== -1) {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: targetIdx * stride, animated: true });
      });
    }
  }, [keysSignature, stride]);

  return (
    <View>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        style={{
          height: ACTIVITY_CARD_HEIGHT + SHADOW_BLEED * 2,
          marginVertical: -SHADOW_BLEED,
        }}
        contentContainerStyle={{ paddingVertical: SHADOW_BLEED }}
      >
        {pages.map((child, i) => (
          <PageItem
            key={pageKeys[i]}
            index={i}
            pageWidth={pageWidth}
            stride={stride}
            scrollX={scrollX}
          >
            {child}
          </PageItem>
        ))}
      </Animated.ScrollView>
      <Dots count={pages.length} active={page} />
    </View>
  );
}

function PageItem({
  index,
  pageWidth,
  stride,
  scrollX,
  children,
}: {
  index: number;
  pageWidth: number;
  stride: number;
  scrollX: SharedValue<number>;
  children: ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = scrollX.value - index * stride;
    const t = Math.min(1, Math.abs(offset) / stride);
    // Ease-out: scale drops fast at first, then approaches the floor slowly.
    const eased = 1 - Math.pow(1 - t, SCALE_EASE_POWER);
    const scale = 1 - eased * (1 - PAGE_SCALE_MIN);

    // Pull each off-center page toward the focus so the visible gap stays
    // near HORIZONTAL_PADDING. translateX tracks `eased` (not the raw offset)
    // so it scales in sync with `scale` — keeping the cards visually pinched
    // together. Smooth through 0 because eased(0) = 0.
    const fullCompensation =
      (pageWidth * (1 - PAGE_SCALE_MIN) + HORIZONTAL_PADDING) / 2;
    const translateX = Math.sign(offset) * eased * fullCompensation;

    return { transform: [{ translateX }, { scale }] };
  });

  return (
    <Animated.View
      style={[
        { width: pageWidth, marginHorizontal: HORIZONTAL_PADDING },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dotsRow}>
      {count > 1 && Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i === active ? theme.label : theme.labelSecondary },
            i !== active && { opacity: 0.4 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 6,
    marginTop: 8,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 12,
    height: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
