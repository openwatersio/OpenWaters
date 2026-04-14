import type { CatalogEntry, CatalogSource } from "@/catalog/types";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";
import { deletePacksForChart } from "@/lib/charts/offline";
import {
  chartDirectory,
  getChart,
  removeChart,
  setChart,
  writeCatalog,
  writeStyle,
  type InstalledChart,
} from "@/lib/charts/store";

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
): Promise<StyleSpecification> {
  // Single style source — fetch the remote style and return its contents
  if (sources.length === 1 && sources[0].type === "style") {
    const response = await fetch(sources[0].url);
    if (!response.ok) {
      throw new Error(`Failed to fetch style: ${response.status}`);
    }
    return (await response.json()) as StyleSpecification;
  }

  const spec: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [],
  };

  for (const source of sources) {
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

  return spec;
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

  // Write catalog.json
  writeCatalog(entry.id, entry);

  // Generate and write style.json from online-renderable sources
  const style = await generateStyle(entry.sources);
  const styleUri = writeStyle(entry.id, style);

  const chart: InstalledChart = {
    id: entry.id,
    name: entry.title,
    styleUri,
    catalogEntry: entry,
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
