import SheetHeader from "@/components/ui/SheetHeader";
import { toDistance } from "@/hooks/usePreferredUnits";
import { startNavigation } from "@/hooks/useRouteNavigation";
import { handleDeleteRoute, handleRenameRoute } from "@/hooks/useRoutes";
import { getRoute, getRoutePoints, type Route, type RoutePoint } from "@/lib/database";
import { exportRouteAsGPX } from "@/lib/export";
import { formatBearing } from "@/lib/geo";
import { getDistance, getGreatCircleBearing } from "geolib";
import {
  Button,
  Form,
  Host,
  HStack,
  Menu,
  ScrollView,
  Section,
  Spacer,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  monospacedDigit,
  offset,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { showLocation } from "react-native-map-link";

function routeDisplayName(route: Route): string {
  return route.name || `Route ${route.id}`;
}

export default function RouteDetail({ id }: { id: string }) {
  const routeId = Number(id);

  const [route, setRoute] = useState<Route | null>(null);
  const [points, setPoints] = useState<RoutePoint[]>([]);

  useEffect(() => {
    getRoute(routeId).then(setRoute);
    getRoutePoints(routeId).then(setPoints);
  }, [routeId]);

  const legs = useMemo(() => {
    if (points.length < 2) return [];
    return points.slice(1).map((point, i) => {
      const prev = points[i];
      const dist = getDistance(prev, point);
      const bearing = getGreatCircleBearing(prev, point);
      return { from: prev, to: point, dist, bearing };
    });
  }, [points]);

  const totalDistance = useMemo(
    () => legs.reduce((sum, leg) => sum + leg.dist, 0),
    [legs],
  );

  const promptRename = useCallback(() => {
    Alert.prompt(
      "Rename Route",
      undefined,
      (name: string) => {
        handleRenameRoute(routeId, name);
        setRoute((r) => r ? { ...r, name } : r);
      },
      "plain-text",
      route?.name || "",
    );
  }, [routeId, route?.name]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Delete Route",
      `Delete "${route ? routeDisplayName(route) : "this route"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            handleDeleteRoute(routeId);
            router.dismiss();
          },
        },
      ],
    );
  }, [routeId, route]);

  const dist = toDistance(totalDistance);

  return (
    <>
      <SheetHeader
        title={route ? routeDisplayName(route) : ""}
        subtitle={points.length > 0
          ? `${points.length} ${points.length === 1 ? "waypoint" : "waypoints"} · ${dist.value} ${dist.abbr}`
          : undefined
        }
        headerLeft={() => (
          <Host matchContents>
            <Menu
              systemImage="square.and.arrow.up"
              label="Share"
              modifiers={[
                labelStyle("iconOnly"),
                buttonStyle("borderless"),
              ]}>
              <Button
                onPress={() => exportRouteAsGPX(routeId)}
                modifiers={[
                  tint("primary"),
                  offset({ y: -3 }),
                ]}
                label="Export GPX…"
              />
              {points.length > 0 && (
                <Button
                  onPress={() => {
                    const last = points[points.length - 1];
                    showLocation({
                      latitude: last.latitude,
                      longitude: last.longitude,
                      title: "Destination",
                    });
                  }}
                  modifiers={[
                    tint("primary"),
                    offset({ y: -3 }),
                  ]}
                  label="Open in…"
                />
              )}
            </Menu>
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <ScrollView showsIndicators={false}>
          {/* Waypoint list */}
          {points.length > 0 && (
            <VStack spacing={0} modifiers={[padding({ horizontal: 20, top: 12 })]}>
              {points.map((point, i) => {
                const leg = i > 0 ? legs[i - 1] : null;
                const legDist = leg ? toDistance(leg.dist) : null;
                const legBearing = leg ? formatBearing(leg.bearing) : null;

                return (
                  <VStack key={point.id} alignment="leading" spacing={4}>
                    {leg && (
                      <HStack spacing={6} modifiers={[padding({ leading: 20, vertical: 4 })]}>
                        <Text modifiers={[font({ size: 12 }), foregroundStyle("tertiary")]}>
                          ↓
                        </Text>
                        <Text modifiers={[font({ size: 12 }), monospacedDigit(), foregroundStyle("secondary")]}>
                          {legDist?.value} {legDist?.abbr} at {legBearing}
                        </Text>
                      </HStack>
                    )}
                    <HStack alignment="center" spacing={8} modifiers={[padding({ vertical: 4 })]}>
                      <Text modifiers={[font({ size: 13, weight: "medium" }), foregroundStyle("secondary"), frame({ width: 20 })]}>
                        {i + 1}
                      </Text>
                      <Text modifiers={[font({ size: 15, weight: "semibold" })]}>
                        {`Waypoint ${i + 1}`}
                      </Text>
                      <Spacer />
                    </HStack>
                  </VStack>
                );
              })}
            </VStack>
          )}

          <Form modifiers={[frame({ height: 250 })]}>
            {points.length >= 2 && (
              <Section>
                <Button
                  label="Navigate"
                  systemImage="location.fill"
                  onPress={() => {
                    startNavigation(routeId);
                    router.replace("/route/navigate");
                  }}
                  modifiers={[tint("primary")]}
                />
              </Section>
            )}
            <Section>
              <Button
                label="Edit"
                systemImage="pencil"
                onPress={() => router.push({ pathname: "/route/edit", params: { id: routeId } })}
              />
              <Button
                label="Rename"
                systemImage="character.cursor.ibeam"
                onPress={promptRename}
              />
              <Button
                label="Delete Route"
                systemImage="trash"
                role="destructive"
                onPress={confirmDelete}
              />
            </Section>
          </Form>
        </ScrollView>
      </Host>
    </>
  );
}
