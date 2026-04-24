import { type Route, type RoutesOrder } from "@/database";
import RouteListItem from "@/routes/components/RouteListItem";
import { useActiveRoute, useRoutes } from "@/routes/hooks/useRoutes";
import RowSeparator from "@/ui/RowSeparator";
import { FlatList, type ListRenderItem } from "react-native";

type Props = {
  order: RoutesOrder;
};

export default function RouteList({ order }: Props) {
  const routes = useRoutes({ order });
  const { id: activeId, isNavigating } = useActiveRoute();
  const activeRouteId = isNavigating ? activeId ?? null : null;

  const renderItem: ListRenderItem<Route> = ({ item }) => (
    <RouteListItem route={item} isNavigating={item.id === activeRouteId} />
  );

  return (
    <FlatList
      data={routes}
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
