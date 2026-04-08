import { useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { Dimensions, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_HEIGHT = Dimensions.get("window").height;

/**
 * iOS sheet grab-handle chrome drawn by `UISheetPresentationController`
 * above the React Native content. It isn't exposed via UIKit or
 * react-native-screens, so this is an empirical constant (~5pt indicator
 * plus surrounding padding). Only applies when `sheetGrabberVisible: true`.
 */
const SHEET_GRABBER_HEIGHT = 5;

/**
 * Sets sheet detents based on content height. Pass additional fixed detents
 * (e.g. [0.5, 1]) to append them after the content-sized detent.
 */
export function useSheetDetents(additionalDetents: number[] = []) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const setDetentHeight = useCallback(
    (height: number) => {
      const sheetMaxHeight = SCREEN_HEIGHT - insets.top - insets.bottom;
      const fraction = (height + SHEET_GRABBER_HEIGHT) / sheetMaxHeight;
      navigation.setOptions({
        sheetAllowedDetents: [fraction, ...additionalDetents],
      });
    },
    [navigation, insets, additionalDetents],
  );

  /** Callback for any React Native component's `onLayout` event */
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      setDetentHeight(e.nativeEvent.layout.height);
    },
    [setDetentHeight],
  );

  /** Callback for <Host onLayoutContent> */
  const onHostLayout = useCallback(
    (e: { nativeEvent: { width: number; height: number } }) => {
      setDetentHeight(e.nativeEvent.height);
    },
    [setDetentHeight],
  );

  return { onLayout, onHostLayout, setDetentHeight };
}
