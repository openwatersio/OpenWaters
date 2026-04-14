import { usePosition } from "@/hooks/useNavigation";
import { toDistance } from "@/hooks/usePreferredUnits";
import { formatBearing } from "@/lib/geo";
import { HStack, Image, Spacer, Text } from "@expo/ui/swift-ui";
import { font, foregroundStyle, monospacedDigit } from "@expo/ui/swift-ui/modifiers";
import { getDistance, getGreatCircleBearing } from "geolib";
import { useMemo } from "react";

type Props = {
  latitude: number;
  longitude: number;
};

export default function DistanceAndBearingText({ latitude, longitude }: Props) {
  const position = usePosition();

  const formatted = useMemo(() => {
    if (!position) return null;
    const dist = getDistance(position, { latitude, longitude });
    const bearing = getGreatCircleBearing(position, { latitude, longitude });
    return {
      distance: toDistance(dist),
      bearing: formatBearing(bearing),
    };
  }, [latitude, longitude, position]);

  if (!formatted) return null;

  return (
    <HStack spacing={6}>
      <Spacer />
      <Image systemName="location.fill" size={14} color="secondary" />
      <Text modifiers={[
        font({ size: 15, weight: "medium" }),
        monospacedDigit(),
        foregroundStyle("secondary"),
      ]}>
        {`${formatted.distance.value} ${formatted.distance.abbr} at ${formatted.bearing}`}
      </Text>
      <Spacer />
    </HStack>
  );
}
