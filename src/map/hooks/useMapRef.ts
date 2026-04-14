import type { MapRef } from "@maplibre/maplibre-react-native";

/**
 * Module-level map ref shared between ChartView and other screens that need
 * to query the map (e.g. location view querying rendered features).
 */
export const mapRef: { current: MapRef | null } = { current: null };

