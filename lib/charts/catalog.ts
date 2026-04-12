import { getAllCharts, insertChart, insertSource } from "@/lib/database";

/** Loose source shape accepted from JSON imports (where `type` is `string`). */
type SourceInput = {
  title: string;
  type: string;
  url?: string;
  tiles?: string[];
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  tileSize?: number;
  scheme?: "xyz" | "tms";
};

/** Loose entry shape accepted from JSON imports. */
type EntryInput = {
  id: string;
  title: string;
  sources: SourceInput[];
};

/**
 * Install a catalog entry into the local database.
 * Creates one `charts` row and one `sources` row per source in the entry.
 * No-ops if a chart with the same `catalog_entry_id` already exists.
 */
export async function installCatalogEntry(entry: EntryInput) {
  // Guard against duplicate installs
  const existing = await getAllCharts();
  if (existing.some((c) => c.catalog_entry_id === entry.id)) {
    return existing.find((c) => c.catalog_entry_id === entry.id)!;
  }

  const chart = await insertChart(entry.title, entry.id);

  for (const source of entry.sources) {
    await insertSource(chart.id, sourceToFields(source));
  }

  return chart;
}

function sourceToFields(source: SourceInput) {
  return {
    title: source.title,
    type: source.type,
    url: "url" in source ? source.url : undefined,
    tiles: "tiles" in source && source.tiles ? source.tiles : undefined,
    bounds: source.bounds ?? undefined,
    minzoom: source.minzoom ?? undefined,
    maxzoom: source.maxzoom ?? undefined,
    attribution: source.attribution ?? undefined,
    tileSize: source.tileSize ?? undefined,
    scheme: source.scheme ?? undefined,
  };
}
