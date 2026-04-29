import type { CatalogEntry } from "./types";
import esriWorldImagery from "./esri-world-imagery.json";
import njord from "./njord.json";
import noaaRaster from "./noaa-raster";
import openseamap from "./openseamap.json";
import sentinel2Cloudless from "./sentinel-2-cloudless.json";

export type { CatalogEntry, CatalogSource, CatalogSourceType, StyleSource, RasterSource, MBTilesSource, PMTilesSource } from "./types";

export default async function loadCatalog(): Promise<CatalogEntry[]> {
  return [await noaaRaster(), njord, openseamap, esriWorldImagery, sentinel2Cloudless] as CatalogEntry[];
}
