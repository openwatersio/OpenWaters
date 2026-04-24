import type { MarkersOrder } from "@/database";
import MarkerList from "@/markers/components/MarkerList";
import SheetView from "@/ui/SheetView";
import { router, Stack, StackToolbarMenuActionProps } from "expo-router";
import { useState } from "react";

export default function MarkersIndex() {
  const [order, setOrder] = useState<MarkersOrder>("created");
  const orderOptions: {
    label: string;
    value: MarkersOrder;
    icon: StackToolbarMenuActionProps["icon"];
  }[] = [
    { label: "Recent", value: "created", icon: "clock" },
    { label: "Name", value: "name", icon: "character" },
    { label: "Nearby", value: "nearby", icon: "location" },
  ];

  return (
    <SheetView id="markers">
      <Stack.Screen options={{}} />
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
          onPress={() => router.dismissTo("/menu")}
        />
      </Stack.Toolbar>
      <MarkerList order={order} />
    </SheetView>
  );
}
