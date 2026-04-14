# Charts

Open Waters supports browsing, installing, and managing nautical chart sources from a built-in catalog or by adding custom sources manually.

## Features

- **Multiple Charts** — Switch between installed charts or combine sources from different providers.
- **Chart Catalog** — Browse a curated catalog of chart sources, preview coverage areas, and install with a tap. See the [Chart Catalog spec](catalog-spec.md) for the catalog format.
- **Offline Use** — Download regions or cache tiles for full offline use at sea. See [Offline Charts](offline.md).
- **Custom Sources** — Add your own chart sources by pasting a tile URL, MapLibre style URL, or importing a local file. The app auto-detects the source type.
- **Themes** — Day, dusk, and night variants, with an automatic mode that follows sunrise and sunset at your location.
- **Depth Units** — View depths in feet, meters, or fathoms. Charts that publish unit-specific variants swap automatically based on your preference.

## Supported Source Types

| Type        | Description                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Style**   | A complete map style supporting vector tiles, custom symbology, and interactive features. Uses the [MapLibre style spec](https://maplibre.org/maplibre-style-spec/) format. |
| **Raster**  | XYZ (`{z}/{x}/{y}`) or WMS (`{bbox-epsg-3857}`) tile URL templates. Covers most web-based chart tile services.                                                              |
| **MBTiles** | A self-contained [MBTiles](https://github.com/mapbox/mbtiles-spec) SQLite file. Fully offline — no network required after import or download.                               |
| **PMTiles** | A single-file [PMTiles](https://github.com/protomaps/PMTiles) archive. Supports both local and remote access with HTTP range requests.                                      |

## Planned Formats

The following chart formats are not yet supported but are on the roadmap:

- **S-57 ENC** — The current international standard for Electronic Navigational Charts published by hydrographic offices worldwide (IHO S-57).
- **S-100 / S-101** — The next-generation IHO standard for ENCs, replacing S-57 with richer data models and portrayal rules.
- **BSB/KAP** — Georeferenced raster chart images used by NOAA and other agencies. Common in legacy chart plotters.

## Catalog

The chart catalog is a JSON format for describing collections of chart sources. It enables browsing, installing, and updating chart data from a curated list of providers.

See the [Chart Catalog spec](catalog-spec.md) for the full format specification.

## Themes and Units

Catalog entries can publish theme and unit variants of the same chart. Open Waters picks the right variant based on your global preferences:

- **Theme** — `day`, `dusk`, `night`, or `auto`. In auto mode the app uses your last known position and the current time to pick day, dusk, or night.
- **Depth units** — `ft`, `m`, or `fathom`.

If a chart doesn't publish a matching variant, Open Waters falls back to the nearest available option (e.g. `dusk` → `day` → unthemed).

For the data model and fallback rules, see the [themes spec](../specs/themes.md).

## Technical Details

Charts are stored on disk under the app's documents directory as a `style.json` (a MapLibre `StyleSpecification`) plus an optional cached `catalog.json` from the originating catalog entry. Downloaded MBTiles files live alongside the style in the chart's directory. Tile packs for raster and style sources are stored in MapLibre's native offline database via `OfflineManager`.
