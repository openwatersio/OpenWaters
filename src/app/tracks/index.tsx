import { type TracksOrder } from "@/database";
import TrackList from "@/tracks/components/TrackList";
import SheetView from "@/ui/SheetView";
import { router, Stack, StackToolbarMenuActionProps } from "expo-router";
import { useState } from "react";

export default function TracksIndex() {
  const [order, setOrder] = useState<TracksOrder>("date");
  const orderOptions: { label: string, value: TracksOrder, icon: StackToolbarMenuActionProps["icon"] }[] = [
    { label: "Recent", value: "date", icon: "clock" },
    { label: "Distance", value: "distance", icon: "lines.measurement.vertical" },
    { label: "Duration", value: "duration", icon: "stopwatch" },
    { label: "Speed", value: "speed", icon: "hare" },
    { label: "Nearby", value: "nearby", icon: "location" },
  ]

  return (
    <SheetView id="tracks">
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Menu icon="line.3.horizontal.decrease">
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
      <TrackList order={order} />
    </SheetView>
  );
}
