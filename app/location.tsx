import { CloseButton } from "@/components/CloseButton";
import Button from "@/components/ui/Button";
import { useNavigationState } from "@/hooks/useNavigationState";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useSelectedLocation } from "@/hooks/useSelectedLocation";
import { useSheetReporter } from "@/hooks/useSheetPosition";
import useTheme from "@/hooks/useTheme";
import { bearingDegrees, distanceMeters, formatBearing } from "@/lib/geo";
import { CoordinateFormat } from "coordinate-format";
import * as Clipboard from "expo-clipboard";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { showLocation } from "react-native-map-link";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

export default function LocationScreen() {
  const location = useSelectedLocation();
  const nav = useNavigationState();
  const units = usePreferredUnits();
  const theme = useTheme();
  const { onLayout: onSheetLayout, ref: sheetRef } = useSheetReporter("location");

  useEffect(() => {
    return () => location.clear();
  }, [location.clear]);

  const [latStr, lonStr] = useMemo(
    () => (location.coordinates ? formatCoords(location.coordinates.latitude, location.coordinates.longitude) : ["--", "--"]),
    [location.coordinates],
  );

  const distBearing = useMemo(() => {
    if (!location.coordinates) return null;
    if (!nav.coords?.latitude || !nav.coords?.longitude) return null;
    const dist = distanceMeters(nav.coords.latitude, nav.coords.longitude, location.coordinates.latitude, location.coordinates.longitude);
    const bearing = bearingDegrees(nav.coords.latitude, nav.coords.longitude, location.coordinates.latitude, location.coordinates.longitude);
    return { dist, bearing };
  }, [location.coordinates, nav.coords?.latitude, nav.coords?.longitude]);

  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopyCoords = useCallback(() => {
    if (!location.coordinates) return;
    Clipboard.setStringAsync(`${latStr} ${lonStr}`);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [location.coordinates, latStr, lonStr]);

  const handleShare = useCallback(() => {
    if (!location.coordinates) return;
    const coords = `${latStr} ${lonStr}`;
    Share.share({
      message: `${coords}\ngeo:${location.coordinates.latitude},${location.coordinates.longitude}`,
    });
  }, [location.coordinates, latStr, lonStr]);

  const handleToggleMove = useCallback(() => {
    location.setMoving(!location.moving);
  }, [location.moving, location.setMoving]);

  if (!location.coordinates) return null;

  const distFormatted = distBearing ? units.toDistance(distBearing.dist) : null;
  const bearingFormatted = distBearing ? formatBearing(distBearing.bearing) : null;

  return (
    <View ref={sheetRef} onLayout={onSheetLayout} style={styles.container}>
      {/* Header: Share + Close */}
      <View style={styles.header}>
        <Pressable onPress={handleShare} hitSlop={4}>
          <SymbolView name="square.and.arrow.up" size={20} tintColor="rgba(255,255,255,0.5)" weight="semibold" style={{ padding: 6 }} />
        </Pressable>
        <CloseButton />
      </View>

      {/* Coordinates */}
      <Pressable onPress={handleCopyCoords} style={styles.coordsContainer}>
        <Text style={[styles.coordText, { color: theme.textPrimary }]}>{latStr}</Text>
        <Text style={[styles.coordText, { color: theme.textPrimary }]}>{lonStr}</Text>
        {copied && (
          <Text style={[styles.copiedLabel, { color: theme.primary }]}>Copied</Text>
        )}
      </Pressable>

      {/* Distance & Bearing from current location */}
      {distBearing && (
        <View style={styles.distBearingRow}>
          <SymbolView name="location.fill" size={14} tintColor={theme.textSecondary} />
          <Text style={[styles.distBearingText, { color: theme.textSecondary }]}>
            {distFormatted?.value} {distFormatted?.abbr} &middot; {bearingFormatted}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          label={location.moving ? "Done" : "Move"}
          onPress={handleToggleMove}
          systemImage={location.moving ? "checkmark" : "arrow.up.and.down.and.arrow.left.and.right"}
          variant={location.moving ? "bordered" : "default"}
          color={location.moving ? theme.success : undefined}
        />
        <Button
          label="Open in Maps"
          onPress={() => showLocation({
            latitude: location.coordinates!.latitude,
            longitude: location.coordinates!.longitude,
            title: `${latStr} ${lonStr}`,
          })}
          systemImage="map"
        />
        <Button
          label="Add Waypoint"
          onPress={() => Alert.alert("Coming Soon", "Waypoints will be available in a future update.")}
          systemImage="mappin.and.ellipse"
          color={theme.textTertiary}
        />
      </View>

      {/* Map Features */}
      {location.features.length > 0 && (
        <View style={styles.featuresSection}>
          <Text style={[styles.featuresTitle, { color: theme.textSecondary }]}>Chart Features</Text>
          {location.features.map((feature, i) => (
            <View key={i} style={[styles.featureItem, { backgroundColor: theme.surfaceElevated }]}>
              {Object.entries(feature.properties ?? {})
                .filter(([key]) => !key.startsWith("_") && key !== "id")
                .slice(0, 5)
                .map(([key, value]) => (
                  <Text key={key} style={[styles.featureProperty, { color: theme.textPrimary }]}>
                    <Text style={{ color: theme.textSecondary }}>{key}: </Text>
                    {String(value)}
                  </Text>
                ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  coordsContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  coordText: {
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  copiedLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  distBearingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  distBearingText: {
    fontSize: 15,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  featuresSection: {
    gap: 8,
  },
  featuresTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  featureItem: {
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  featureProperty: {
    fontSize: 14,
  },
});
