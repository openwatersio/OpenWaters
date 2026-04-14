// -- Source types --

import type { DepthUnit } from "@/hooks/usePreferredUnits";

export type Theme = "day" | "dusk" | "night";

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
  /** Only include this source when the active theme matches. Omit to include regardless of theme. */
  theme?: Theme;
  /** Only include this source when the preferred depth unit matches. Omit to include regardless of units. */
  units?: DepthUnit;
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
