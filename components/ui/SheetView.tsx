import { useSheetReporter } from "@/hooks/useSheetPosition";
import { View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  id: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

export default function SheetView({ id, style, children }: Props) {
  const { onLayout, ref } = useSheetReporter(id);

  return (
    <View ref={ref} onLayout={onLayout} style={style ?? { flex: 1 }}>
      {children}
    </View>
  );
}
