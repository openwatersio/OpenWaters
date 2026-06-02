import ChartFeatureDetail from "@/charts/components/ChartFeatureDetail";
import DistanceAndBearingText from "@/map/components/DistanceAndBearingText";
import NearbyList from "@/map/components/NearbyList";
import SheetMenu from "@/map/components/SheetMenu";
import { chartFeatureIdAtCoordinate } from "@/map/featureAtPoint";
import { cameraPositionState } from "@/map/hooks/useCameraPosition";
import { mapRef } from "@/map/hooks/useMapRef";
import SheetHeader from "@/ui/SheetHeader";
import { Form, Host, Section } from "@expo/ui/swift-ui";
import { CoordinateFormat } from "coordinate-format";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";

const coordFormat = new CoordinateFormat("minutes");

function formatCoords(lat: number, lon: number): [string, string] {
  const [lonStr, latStr] = coordFormat.format(lon, lat);
  return [latStr, lonStr];
}

/**
 * The detail for a selected point on the map. The selection is fundamentally a
 * coordinate ("lon,lat"); this component resolves whether a discrete chart
 * feature sits there and, if so, renders its `ChartFeatureDetail` instead of the
 * bare location info.
 *
 * An already-identified feature arrives as "lon,lat,LNAM" (from the nearby list,
 * or a prior resolve) and skips the lookup. After a fresh lookup we rewrite the
 * route id to "lon,lat,LNAM" so the pin snaps onto the feature and the selection
 * is stable across re-renders.
 */
export default function LocationDetail({ id }: { id: string }) {
  const parts = id.split(",");
  const longitude = Number(parts[0]);
  const latitude = Number(parts[1]);
  const lnam = parts[2];

  const [latStr, lonStr] = useMemo(() => formatCoords(latitude, longitude), [latitude, longitude]);

  // The resolved chart-feature id ("lon,lat,LNAM") at this coordinate, or null
  // for open water. Seeded from an LNAM hint; otherwise resolved by querying the
  // map. While null we show the plain location info (the common open-water case).
  const [chartId, setChartId] = useState<string | null>(lnam ? id : null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (lnam) {
        if (!cancelled) setChartId(id);
        return;
      }
      setChartId(null);
      const map = mapRef.current;
      if (!map) return;
      let resolved: string | null = null;
      try {
        const rendered = ((await map.queryRenderedFeatures()) ??
          []) as unknown as GeoJSON.Feature[];
        resolved = chartFeatureIdAtCoordinate(
          rendered,
          { latitude, longitude },
          cameraPositionState.zoom ?? 12,
        );
      } catch {
        resolved = null;
      }
      if (cancelled || !resolved) return;
      setChartId(resolved);
      // Snap the selection pin onto the feature and record its LNAM so a
      // re-render (or return trip) doesn't re-query.
      router.setParams({ id: resolved });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, lnam, longitude, latitude]);

  if (chartId) return <ChartFeatureDetail id={chartId} />;

  return (
    <>
      <SheetHeader title="Location" subtitle={[latStr, lonStr].join(", ")} />
      <SheetMenu
        coordinate={{ latitude, longitude }}
        title={`${latStr} ${lonStr}`}
      />
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <DistanceAndBearingText latitude={latitude} longitude={longitude} />
          </Section>
          <NearbyList center={{ latitude: latitude, longitude: longitude }} />
        </Form>
      </Host>
    </>
  );
}
