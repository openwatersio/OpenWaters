import log from "@/logger";
import { featuredCharts } from "@/charts/catalog";
import type { CatalogEntry, CatalogSource } from "@/charts/catalog/types";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { deletePacksForChart } from "@/charts/offline";
import { filterSources, type SourceFilters } from "@/charts/sources";
import {
  chartDirectory,
  chartStoreState,
  getChart,
  removeChart,
  setChart,
  writeCatalog,
  writeStyle,
  type InstalledChart,
} from "@/charts/store";

const logger = log.extend("charts");

// ---------------------------------------------------------------------------
// Style generation
// ---------------------------------------------------------------------------

/**
 * Generate a MapLibre StyleSpecification from catalog sources.
 *
 * Only includes sources that can render right now:
 * - `style` sources: fetched from the URL and returned as-is (the remote
 *   style JSON contains tile sources, sprites, glyphs, etc.)
 * - `raster` sources: always (XYZ tiles stream over the network)
 * - `mbtiles` / `pmtiles` sources: only if they have a local path (not a
 *   remote URL). Local paths are added as `mbtiles://` or `pmtiles://` sources.
 *
 * This is the equivalent of the old `buildMapStyle()` but writes to disk
 * instead of returning an in-memory object.
 */
export async function generateStyle(
  sources: CatalogSource[],
  filters: SourceFilters = {},
): Promise<StyleSpecification> {
  const filtered = filterSources(sources, filters);
  // User asked for a dark theme but the chart has no source tagged with it,
  // so filterSources fell back to day. Add a dim background-on-top layer so
  // the chart is readable at night and floating glass overlays sample dark
  // content underneath them.
  const wantsDark = filters.theme === "night" || filters.theme === "dusk";
  const hasRequestedVariant = sources.some((s) => s.theme === filters.theme);
  const needsDim = wantsDark && !hasRequestedVariant;

  // Single style source — fetch the remote style and return its contents
  if (filtered.length === 1 && filtered[0].type === "style") {
    const response = await fetch(filtered[0].url);
    if (!response.ok) {
      throw new Error(`Failed to fetch style: ${response.status}`);
    }
    const spec = (await response.json()) as StyleSpecification;
    if (needsDim) appendDimLayer(spec);
    return spec;
  }

  const spec: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
  };

  for (const source of filtered) {
    const sourceId = source.id;

    switch (source.type) {
      case "raster": {
        spec.sources[sourceId] = {
          type: "raster",
          ...(source.url && !source.tiles ? { url: source.url } : {}),
          ...(source.tiles ? { tiles: source.tiles } : {}),
          tileSize: source.tileSize ?? 256,
          ...(source.minzoom != null && { minzoom: source.minzoom }),
          ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
          ...(source.bounds && { bounds: source.bounds }),
          ...(source.attribution && { attribution: source.attribution }),
        };
        (spec.layers as unknown[]).push({
          id: `layer-${sourceId}`,
          type: "raster",
          source: sourceId,
        });
        break;
      }

      case "mbtiles": {
        // Only include local MBTiles — remote URLs can't render
        if (!source.url.startsWith("/")) break;
        spec.sources[sourceId] = {
          type: "raster",
          url: `mbtiles://${source.url}`,
          tileSize: source.tileSize ?? 256,
          ...(source.minzoom != null && { minzoom: source.minzoom }),
          ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
          ...(source.bounds && { bounds: source.bounds }),
          ...(source.attribution && { attribution: source.attribution }),
        };
        (spec.layers as unknown[]).push({
          id: `layer-${sourceId}`,
          type: "raster",
          source: sourceId,
        });
        break;
      }

      case "pmtiles": {
        // Only include local PMTiles — remote URLs can't render (pending spike)
        if (!source.url.startsWith("/")) break;
        spec.sources[sourceId] = {
          type: "raster",
          url: `pmtiles://${source.url}`,
          tileSize: source.tileSize ?? 256,
          ...(source.minzoom != null && { minzoom: source.minzoom }),
          ...(source.maxzoom != null && { maxzoom: source.maxzoom }),
          ...(source.bounds && { bounds: source.bounds }),
          ...(source.attribution && { attribution: source.attribution }),
        };
        (spec.layers as unknown[]).push({
          id: `layer-${sourceId}`,
          type: "raster",
          source: sourceId,
        });
        break;
      }

      case "style":
        // Multiple style sources can't be composed — skip.
        // Single style is handled above.
        break;
    }
  }

  if (needsDim) appendDimLayer(spec);
  return spec;
}

/**
 * Append a semi-opaque black background layer at the end of the layer list.
 * MapLibre renders layers in array order, so the last entry draws on top of
 * everything else — yielding a dim overlay on the chart content.
 */
function appendDimLayer(spec: StyleSpecification): void {
  (spec.layers as unknown[]).push({
    id: "openwaters-night-dim",
    type: "background",
    paint: { "background-color": "rgba(0, 0, 0, 0.5)" },
  });
}

// ---------------------------------------------------------------------------
// Install / uninstall
// ---------------------------------------------------------------------------

/**
 * Install a catalog entry: write catalog.json + style.json, update the store.
 * No-ops if the chart is already installed.
 */
export async function installCatalogEntry(entry: CatalogEntry): Promise<InstalledChart> {
  const existing = getChart(entry.id);
  if (existing) return existing;

  // Resolve any install-time sources (e.g. NOAA's per-region MBTiles list),
  // then drop the (non-serializable) resolve hook before persisting.
  const extra = entry.resolve ? await entry.resolve() : [];
  const resolved: CatalogEntry = {
    ...entry,
    sources: extra.length ? [...entry.sources, ...extra] : entry.sources,
  };
  delete resolved.resolve;

  // Write catalog.json
  writeCatalog(resolved.id, resolved);

  // Generate and write style.json from online-renderable sources
  const style = await generateStyle(resolved.sources);
  const styleUri = writeStyle(resolved.id, style);

  const chart: InstalledChart = {
    id: resolved.id,
    name: resolved.title,
    styleUri,
    catalogEntry: resolved,
  };

  setChart(chart);
  return chart;
}

/**
 * Install a manually created chart from detected sources.
 * Generates a chart ID from the name, writes catalog.json + style.json.
 */
export async function installManualChart(
  name: string,
  sources: CatalogSource[],
): Promise<InstalledChart> {
  const id = slugify(name);

  const existing = getChart(id);
  if (existing) {
    throw new Error(`A chart named "${name}" already exists`);
  }

  const entry: CatalogEntry = {
    id,
    title: name,
    summary: "",
    description: "",
    license: "",
    sources,
  };

  writeCatalog(id, entry);

  const style = await generateStyle(sources);
  const styleUri = writeStyle(id, style);

  const chart: InstalledChart = {
    id,
    name,
    styleUri,
    catalogEntry: entry,
  };

  setChart(chart);
  return chart;
}

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) {
    return `chart-${Date.now().toString(36)}`;
  }
  return slug;
}

/**
 * Uninstall a chart: delete the directory and all associated files.
 */
export function uninstallChart(chartId: string): void {
  // Clean up OfflineManager tile packs (best-effort, async)
  deletePacksForChart(chartId).catch(() => {});

  // Delete the chart directory
  const dir = chartDirectory(chartId);
  if (dir.exists) {
    dir.delete();
  }

  // Update the store
  removeChart(chartId);
}

// ---------------------------------------------------------------------------
// First-run defaults
// ---------------------------------------------------------------------------

/**
 * Install the default (`featured`) charts when the app has no charts at all —
 * i.e. a fresh install. Once any chart exists we never re-seed, so a default
 * the user uninstalls won't come back (and uninstalling everything re-seeds).
 *
 * Also sets the selection to the first featured chart that installed, so the
 * user opens to the primary nautical chart rather than whichever sorts first.
 */
export async function seedDefaultCharts(): Promise<void> {
  if (Object.keys(chartStoreState.charts).length > 0) return;

  const featured = featuredCharts();
  for (const entry of featured) {
    try {
      await installCatalogEntry(entry);
    } catch (err) {
      logger.warn(`Failed to seed default chart "${entry.id}":`, err);
    }
  }

  if (!chartStoreState.selectedChartId) {
    const firstInstalled = featured.find((entry) => getChart(entry.id));
    if (firstInstalled) chartStoreState.selectedChartId = firstInstalled.id;
  }
}
