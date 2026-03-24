import SheetHeader from "@/components/ui/SheetHeader";
import { mapRef } from "@/hooks/useMapRef";
import { addMarker } from "@/hooks/useMarkers";
import { usePosition } from "@/hooks/useNavigation";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { formatBearing } from "@/lib/geo";
import { getDistance, getGreatCircleBearing } from "geolib";
import {
  Button,
  Host, HStack,
  Image,
  ScrollView,
  Spacer,
  Text,
  VStack
} from "@expo/ui/swift-ui";
import {
  background,
  buttonStyle,
  controlSize,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  monospacedDigit,
  offset,
  padding,
  tint
} from "@expo/ui/swift-ui/modifiers";
import { CoordinateFormat } from "coordinate-format";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { showLocation } from "react-native-map-link";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

export default function LocationDetail({ id }: { id: string }) {
  const [lon, lat] = id.split(",").map(Number) as [number, number];
  const [features, setFeatures] = useState<GeoJSON.Feature[]>([]);
  const position = usePosition();
  const theme = useTheme();

  useEffect(() => {
    mapRef.current?.project([lon, lat]).then((point) => {
      mapRef.current?.queryRenderedFeatures(point).then((result) => {
        setFeatures(result ?? []);
      });
    });
  }, [lon, lat]);

  const [latStr, lonStr] = useMemo(
    () => formatCoords(lat, lon),
    [lat, lon],
  );

  const distBearing = useMemo(() => {
    if (!position) return null;
    const dist = getDistance(position, { latitude: lat, longitude: lon });
    const bearing = getGreatCircleBearing(position, { latitude: lat, longitude: lon });
    return { dist, bearing };
  }, [lat, lon, position]);

  const distFormatted = distBearing ? toDistance(distBearing.dist) : null;
  const bearingFormatted = distBearing ? formatBearing(distBearing.bearing) : null;

  return (
    <>
      <SheetHeader
        title="Location"
        subtitle={[latStr, lonStr].join(", ")}
        headerLeft={() => (
          <Host matchContents>
            <Button
              systemImage="square.and.arrow.up"
              onPress={() => showLocation({
                latitude: lat,
                longitude: lon,
                title: `${latStr} ${lonStr}`,
              })}
              modifiers={[
                labelStyle("iconOnly"),
                buttonStyle("borderless"),
                tint("primary"),
                offset({ y: -3 }),
              ]}
              label="Open In…"
            />
          </Host>
        )}
      />
      <Host style={{ flex: 1 }}>
        <ScrollView showsIndicators={false}>
          <VStack spacing={16} modifiers={[padding({ horizontal: 20, top: 16 })]}>
            {/* Distance & Bearing from current location */}
            {distBearing && (
              <HStack alignment="center" spacing={6}>
                <Spacer />
                <Image
                  systemName="location.fill"
                  size={14}
                  color={theme.textSecondary}
                />
                <Text modifiers={[
                  font({ size: 15, weight: "medium" }),
                  monospacedDigit(),
                  foregroundStyle("secondary"),
                ]}>
                  {`${distFormatted?.value} ${distFormatted?.abbr} away at ${bearingFormatted}`}
                </Text>
                <Spacer />
              </HStack>
            )}

            {/* Action Buttons */}
            <HStack spacing={10}>
              <Button
                onPress={async () => {
                  const marker = await addMarker({ latitude: lat, longitude: lon });
                  router.replace({ pathname: "/marker/edit", params: { id: marker.id } });
                }}
                modifiers={[
                  buttonStyle("bordered"),
                  controlSize("large"),
                  frame({ maxWidth: 9999 }),
                  tint("primary"),
                ]}
              >
                <VStack alignment="center" spacing={6}>
                  <Image systemName="mappin.and.ellipse" size={20} />
                  <Text modifiers={[font({ size: 13, weight: "medium" })]}>
                    Marker
                  </Text>
                </VStack>
              </Button>
              <Button
                onPress={() => {
                  router.replace({ pathname: "/route/new", params: { to: `${lon},${lat}` } });
                }}
                modifiers={[
                  buttonStyle("bordered"),
                  controlSize("large"),
                  frame({ maxWidth: 9999 }),
                  tint("primary"),
                ]}
              >
                <VStack alignment="center" spacing={6}>
                  <Image systemName="point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill" size={20} />
                  <Text modifiers={[font({ size: 13, weight: "medium" })]}>
                    Route
                  </Text>
                </VStack>
              </Button>
            </HStack>

            {/* Map Features */}
            {features.length > 0 && (
              <VStack alignment="leading" spacing={8}>
                <Text modifiers={[
                  font({ size: 12, weight: "semibold" }),
                  foregroundStyle(theme.textSecondary),
                ]}>
                  CHART FEATURES
                </Text>
                {features.map((feature, i) => (
                  <VStack key={i} alignment="leading" spacing={4} modifiers={[
                    padding({ all: 12 }),
                    background(theme.surfaceElevated),
                    cornerRadius(10),
                  ]}>
                    {Object.entries(feature.properties ?? {})
                      .filter(([key]) => !key.startsWith("_") && key !== "id")
                      .slice(0, 5)
                      .map(([key, value]) => (
                        <HStack key={key} spacing={4}>
                          <Text modifiers={[
                            font({ size: 14 }),
                            foregroundStyle(theme.textSecondary),
                          ]}>
                            {`${key}: `}
                          </Text>
                          <Text modifiers={[
                            font({ size: 14 }),
                            foregroundStyle(theme.textPrimary),
                          ]}>
                            {String(value)}
                          </Text>
                        </HStack>
                      ))}
                  </VStack>
                ))}
              </VStack>
            )}

          </VStack>
        </ScrollView>
      </Host>
    </>
  );
}
