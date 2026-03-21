import SheetHeader from "@/components/ui/SheetHeader";
import SheetView from "@/components/ui/SheetView";
import { loadRoutes } from "@/hooks/useRoutes";
import {
  deleteRoutePoint,
  getRoute,
  getRoutePoints,
  updateRoute,
  type Route,
  type RoutePoint
} from "@/lib/database";
import {
  Button,
  Form,
  Host,
  HStack,
  Section,
  Spacer,
  Text,
  TextField,
} from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  labelStyle,
  padding,
  tint
} from "@expo/ui/swift-ui/modifiers";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";

export default function EditRouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = Number(id);

  const [route, setRoute] = useState<Route | null>(null);
  const [points, setPoints] = useState<RoutePoint[]>([]);

  const reload = useCallback(() => {
    getRoute(routeId).then(setRoute);
    getRoutePoints(routeId).then(setPoints);
  }, [routeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = useCallback(() => {
    loadRoutes();
    router.dismiss();
  }, []);

  const handleDeletePoint = useCallback(
    async (pointId: number) => {
      await deleteRoutePoint(pointId);
      reload();
    },
    [reload],
  );

  if (!route) return null;

  return (
    <SheetView id="route-edit" style={{ flex: 1 }}>
      <SheetHeader
        title="Edit Route"
        headerRight={() => (
          <Host matchContents>
            <Button
              systemImage="checkmark"
              label="Done"
              onPress={handleSave}
              modifiers={[
                labelStyle("iconOnly"),
                tint("primary"),
                font({ weight: "semibold" }),
              ]}
            />
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <TextField
              placeholder="Route name"
              defaultValue={route.name ?? ""}
              onChangeText={(v) => updateRoute(routeId, { name: v.trim() || null })}
              autocorrection={false}
            />
          </Section>

          <Section header={<Text modifiers={[font({ size: 13 }), foregroundStyle("secondary")]}>Waypoints</Text>}>
            {points.map((point, i) => (
              <HStack
                key={point.id}
                alignment="center"
                spacing={8}
                modifiers={[padding({ vertical: 2 })]}
              >
                <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle("secondary")]}>
                  {i + 1}
                </Text>
                <Text modifiers={[font({ size: 15 })]}>
                  {`Waypoint ${i + 1}`}
                </Text>
                <Spacer />
                <Button
                  systemImage="xmark.circle.fill"
                  label="Remove"
                  role="destructive"
                  modifiers={[labelStyle("iconOnly"), tint("secondary")]}
                  onPress={() => handleDeletePoint(point.id)}
                />
              </HStack>
            ))}
          </Section>
        </Form>
      </Host>
    </SheetView>
  );
}
