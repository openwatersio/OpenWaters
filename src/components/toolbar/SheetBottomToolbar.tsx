import { getTopSheetHeight, useSheetStore } from "@/hooks/useSheetPosition";
import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, useNavigation } from "expo-router";
import { ReactNode, useEffect, useState } from "react";

// Approximate height of the iOS bottom toolbar pill, including safe-area padding.
const TOOLBAR_HEIGHT = 50;

export default function SheetBottomToolbar({ children }: { children: ReactNode }) {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("sheetDetentChange" as never, ((e: {
      data: { index: number; stable: boolean };
    }) => {
      if (!e.data.stable) return;
      const height = getTopSheetHeight(useSheetStore.getState().sheets);
      setHidden(height < headerHeight + TOOLBAR_HEIGHT);
    }) as never);
    return unsubscribe;
  }, [navigation, headerHeight]);

  if (hidden) return null;
  return <Stack.Toolbar placement="bottom">{children}</Stack.Toolbar>;
}
