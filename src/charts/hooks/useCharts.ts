import type { CatalogSource, Theme } from "@/charts/catalog/types";
import { generateStyle } from "@/charts/install";
import {
  readCatalog,
  useChartStore,
  type InstalledChart,
} from "@/charts/store";
import { readLocalPaths } from "@/charts/style";
import { resolveTheme, useThemePreference } from "@/charts/theme";
import { toCoordinates } from "@/geo";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import log from "@/logger";
import { cameraPositionState } from "@/map/hooks/useCameraPosition";
import { getPosition } from "@/navigation/hooks/useNavigation";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useState } from "react";

const logger = log.extend("charts");

export type { InstalledChart };

/** Get all installed charts as a sorted array */
export function useCharts(): InstalledChart[] {
  const { charts } = useChartStore();
  return useMemo(
    () =>
      (Object.values(charts) as InstalledChart[]).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [charts],
  );
}

/** Get a single installed chart by ID */
export function useChart(chartId: string): InstalledChart | undefined {
  return useChartStore().charts[chartId] as InstalledChart | undefined;
}

/**
 * How often to re-evaluate the active theme when in "auto" mode (ms).
 */
const AUTO_THEME_TICK_MS = 1 * 60_000;

/**
 * Resolve the active theme from the user's preference, using the device
 * position when in "auto" mode, falling back to the camera center until
 * GPS acquires a lock.
 *
 * Position is read imperatively (not via `usePosition()`): subscribing
 * reactively would re-render every theme consumer — and the whole map tree —
 * on every 1 Hz GPS fix. Instead the theme re-resolves on a coarse timer
 * (`AUTO_THEME_TICK_MS`), reading the current position each tick. The sun calc
 * only needs coarse position + time, both of which change far slower than the
 * tick, so the timer alone suffices — no position subscription needed.
 */
export function useActiveTheme() {
  const { preference } = useThemePreference();
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    const update = () =>
      setTheme(
        resolveTheme(
          preference,
          getPosition() || toCoordinates(cameraPositionState.center),
        ),
      );
    update(); // re-resolve immediately on a preference change
    if (preference !== "auto") return; // a fixed theme never changes on a timer
    const id = setInterval(update, AUTO_THEME_TICK_MS);
    return () => clearInterval(id);
  }, [preference]);

  return theme;
}

/** Get the active source filters (theme + preferred depth units). */
export function useSourceFilters() {
  const theme = useActiveTheme();
  const { depth: units } = usePreferredUnits();
  return useMemo(() => ({ theme, units }), [theme, units]);
}

const EMPTY_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

/**
 * Get the style for the currently selected chart, filtered by the user's
 * active theme and preferred depth units.
 *
 * Returns a StyleSpecification object (not a URI) so that each regeneration
 * yields a fresh object reference, forcing MapLibre to reload the style
 * even though the on-disk path is stable.
 *
 * Falls back to the first installed chart if none is selected, or to an
 * empty style if no charts are installed.
 */
export function useMapStyle(): StyleSpecification | string {
  const charts = useCharts();
  const { selectedChartId } = useChartStore();
  const filters = useSourceFilters();

  const chart = useMemo(
    () => charts.find((c) => c.id === selectedChartId) ?? charts[0],
    [charts, selectedChartId],
  );

  const [style, setStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!chart) {
        if (!cancelled) setStyle(null);
        return;
      }

      const catalog = readCatalog(chart.id);
      if (!catalog) return;

      const localPaths = readLocalPaths(chart.id);
      const sources: CatalogSource[] = catalog.sources.map((source) => {
        if (
          (source.type === "mbtiles" || source.type === "pmtiles") &&
          localPaths[source.id]
        ) {
          return { ...source, url: localPaths[source.id] };
        }
        return source;
      });

      try {
        const next = await generateStyle(sources, filters);
        if (!cancelled) setStyle(next);
      } catch (err) {
        logger.warn(`Failed to generate style for ${chart.id}:`, err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, filters]);

  return style ?? EMPTY_STYLE;
}
