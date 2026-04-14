import { useSheetReporter } from "@/hooks/useSheetPosition";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { DetentProvider } from "./Detent";

type Props = {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;

  /** When set, enables `<Detent>` children for progressive-disclosure sheet
   *  sizing. Specifies the uniform gap (in points) between each Detent section.
   *  Omit to use the existing fixed/fitToContents detent behavior. */
  gap?: number;
  /** Which detent index to present at initially. */
  initialDetentIndex?: number;
  /** When true, adds a first detent sized to the native navigation header. */
  headerDetent?: boolean;
  /** Fixed fractional detents (e.g. [0.5, 1]) appended after measured detents. */
  additionalDetents?: number[];
};

export default function SheetView({ id, style, gap, initialDetentIndex, headerDetent, additionalDetents, children }: Props) {
  const { onLayout: reportLayout, ref } = useSheetReporter(id);
  const usesDetentProvider = gap != null || headerDetent || additionalDetents != null;

  return (
    <View
      ref={ref}
      onLayout={reportLayout}
      style={style ?? { flex: 1 }}
    >
      {usesDetentProvider ? (
        <DetentProvider
          gap={gap}
          initialDetentIndex={initialDetentIndex}
          headerDetent={headerDetent}
          additionalDetents={additionalDetents}
        >
          {children}
        </DetentProvider>
      ) : (
        children
      )}
    </View>
  );
}
