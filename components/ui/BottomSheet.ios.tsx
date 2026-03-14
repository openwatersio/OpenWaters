import { useBottomSheetStore } from "@/hooks/useBottomSheetOffset";
import { BottomSheet as ExpoBottomSheet, Group, Host, RNHostView } from "@expo/ui/swift-ui";
import {
  interactiveDismissDisabled,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  type PresentationDetent,
} from "@expo/ui/swift-ui/modifiers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, View } from "react-native";

type BottomSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
  compactHeight?: number;
  dismissable?: boolean;
  children?: React.ReactNode;
};

const SCREEN_HEIGHT = Dimensions.get("window").height;

function detentToHeight(detent: PresentationDetent): number {
  if (typeof detent === "object" && "height" in detent) return detent.height;
  if (typeof detent === "object" && "fraction" in detent) return SCREEN_HEIGHT * detent.fraction;
  if (detent === "medium") return SCREEN_HEIGHT * 0.5;
  if (detent === "large") return SCREEN_HEIGHT;
  return 0;
}

export default function BottomSheet({ isOpen, onOpenChange, onExpandedChange, compactHeight, dismissable = false, children }: BottomSheetProps) {
  const setHeight = useBottomSheetStore((s) => s.setHeight);
  const [selectedDetent, setSelectedDetent] = useState<PresentationDetent>("medium");

  const compactDetent = useMemo<PresentationDetent | null>(
    () => compactHeight ? { height: compactHeight } : null,
    [compactHeight],
  );

  const detentList = useMemo<PresentationDetent[]>(
    () => compactDetent ? [compactDetent, "medium", "large"] : ["medium", "large"],
    [compactDetent],
  );

  // Update map control offset when detent changes
  useEffect(() => {
    if (!isOpen) {
      setHeight(0);
      return;
    }
    setHeight(detentToHeight(selectedDetent));
  }, [isOpen, selectedDetent, setHeight]);

  // Reset to compact when sheet opens
  useEffect(() => {
    if (isOpen && compactDetent) {
      setSelectedDetent(compactDetent);
      onExpandedChange?.(false);
    }
  }, [isOpen, compactDetent, onExpandedChange]);

  const handleDetentChange = useCallback((detent: PresentationDetent) => {
    setSelectedDetent(detent);
    const isCompact = typeof detent === "object" && "height" in detent;
    onExpandedChange?.(!isCompact);
  }, [onExpandedChange]);

  if (!isOpen) return null;

  return (
    <Host>
      <ExpoBottomSheet isPresented={isOpen} onIsPresentedChange={onOpenChange}>
        <Group
          modifiers={[
            presentationDetents(detentList, {
              selection: selectedDetent,
              onSelectionChange: handleDetentChange,
            }),
            presentationDragIndicator("visible"),
            presentationBackgroundInteraction(
              compactDetent
                ? { type: "enabledUpThrough", detent: compactDetent }
                : "enabled"
            ),
            ...(!dismissable ? [interactiveDismissDisabled()] : []),
          ]}
        >
          <RNHostView>
            <View>{children}</View>
          </RNHostView>
        </Group>
      </ExpoBottomSheet>
    </Host>
  );
}
