import { createStyles } from "@/hooks/useStyles";
import OverlayView from "@/ui/OverlayView";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { LinearTransition } from "react-native-reanimated";

export const ACTIVITY_CARD_HEIGHT = 72;

type Props = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export default function ActivityCard({ onPress, style, children }: Props) {
  const styles = useStyles();

  const content = onPress ? (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={styles.pressable}
    >
      {children}
    </Pressable>
  ) : (
    children
  );

  return (
    <OverlayView style={[styles.container, style]} layout={LinearTransition}>
      {content}
    </OverlayView>
  );
}

const useStyles = createStyles(() => ({
  container: {
    height: ACTIVITY_CARD_HEIGHT,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: "center",
  },
  pressable: {
    flex: 1,
    justifyContent: "center",
  },
}));
