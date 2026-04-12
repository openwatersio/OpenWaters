// -- Source types --

type SourceBase = {
  id: string;
  title: string;
  bounds?: [number, number, number, number];
  minzoom?: number;
  maxzoom?: number;
  attribution?: string;
  tileSize?: number;
  scheme?: "xyz" | "tms";
  sizeBytes?: number;
  updated?: string;
};

export type StyleSource = SourceBase & {
  type: "style";
  url: string;
};

export type RasterSource = SourceBase & {
  type: "raster";
  url?: string;
  tiles?: string[];
};

export type MBTilesSource = SourceBase & {
  type: "mbtiles";
  url: string;
};

export type PMTilesSource = SourceBase & {
  type: "pmtiles";
  url: string;
};

export type CatalogSource =
  | StyleSource
  | RasterSource
  | MBTilesSource
  | PMTilesSource;

export type CatalogSourceType = CatalogSource["type"];

// -- Entry types --

export type CatalogEntry = {
  id: string;
  title: string;
  summary: string;
  description: string;
  homepage?: string;
  license: string;
  keywords?: string[];
  thumbnail?: string;
  featured?: boolean;
  sources: CatalogSource[];
};
