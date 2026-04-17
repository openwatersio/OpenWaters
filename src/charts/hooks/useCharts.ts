import log from "@/logger";
import type { CatalogSource } from "@/charts/catalog/types";
import { generateStyle } from "@/charts/install";
import {
  readCatalog,
  useChartStore,
  type InstalledChart,
} from "@/charts/store";
import { readLocalPaths } from "@/charts/style";
import { resolveTheme, useThemePreference } from "@/charts/theme";
import { usePreferredUnits } from "@/hooks/usePreferredUnits";
import { useCameraPosition } from "@/map/hooks/useCameraPosition";
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
 * 5 minutes is fine-grained enough to catch the dusk/day/night transitions
 * without burning cycles.
 */
const AUTO_THEME_TICK_MS = 5 * 60_000;

/**
 * Resolve the active theme from the user's preference, using the last
 * known camera position as a proxy for location when in "auto" mode.
 */
export function useActiveTheme() {
  const { preference } = useThemePreference();
  const { center } = useCameraPosition();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (preference !== "auto") return;
    const id = setInterval(() => setTick((t) => t + 1), AUTO_THEME_TICK_MS);
    return () => clearInterval(id);
  }, [preference]);

  return useMemo(() => {
    const [longitude, latitude] = center ?? [];
    return resolveTheme(preference, { latitude, longitude });
    // `tick` forces re-resolution on auto-mode timer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preference, center, tick]);
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
    if (!chart) {
      setStyle(null);
      return;
    }

    let cancelled = false;

    (async () => {
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
