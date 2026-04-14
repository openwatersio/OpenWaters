/**
 * Builds the NOAA Raster Charts catalog entry at runtime by fetching
 * NCDS MBTiles metadata from NOAA's ArcGIS feature service.
 *
 * Data source: NOAA's ArcGIS MapServer at gis.charttools.noaa.gov,
 * which provides the region name, download URL, file size, date, and
 * polygonal coverage geometry for each NCDS MBTiles region.
 */

const NOAA_FEATURE_SERVICE =
  "https://gis.charttools.noaa.gov/arcgis/rest/services/MarineChart_Services/ncds_tilecache_metadata/MapServer/0/query";

const OSM_BASE = {
  id: "osm-base",
  title: "OpenStreetMap Base",
  type: "raster",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
  maxzoom: 19,
  attribution: "© OpenStreetMap contributors",
};

const WMS_SOURCE = {
  id: "noaa-wms",
  title: "NOAA ENC Online (WMS, paper chart symbology)",
  type: "raster" as const,
  tiles: [
    "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&BBOX={bbox-epsg-3857}&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&LAYERS=0,1,2,3,4,5,6,7,8,9,10,11,12&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE",
  ],
  tileSize: 256,
  bounds: [-180, 13, -64, 72] as number[],
  attribution: "NOAA",
};

interface Feature {
  attributes: {
    name: string;
    baseline: string;
    date_creat: string;
    size: number;
  };
  geometry?: {
    rings: number[][][];
  };
}

function boundsFromRings(
  rings: number[][][],
): [number, number, number, number] {
  const xs = rings.flatMap((ring) => ring.map((p) => p[0]));
  const ys = rings.flatMap((ring) => ring.map((p) => p[1]));
  return [
    Math.round(Math.min(...xs) * 10000) / 10000,
    Math.round(Math.min(...ys) * 10000) / 10000,
    Math.round(Math.max(...xs) * 10000) / 10000,
    Math.round(Math.max(...ys) * 10000) / 10000,
  ];
}

function formatTitle(name: string): string {
  return name
    .replace("ncds_", "NCDS ")
    .replace(/([0-9]+)([a-z])?/, (_, num, letter) =>
      letter ? `${num}${letter.toUpperCase()}` : num,
    );
}

export default async function fetchNoaaRasterEntry() {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "name,baseline,date_creat,size",
    returnGeometry: "true",
    geometryPrecision: "4",
    f: "json",
    resultRecordCount: "200",
  });

  const response = await fetch(`${NOAA_FEATURE_SERVICE}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch NOAA NCDS metadata: ${response.status}`);
  }

  const data = (await response.json()) as { features: Feature[] };

  const mbtilesSources = data.features.map((f) => {
    const { name, baseline, date_creat, size } = f.attributes;
    const source: Record<string, unknown> = {
      id: name,
      title: formatTitle(name),
      type: "mbtiles",
      url: baseline,
      attribution: "NOAA",
      sizeBytes: Math.round(size * 1024 * 1024),
    };

    if (f.geometry?.rings) {
      source.bounds = boundsFromRings(f.geometry.rings);
    }

    if (date_creat) {
      const match = date_creat.match(
        /(\d{2}) (\d{2}) (\d{4}), (\d{2}):(\d{2})/,
      );
      if (match) {
        const [, month, day, year, hour, minute] = match;
        source.updated = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
      }
    }

    return source;
  });

  return {
    id: "noaa-raster",
    title: "NOAA Raster Charts",
    summary:
      "Official US raster nautical charts from NOAA, with streaming WMS and downloadable regional MBTiles.",
    description:
      "Official US raster nautical charts from NOAA Office of Coast Survey. Covers US coastal waters, the Great Lakes, Puerto Rico, USVI, Hawaii, American Samoa, Guam, the Northern Marianas, and inland waterways.\n\nIncludes a streaming WMS source (paper chart symbology) for immediate online use, plus regional MBTiles packs available for offline download. MBTiles are updated weekly by NOAA.",
    homepage: "https://distribution.charts.noaa.gov/ncds/",
    license: "public-domain",
    keywords: ["nautical", "raster", "usa", "official"],
    sources: [OSM_BASE, WMS_SOURCE, ...mbtilesSources],
  };
}
