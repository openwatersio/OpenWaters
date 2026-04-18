import type { Marker, MarkersOrder } from "@/database";
import MarkerListItem from "@/markers/components/MarkerListItem";
import { useMarkers } from "@/markers/hooks/useMarkers";
import RowSeparator from "@/ui/RowSeparator";
import { FlatList, type ListRenderItem } from "react-native";

const renderItem: ListRenderItem<Marker> = ({ item }) => (
  <MarkerListItem marker={item} />
);

type Props = {
  order: MarkersOrder;
};

export default function MarkerList({ order }: Props) {
  const markers = useMarkers({ order });

  return (
    <FlatList
      data={markers}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ItemSeparatorComponent={RowSeparator}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={8}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}
