import type { StyleSpecification } from "@maplibre/maplibre-react-native";

import type { ChartSourceRow } from "@/lib/database";

// -- Options types per chart source type --

export type StyleOptions = {
  url: string;
};

export type RasterOptions = {
  tiles: string[];
  tileSize?: number;
  minZoom?: number;
  maxZoom?: number;
  attribution?: string;
};

export type ChartSourceType = "style" | "raster" | "custom";

export type ChartSource = Omit<ChartSourceRow, "is_builtin" | "type"> & {
  type: ChartSourceType;
  isBuiltin: boolean;
};

export function parseChartSource(row: ChartSourceRow): ChartSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ChartSourceType,
    options: row.options,
    isBuiltin: row.is_builtin === 1,
  };
}

export function buildMapStyle(
  source: ChartSource,
): StyleSpecification | string {
  switch (source.type) {
    case "style": {
      const opts = JSON.parse(source.options) as StyleOptions;
      return opts.url;
    }

    case "raster": {
      const opts = JSON.parse(source.options) as RasterOptions;
      return {
        version: 8,
        sources: {
          chart: {
            type: "raster",
            tiles: opts.tiles,
            tileSize: opts.tileSize ?? 256,
            ...(opts.minZoom != null && { minzoom: opts.minZoom }),
            ...(opts.maxZoom != null && { maxzoom: opts.maxZoom }),
            ...(opts.attribution && { attribution: opts.attribution }),
          },
        },
        layers: [{ id: "chart", type: "raster", source: "chart" }],
      } as StyleSpecification;
    }

    case "custom": {
      return JSON.parse(source.options) as StyleSpecification;
    }

    default:
      throw new Error(`Unsupported chart source type: ${source.type}`);
  }
}
