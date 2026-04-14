# Open Waters Chart Catalog Format

The Open Waters Chart Catalog is a JSON format for describing collections of nautical chart sources. It enables browsing, installing, and updating chart data from a curated catalog.

## Overview

A catalog is an array of **entries**. Each entry describes a chart — its metadata (title, license, description) and one or more **sources** (tile endpoints, MBTiles files, MapLibre styles, etc.).

```json
[
  {
    "id": "noaa-raster",
    "title": "NOAA Raster Charts",
    "summary": "Official US raster nautical charts.",
    "description": "Official US raster nautical charts from NOAA, available as streaming WMS and downloadable regional MBTiles packs.",
    "homepage": "https://distribution.charts.noaa.gov/ncds/",
    "license": "public-domain",
    "sources": [
      {
        "id": "noaa-wms",
        "title": "NOAA ENC Online (WMS)",
        "type": "raster",
        "tiles": ["https://example.com/wms?BBOX={bbox-epsg-3857}&..."],
        "bounds": [-180, 13, -64, 72],
        "attribution": "NOAA"
      },
      {
        "id": "ncds_01a",
        "title": "Eastern US / Nova Scotia",
        "type": "mbtiles",
        "url": "https://distribution.charts.noaa.gov/ncds/mbtiles/ncds_01a.mbtiles",
        "bounds": [-76.5, 36.5, -66.0, 45.0],
        "minzoom": 4,
        "maxzoom": 16,
        "attribution": "NOAA"
      }
    ]
  }
]
```

## Entry fields

| Field         | Type     | Required | Description |
|---------------|----------|----------|-------------|
| `id`          | string   | yes      | Stable identifier, unique within the catalog. |
| `title`       | string   | yes      | Display name. |
| `summary`     | string   | yes      | One-sentence description for listing UI. |
| `description` | string   | yes      | Full description. Markdown allowed. |
| `homepage`    | string   | no       | Provider homepage URL. |
| `license`     | string   | yes      | SPDX identifier (e.g. `MIT`, `ODbL-1.0`) or one of: `public-domain`, `cc-by`, `cc-by-sa`, `custom`. |
| `keywords`    | string[] | no       | Free-form tags for search and filtering. |
| `thumbnail`   | string   | no       | URL to a listing thumbnail image. |
| `featured`    | boolean  | no       | Hint for default ordering in the catalog UI. |
| `sources`     | array    | yes      | Array of source objects (see below). |

## Sources

Each source describes a single data endpoint or file. A chart entry contains one or more sources — for example, a streaming WMS endpoint and multiple regional MBTiles files.

### Source types

| Type      | Description | Key fields |
|-----------|-------------|------------|
| `style`   | A MapLibre style JSON. The `url` is passed directly to MapLibre as the map style. | `url` (required) |
| `raster`  | Raster tiles. Either `url` points to a [TileJSON](https://github.com/mapbox/tilejson-spec) endpoint, or `tiles` provides URL templates inline. Covers XYZ (`{z}/{x}/{y}`) and WMS (`{bbox-epsg-3857}`) patterns. | `url` or `tiles` (one required) |
| `mbtiles` | An [MBTiles](https://github.com/mapbox/mbtiles-spec) file. `url` points to the file for download. | `url` (required) |
| `pmtiles` | A [PMTiles](https://github.com/protomaps/PMTiles) file. `url` points to the file (local or remote). | `url` (required) |

### Source fields

| Field     | Type     | Required    | Description |
|-----------|----------|-------------|-------------|
| `id`      | string   | yes         | Unique within the entry. |
| `title`   | string   | yes         | Display name. |
| `type`    | string   | yes         | One of: `style`, `raster`, `mbtiles`, `pmtiles`. |
| `url`     | string   | conditional | URL to the resource. Required for all types except `raster` when `tiles` is provided. |
| `tiles`   | string[] | conditional | Tile URL templates per the [TileJSON spec](https://github.com/mapbox/tilejson-spec). For `raster` type; either `url` or `tiles` must be present. |
| `bounds`  | number[] | no          | `[west, south, east, north]` in WGS84. |
| `minzoom` | number   | no          | Minimum zoom level (0–24). |
| `maxzoom` | number   | no          | Maximum zoom level (0–24). |
| `attribution` | string | no       | Attribution string. HTML allowed per TileJSON convention. |
| `tileSize` | number  | no          | Tile size in pixels. Default `256`. |
| `scheme`  | string   | no          | Tile scheme: `xyz` (default) or `tms`. |
| `sizeBytes` | number | no          | File size for downloadable sources (MBTiles, PMTiles). |
| `updated` | string   | no          | ISO 8601 timestamp of last source data update. |
| `theme`   | string   | no          | One of `day`, `dusk`, `night`. Source is only used when the active theme matches. Omit to include regardless of theme. See [themes spec](../specs/themes.md). |
| `units`   | string   | no          | One of `ft`, `m`, `fathom`. Source is only used when the preferred depth unit matches. Omit to include regardless of units. See [themes spec](../specs/themes.md). |

Field names follow [TileJSON 3.0](https://github.com/mapbox/tilejson-spec/tree/master/3.0.0) conventions where applicable.

### Multiple sources for the same content

An entry can include multiple sources covering the same geography via different mechanisms. For example, a raster WMS source for live streaming and MBTiles files for offline use. The catalog describes what exists; the consuming application decides which source to use at runtime based on its capabilities and the user's state.

## Conventions

- Field names follow TileJSON where possible for interoperability.
- URLs may be relative (resolved against the parent document's URL) or absolute.
- All coordinates use WGS84 (EPSG:4326).
- Bounds follow the `[west, south, east, north]` convention from TileJSON/MBTiles.
