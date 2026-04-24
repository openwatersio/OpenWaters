import type { Marker } from "@/database";
import { formatBearing } from "@/geo";
import { toDistance } from "@/hooks/usePreferredUnits";
import useTheme from "@/hooks/useTheme";
import { createStyles } from "@/hooks/useStyles";
import { AnnotationIcon } from "@/map/components/AnnotationIcon";
import { deleteMarker, updateMarker } from "@/markers/hooks/useMarkers";
import { getPosition } from "@/navigation/hooks/useNavigation";
import { CoordinateFormat } from "coordinate-format";
import { router } from "expo-router";
import { memo } from "react";
import {
  ActionSheetIOS,
  Alert,
  PlatformColor,
  Pressable,
  Text,
  View,
} from "react-native";
import { getDistance, getGreatCircleBearing } from "geolib";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(latitude: number, longitude: number): string {
  const [longitudeStr, latitudeStr] = coordFormat.format(longitude, latitude);
  return `${latitudeStr}  ${longitudeStr}`;
}

function markerDisplayName(marker: Marker): string {
  return marker.name ?? `Marker ${marker.id}`;
}

function getDistanceLabel(marker: Marker): string | null {
  const position = getPosition();
  if (!position) return null;
  const dist = getDistance(position, marker);
  const formatted = toDistance(dist);
  const bearing = getGreatCircleBearing(position, marker);
  return `${formatted.value} ${formatted.abbr} ${formatBearing(bearing)}`;
}

function confirmDelete(marker: Marker) {
  Alert.alert(
    "Delete Marker",
    `Delete "${markerDisplayName(marker)}"?`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMarker(marker.id) },
    ],
  );
}

function promptRename(marker: Marker) {
  Alert.prompt(
    "Rename Marker",
    undefined,
    (name: string) => updateMarker(marker.id, { name: name || null }),
    "plain-text",
    marker.name ?? "",
  );
}

function showMarkerActions(marker: Marker) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: markerDisplayName(marker),
      options: ["Rename", "Delete", "Cancel"],
      destructiveButtonIndex: 1,
      cancelButtonIndex: 2,
    },
    (index) => {
      if (index === 0) promptRename(marker);
      else if (index === 1) confirmDelete(marker);
    },
  );
}

type Props = {
  marker: Marker;
};

const MarkerListItem = memo(
  function MarkerListItem({ marker }: Props) {
    const theme = useTheme();
    const styles = useStyles();
    const distLabel = getDistanceLabel(marker);
    const coordsLabel = formatCoords(marker.latitude, marker.longitude);

    return (
      <Pressable
        onPress={() =>
          router.dismissTo({
            pathname: "/feature/[type]/[id]",
            params: { type: "marker", id: String(marker.id) },
          })
        }
        onLongPress={() => showMarkerActions(marker)}
        style={({ pressed }) => [
          styles.row,
          pressed && { backgroundColor: PlatformColor("systemFill") },
        ]}
      >
        <View
          style={[
            styles.icon,
            { backgroundColor: marker.color ? theme.adapt(marker.color) : theme.markers },
          ]}
        >
          <AnnotationIcon name={marker.icon ?? "pin"} color={theme.contrast} size={18} />
        </View>

        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {markerDisplayName(marker)}
            </Text>
            {distLabel && <Text style={styles.distance}>{distLabel}</Text>}
          </View>
          <Text style={styles.coords}>{coordsLabel}</Text>
        </View>
      </Pressable>
    );
  },
  (prev, next) =>
    prev.marker.id === next.marker.id &&
    prev.marker.name === next.marker.name &&
    prev.marker.latitude === next.marker.latitude &&
    prev.marker.longitude === next.marker.longitude &&
    prev.marker.color === next.marker.color &&
    prev.marker.icon === next.marker.icon,
);

export default MarkerListItem;

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 2 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: { fontSize: 16, fontWeight: "600", flexShrink: 1, color: theme.label },
  distance: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: theme.labelSecondary,
  },
  coords: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: theme.labelSecondary,
  },
}));
