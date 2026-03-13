import { useBottomSheetStore } from "@/hooks/useBottomSheetOffset";
import { ModalBottomSheet, RNHostView } from "@expo/ui/jetpack-compose";
import { useEffect, useRef } from "react";
import { View, type LayoutChangeEvent } from "react-native";

type BottomSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
  compactHeight?: number;
  dismissable?: boolean;
  children: React.ReactNode;
};

export default function BottomSheet({ isOpen, onOpenChange, children }: BottomSheetProps) {
  const setHeight = useBottomSheetStore((s) => s.setHeight);
  const measuredHeight = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    measuredHeight.current = e.nativeEvent.layout.height;
    if (isOpen) setHeight(measuredHeight.current);
  };

  useEffect(() => {
    setHeight(isOpen ? measuredHeight.current : 0);
  }, [isOpen, setHeight]);

  if (!isOpen) return null;

  return (
    <ModalBottomSheet onDismissRequest={() => onOpenChange(false)}>
      <RNHostView matchContents>
        <View onLayout={onLayout}>{children}</View>
      </RNHostView>
    </ModalBottomSheet>
  );
}
