# Offline Charts

Open Waters is designed to work at sea, where a reliable network connection is the exception rather than the rule. Charts can be cached or downloaded so they keep rendering without any connectivity.

## Two ways to go offline

Depending on the chart's source, Open Waters uses one of two mechanisms — you don't have to pick, the app chooses whichever works for the source you're using.

### Downloaded regions (MBTiles)

Some catalog entries — notably the NOAA raster charts — publish pre-built regional tile files (MBTiles). These are downloaded and rendered directly from local storage. Regions range from roughly 50 MB to over 1 GB.

- Pick a region from the chart's download screen.
- Downloads continue in the foreground with a progress bar and a cancel button.
- Once finished, the region appears on the map immediately — no toggle, no "offline mode."
- Delete a region at any time from the offline management screen.

### Cached tiles (tile packs)

For charts made up of streaming raster or vector tiles (e.g. OpenSeaMap), Open Waters creates a **tile pack**: a bounding box of tiles at a selected zoom range, cached using MapLibre's offline engine.

- Pan and zoom the map to frame the area you want.
- Open the download screen and confirm the bounds and zoom range.
- The pack downloads in the background and is available offline from that point on.

## Mixing online and offline

There is no offline mode switch. The map renders whatever it can reach:

- **Online:** remote tiles stream normally. Downloaded regions and cached packs fill in instantly where they exist.
- **Offline:** remote tiles silently fail. Downloaded regions and cached packs render; the rest of the map stays blank.

This means you can install a chart, browse it online, download the regions you care about, and keep using the same chart at sea without changing any setting.

## Offline management

The **Offline** screen (linked from Settings) shows everything you have stored:

- Total offline data and free device space.
- Per-chart breakdown: downloaded regions and tile packs with sizes.
- Delete buttons for individual regions and packs.
- Storage settings: ambient cache size and per-pack tile limit.

Ambient cache is the pool MapLibre uses automatically for tiles you've browsed while online. Bumping it up is a quick way to keep recently viewed areas available without formally downloading them.

## Storage tips

- MBTiles regions can be large — check the free-space figure before downloading multiple regions on a small device.
- Tile packs for wide bounding boxes at high zoom can grow quickly; start with a narrower zoom range (e.g. overview 8–12) and extend later if you need harbor detail.
- Deleting a region or pack frees space immediately.
