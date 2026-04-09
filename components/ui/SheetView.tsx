import { useSheetReporter } from "@/hooks/useSheetPosition";
import { type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DetentProvider } from "./Detent";

type Props = {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;

  /** When set, enables `<Detent>` children for progressive-disclosure sheet
   *  sizing. Specifies the uniform gap (in points) between each Detent section.
   *  Omit to use the existing fixed/fitToContents detent behavior. */
  gap?: number;
  /** Which detent index to present at initially (only used with `gap`). */
  initialDetentIndex?: number;
};

export default function SheetView({ id, style, gap, initialDetentIndex, children }: Props) {
  const { onLayout: reportLayout, ref } = useSheetReporter(id);

  return (
    <SafeAreaView
      ref={ref}
      edges={gap != null ? ["bottom"] : []}
      onLayout={reportLayout}
      style={style ?? { flex: 1 }}
    >
      {gap != null ? (
        <DetentProvider gap={gap} initialDetentIndex={initialDetentIndex}>
          {children}
        </DetentProvider>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
