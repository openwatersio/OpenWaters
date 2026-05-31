import esriWorldImagery from "./esri-world-imagery.json";
import njord from "./njord.json";
import noaaRaster from "./noaa-raster";
import openseamap from "./openseamap.json";
import sentinel2Cloudless from "./sentinel-2-cloudless.json";
import type { CatalogEntry } from "./types";

export type {
  CatalogEntry,
  CatalogSource,
  CatalogSourceType,
  MBTilesSource,
  PMTilesSource,
  RasterSource,
  StyleSource,
} from "./types";

export default function loadCatalog(): CatalogEntry[] {
  return [
    njord,
    openseamap,
    esriWorldImagery,
    sentinel2Cloudless,
    noaaRaster,
  ] as CatalogEntry[];
}

/**
 * Catalog entries marked `featured` — installed on first run and used as the
 * default selection. Returned in catalog order, so the first featured entry is
 * the fallback selection when the user hasn't chosen a chart.
 */
export function featuredCharts(): CatalogEntry[] {
  return loadCatalog().filter((entry) => entry.featured);
}
