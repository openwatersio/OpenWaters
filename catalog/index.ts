import type { CatalogEntry } from "./types";
import googleEarth from "./google-earth.json";
import noaaRaster from "./noaa-raster";
import openseamap from "./openseamap.json";
import sentinel2Cloudless from "./sentinel-2-cloudless.json";
import vectorcharts from "./vectorcharts.json";

export type { CatalogEntry, CatalogSource, CatalogSourceType, StyleSource, RasterSource, MBTilesSource, PMTilesSource } from "./types";

export default async function loadCatalog(): Promise<CatalogEntry[]> {
  return [await noaaRaster(), openseamap, googleEarth, sentinel2Cloudless, vectorcharts] as CatalogEntry[];
}
