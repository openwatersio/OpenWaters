import { type RoutesOrder } from "@/database";
import RouteList from "@/routes/components/RouteList";
import SheetView from "@/ui/SheetView";
import { router, Stack, StackToolbarMenuActionProps } from "expo-router";
import { useState } from "react";

export default function RoutesIndex() {
  const [order, setOrder] = useState<RoutesOrder>("recent");
  const orderOptions: {
    label: string;
    value: RoutesOrder;
    icon: StackToolbarMenuActionProps["icon"];
  }[] = [
    { label: "Recent", value: "recent", icon: "clock" },
    { label: "Name", value: "name", icon: "character" },
    { label: "Distance", value: "distance", icon: "lines.measurement.vertical" },
    { label: "Nearby", value: "nearby", icon: "location" },
  ];

  return (
    <SheetView id="routes">
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease" title="Sort">
          {orderOptions.map(({ label, value, icon }) => (
            <Stack.Toolbar.MenuAction
              key={value}
              icon={icon}
              isOn={order === value}
              onPress={() => setOrder(value)}
            >
              {label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="xmark"
          onPress={() => router.back()}
        />
      </Stack.Toolbar>
      <RouteList order={order} />
    </SheetView>
  );
}
