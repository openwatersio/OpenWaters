# Offline Chart Storage

This document describes the plan for downloading and storing chart regions for offline use — roadmap item [#7](https://github.com/openwatersio/SeaScape/issues/7).

## Contents

- [Goals](#goals)
- [Prerequisite: MBTiles Chart Source Type](#prerequisite-mbtiles-chart-source-type)
- [MapLibre Offline API](#maplibre-offline-api)
- [Offline Strategy by Source Type](#offline-strategy-by-source-type)
- [Recommended Approach](#recommended-approach)
- [Architecture](#architecture)
- [UI Design](#ui-design)
- [Implementation Plan](#implementation-plan)
- [Open Questions](#open-questions)

---

## Goals

- Allow users to download regions of **any configured chart source** for offline use at sea. Chart sources are now dynamic (stored in the `chart_sources` table) and users can add their own, so offline support must work generically across source types rather than being hardcoded per source.
- Support downloading MBTiles files (e.g. the pre-built NOAA raster charts) as a distinct chart source type.
- Show download progress, allow cancel/delete, and surface storage usage.
- Keep the scope tight for v0.1: region download via bounding box and basic management. No complex scheduling or automatic updates.

---

## Prerequisite: MBTiles Chart Source Type

Before offline downloads work end-to-end, the chart source system needs a new `mbtiles` type. This was deferred in [chart-sources.md](chart-sources.md) but is the natural home for pre-built offline chart files.

### How MBTiles works with maplibre-react-native

Per [maplibre-react-native discussion #591](https://github.com/maplibre/maplibre-react-native/discussions/591), MapLibre Native iOS has built-in support for the `mbtiles://` URL scheme. No HTTP server or custom protocol handler is needed. The pattern:

1. Download the `.mbtiles` file to `expo-file-system`'s document directory
2. Read the MBTiles `metadata` table to get name, format, bounds, min/max zoom, attribution
3. Build a MapLibre `StyleSpecification` at runtime with a raster source whose `tiles` array contains `mbtiles:///absolute/path/to/file.mbtiles/{z}/{x}/{y}.png`
4. Pass the style to `<Map mapStyle={...} />`

The MBTiles file is stored locally and MapLibre reads tiles directly from its SQLite database.

### New chart source type: `mbtiles`

Add `"mbtiles"` to `ChartSourceType`:

```typescript
type MBTilesOptions = {
  path: string;              // absolute path in document directory
  format: "png" | "jpg" | "webp" | "pbf"; // read from MBTiles metadata
  tileSize?: number;         // default 256
  minZoom?: number;          // read from MBTiles metadata
  maxZoom?: number;          // read from MBTiles metadata
  bounds?: [number, number, number, number]; // from metadata
  attribution?: string;      // from metadata
};
```

`buildMapStyle` for `mbtiles` type generates a raster or vector style using the `mbtiles://` URL scheme. For vector MBTiles (`.pbf`), a vector source is used instead of raster, but this is out of scope for v0.1 — focus on raster MBTiles first.

### Reading MBTiles metadata

Use `expo-sqlite` to open the `.mbtiles` file and query its `metadata` key-value table:

```sql
SELECT name, value FROM metadata
WHERE name IN ('name', 'format', 'bounds', 'minzoom', 'maxzoom', 'attribution', 'type')
```

The `bounds` value is a comma-separated `"west,south,east,north"` string. Format is typically `"png"`, `"jpg"`, or `"pbf"`. The `type` distinguishes `"overlay"` from `"baselayer"`.

### UI for adding an MBTiles source

Add a file picker to the chart source add form (`components/charts/StyleForms.tsx`):

1. User selects "MBTiles" type
2. Form shows an import button using `expo-document-picker` restricted to `.mbtiles` files
3. On selection, copy the file to the document directory, read metadata, auto-fill name/bounds/zoom range
4. Save options to the DB

Sourcing MBTiles files from the internet (downloading a URL) is handled as part of the offline download flow (see below), not the chart source add flow.

---

## MapLibre Offline API

`@maplibre/maplibre-react-native` (v11) exposes `OfflineManager`, a singleton that wraps the native MapLibre offline storage engine.

### OfflineManager key methods

| Method | Description |
|--------|-------------|
| `createPack(options, onProgress, onError)` | Download tiles for a style+bounds+zoom range. Returns `OfflinePack`. |
| `getPacks()` / `getPack(id)` | Retrieve stored packs from in-memory cache. |
| `deletePack(id)` | Delete pack and free storage. |
| `invalidatePack(id)` | Re-download changed tiles without full delete+recreate. |
| `mergeOfflineRegions(path)` | Sideload a pre-built offline database (bundle or filesystem path). |
| `setMaximumAmbientCacheSize(bytes)` | Limit or disable automatic browsing cache. |
| `setTileCountLimit(n)` | Limit tiles per download (ToS compliance). |
| `addListener(id, onProgress, onError)` | Attach listeners to an existing pack. |
| `removeListener(id)` | Clean up listeners. |

### createPack options

```typescript
{
  mapStyle: string;          // URL to a TileJSON or MapLibre style JSON
  bounds: LngLatBounds;      // [west, south, east, north]
  minZoom?: number;          // default 10
  maxZoom?: number;          // default 20
  metadata?: Record<string, unknown>;
}
```

**Important:** `mapStyle` must be a **URL string**, not an inline style object. This has implications for how we download tiles from `raster` and `custom` type chart sources (see below).

### OfflinePackStatus

```typescript
{
  id: string;
  state: "inactive" | "active" | "complete";
  percentage: number;
  completedTileCount: number;
  completedTileSize: number;   // bytes
  requiredResourceCount: number;
}
```

Progress events fire every 500 ms (configurable via `setProgressEventThrottle`). Listeners are automatically removed on completion.

---

## Offline Strategy by Source Type

With chart sources now dynamic, the offline strategy is determined by the source's `type` rather than hardcoded per source.

### `style` type — full MapLibre style URL

**Example:** VectorCharts (`https://api.vectorcharts.com/.../base.json?token=...`)

The style is already a URL, so it can be passed directly to `OfflineManager.createPack({ mapStyle: options.url, ... })`. Progress tracking, pause/resume, and invalidation all work out of the box.

**Caveats:**
- API tokens must remain valid offline. If the server validates tokens on every tile request (not just style fetch), offline won't work. Confirm with each provider.
- Vector tiles generate dense downloads — tile counts can be high.

### `raster` type — single tile URL template

**Examples:** NOAA ECDIS/Paper (WMS with `{bbox-epsg-3857}`), Google Earth, OpenSeaMap, user-added raster sources.

Two sub-cases:

**XYZ raster sources** — `{z}/{x}/{y}` URLs are standard XYZ tiles. `OfflineManager` can cache these, but it needs a style URL, not an inline style. Options:
1. **Generate an in-memory style and serve via `data:` URI** — test whether MapLibre accepts this as the `mapStyle` parameter. If yes, this is the simplest path.
2. **Fall back to an in-app HTTP server** — complex, adds a native dependency, not recommended.
3. **Skip OfflineManager and populate the ambient cache by panning/zooming** — no explicit download UI, just happens naturally as the user browses online. Supplement with `setMaximumAmbientCacheSize()` bumped up.

**WMS raster sources** (`{bbox-epsg-3857}`) — these are per-request bounding-box fetches, not tile-pyramid structured. OfflineManager cannot index them as tiles. Offline path: **convert to MBTiles** by downloading a pre-built MBTiles file if available (NOAA publishes weekly updates at https://distribution.charts.noaa.gov/ncds/), then add as an `mbtiles` chart source.

The app can help by recognizing NOAA's WMS pattern and offering a "Download for offline (MBTiles)" action that fetches the corresponding NOAA region pack and adds it as a new `mbtiles` source.

### `mbtiles` type — local file

Already offline. No download needed. The chart source's data is a self-contained file on the device. "Offline download" for this type means **importing** the MBTiles file (see prerequisite section above).

Users who want a new region just add a new `mbtiles` chart source. The region-download UI can be shared: instead of calling `OfflineManager.createPack`, it downloads an MBTiles file from a known URL (or the user provides one) and registers it as a new chart source.

### `custom` type — inline `StyleSpecification`

**Examples:** OpenSeaMap (base + seamark overlay), user-pasted styles.

Since the style is inline JSON (not a URL), it cannot be passed directly to `OfflineManager.createPack()`. Same options as XYZ raster:
1. Serve the inline style via a `data:` URI (preferred if supported)
2. Host it locally via an in-app HTTP server (complex)
3. Rely on ambient cache only (no explicit download)

Multi-source custom styles (like OpenSeaMap's OSM + seamark overlay) also mean the offline download must cover all referenced sources. `OfflineManager.createPack` handles this automatically because it walks the style.

---

## Recommended Approach

For v0.1, use a **hybrid strategy**:

| Source Type | Offline Strategy |
|---|---|
| `style` (URL) | `OfflineManager.createPack()` directly |
| `raster` (XYZ) | `OfflineManager.createPack()` via generated `data:` style URL |
| `raster` (WMS) | Recognize known WMS providers (NOAA) and offer MBTiles download; otherwise out of scope |
| `mbtiles` | Import existing file (already offline) or download from URL |
| `custom` | `OfflineManager.createPack()` via generated `data:` style URL |

**Start with:**
1. **MBTiles import** — the simplest path, enables offline NOAA charts, unblocks the data-URI investigation.
2. **OfflineManager `createPack()` for `style` sources** — works out of the box, no unknowns.
3. **Data-URI investigation** for `raster` + `custom` sources — if it works, those types get offline too. If not, rely on ambient cache or MBTiles conversion.

---

## Architecture

### Storage

- **MBTiles files** — stored in `expo-file-system`'s `documentDirectory/mbtiles/`. Tracked as regular rows in the existing `chart_sources` table (type `mbtiles`) — an MBTiles file *is* a chart source, not a separate concept.
- **Offline packs** (`OfflineManager`) — stored entirely in MapLibre's native SQLite database. The library tracks id, bounds, tile count, bytes, progress, and user metadata for each pack. No parallel table in the app's SQLite.
- **Pack metadata** — attached to each pack via `OfflineManager.createPack({ metadata })`. MapLibre persists this arbitrary JSON bag alongside the pack natively, so we can round-trip name, chart source id, downloaded-at timestamp, and any other fields without a separate table.

### Pack metadata shape

```typescript
type PackMetadata = {
  name: string;              // user-visible name, e.g. "Chesapeake Bay"
  chartSourceId: number;     // references chart_sources(id)
  downloadedAt: number;      // unix timestamp
  strategy: "offline-manager" | "scrape"; // how tiles were obtained
};
```

Attached when creating a pack:

```typescript
OfflineManager.createPack({
  mapStyle: styleUrl,
  bounds,
  minZoom,
  maxZoom,
  metadata: { name, chartSourceId, downloadedAt: Date.now(), strategy: "offline-manager" },
}, onProgress, onError);
```

Read back via `OfflineManager.getPacks()` → each `OfflinePack` exposes `metadata` directly.

Dangling references (a pack whose `chartSourceId` no longer exists in `chart_sources`) are handled in JS at render time: show the pack as "orphaned" and offer delete. No foreign-key enforcement is possible since the native store isn't accessible as SQL.

### Storage & backup considerations

iOS imposes no per-app storage quota, but there are several real constraints we need to respect:

- **Durability** — Files in `cacheDirectory` and `tmp/` can be purged by iOS under memory pressure without notice. Offline chart data must live in `documentDirectory/` where it's never purged. A cached tile getting deleted at sea is a hard failure.
- **iCloud backup** — Files in `Documents/` are backed up to iCloud by default. A user with 1–5 GB of NOAA MBTiles can eat their entire 5 GB free iCloud tier. Every MBTiles file (and ideally the MapLibre offline database, if we can reach it) must be flagged `NSURLIsExcludedFromBackupKey = true` immediately after creation. This requires a small native call; `expo-file-system` doesn't expose the API directly, so we'll wrap it in a helper.
- **Free-space check before download** — Before starting a download, call `FileSystem.getFreeDiskStorageAsync()` and refuse (or warn strongly) if the projected download size exceeds ~80% of free space. Prevents bricking the device and stops "the app used all my storage" reviews.
- **User-visible totals** — iOS's Settings → iPhone Storage doesn't break down per-file-type, and users will blame the app for any space it occupies. The offline management screen shows total bytes used, broken down per pack / MBTiles file, with a per-item delete action.
- **App offloading** — If the user "offloads" the app in iOS Settings, the binary is removed but `Documents/` is preserved. Our MBTiles and native MapLibre DB both survive offloading, which is the right behavior for expensive-to-rebuild offline data.
- **Practical UX thresholds** — Users don't notice < 100 MB. Between 100 MB and 1 GB is comfortable. 1–5 GB is visible but acceptable for offline nautical charts. Above 5 GB, users start hunting for what's consuming space. NOAA's regional MBTiles fall at the high end (a full US coast pack can approach 1 GB), so per-region granularity in the UI matters.

### Key files (proposed)

```
lib/offline.ts                      # OfflineManager wrapper + tile scrape + MBTiles import/download
lib/mbtiles.ts                      # Read metadata, generate mbtiles:// URLs, write MBTiles files
hooks/useOfflinePacks.ts            # Hook wrapping OfflineManager.getPacks() + listener plumbing
app/offline/index.tsx               # Offline packs management screen
app/offline/download.tsx            # Region picker + download UI
components/map/DownloadRegionButton.tsx
components/charts/MBTilesImport.tsx # File picker UI for adding mbtiles chart source
```

### Metro config

Add `.mbtiles` to Metro's asset extensions if we ever want to bundle mbtiles files directly:

```javascript
// metro.config.js
config.resolver.assetExts.push("mbtiles");
```

For v0.1 we download mbtiles at runtime rather than bundling, so this isn't strictly required.

---

## UI Design

### Chart source add flow (for `mbtiles` type)

When the user picks "MBTiles" in the chart source add form:

1. "Choose file…" button opens `expo-document-picker`
2. On selection, copy to `documentDirectory/mbtiles/<uuid>.mbtiles`
3. Read metadata, auto-fill name (from `metadata.name`)
4. Show read-only preview of bounds, zoom range, format, size
5. Save → insert `chart_sources` row with `type = "mbtiles"` and the composed options

### Download region button (map overlay)

A download button in the map controls panel opens the region download flow. The button is shown for any chart source type that supports downloading (i.e. not `mbtiles`, which is already offline).

### Region picker

A full-screen modal showing the current map view with a draggable bounding box overlay. The user adjusts the box to define the download region. Display estimated tile count and storage size before confirming.

- Zoom range defaults: min 8 (regional overview), max 16 (harbor detail)
- Warn if tile count exceeds a reasonable limit (e.g. 5,000 tiles)
- The selected chart source is passed in from the current map view; the user doesn't choose it here

### Offline management screen (`/offline`)

List all downloaded packs with:

- Name, chart source name, region thumbnail
- Download date, file size
- State badge: Downloading (with % progress), Complete, Error
- Actions: cancel (active), delete, re-download (to update)

Accessible from the Settings screen or a dedicated entry in the menu.

---

## Implementation Plan

### Phase 1: MBTiles chart source type

1. Add `"mbtiles"` to `ChartSourceType` in [lib/chartSources.ts](../../lib/chartSources.ts), with `MBTilesOptions` shape.
2. Update `buildMapStyle` to handle `mbtiles` type: read `options.path`, generate a raster style using the `mbtiles://` URL scheme.
3. Create `lib/mbtiles.ts` — helpers to open a file with `expo-sqlite`, read metadata, and compose options.
4. Create a `setExcludedFromBackup(path)` helper (small native module or a direct call via `NSURL.setResourceValue:forKey:`) and call it on every newly written file under `documentDirectory/mbtiles/`. Without this, large MBTiles files get silently uploaded to iCloud and can fill a user's backup quota.
5. Add `MBTilesForm` component in [components/charts/StyleForms.tsx](../../components/charts/StyleForms.tsx) — file picker via `expo-document-picker`, copies to `documentDirectory/mbtiles/`, reads metadata, composes options, and applies backup exclusion.
6. Add "MBTiles" to the type picker in [components/charts/ChartSourceForm.tsx](../../components/charts/ChartSourceForm.tsx).
7. Deleting an `mbtiles` chart source must also delete the backing file (not just the DB row).

**Deliverable:** users can import an MBTiles file and use it as an offline chart source, and the file is excluded from iCloud backup.

### Phase 2: OfflineManager tile downloads for style sources

1. Build `lib/offline.ts` wrapping `OfflineManager` — create/delete/invalidate packs, attach progress listeners, serialize the structured metadata bag.
2. Build `hooks/useOfflinePacks.ts` — calls `OfflineManager.getPacks()` on mount, subscribes to progress/error events via `OfflineManager.addListener` for each pack, and re-fetches after create/delete. No app-SQLite table; MapLibre's native store is the source of truth.
3. Build the offline management screen (`app/offline/index.tsx`).
4. Build the region picker UI (`app/offline/download.tsx`). Before confirming, estimate size (tile count × average tile bytes) and check `FileSystem.getFreeDiskStorageAsync()` — refuse or warn if the download would exceed 80% of free space.
5. Add `DownloadRegionButton` map control, shown when the active chart source is type `style`.
6. Wire `createPack()` with progress listener feeding into `useOfflinePacks`.

**Deliverable:** users can download a bounding box of tiles from a `style`-type chart source.

### Phase 3: Generalize to raster and custom sources

1. Investigate `data:` URI support in `OfflineManager.createPack`'s `mapStyle` parameter.
   - If supported: generate an in-memory style from the chart source's `options` and pass as a data URI. This unlocks `raster` (XYZ) and `custom` types.
   - If not: document the limitation and either (a) skip offline support for these types, (b) rely on ambient cache, or (c) add an in-app HTTP server as a last resort.
2. Extend `DownloadRegionButton` to appear for all supported source types.

**Deliverable:** users can download regions from any compatible chart source.

### Phase 4: MBTiles download flow

1. Add a "Download MBTiles…" action to the offline screen that prompts for a URL.
2. Stream the download via `expo-file-system`'s download resumable, with progress.
3. On completion, read metadata and insert a `chart_sources` row of type `mbtiles` — no separate offline-pack tracking needed, since an MBTiles file *is* the chart source.
4. (Optional) Curate a list of known NOAA regional MBTiles as presets so users don't have to hunt for URLs.

**Deliverable:** users can download NOAA (and other) MBTiles directly in-app, which then appears as a chart source.

### Phase 5: Pack management polish

1. Show total storage used / device free space on management screen.
2. Add `invalidatePack()` flow for refreshing stale packs.
3. Investigate `setMaximumAmbientCacheSize()` defaults for pre-caching browsing.
4. Consider background downloads via `expo-background-fetch` for large MBTiles.

---

## Future Improvements

### WMS / WMTS offline support

MapLibre has no first-class WMS/WMTS support — both are treated as raster tile sources with `{bbox-epsg-3857}` in the URL template. This works online, but `OfflineManager.createPack()` is architecturally incompatible with WMS: its tile-pyramid algorithm walks `{z}/{x}/{y}` coordinates, and WMS servers don't expose a tile pyramid — each request is an arbitrary bounding-box GetMap call. Substituting URLs can't fix this; the whole caching model assumes tile-pyramid structure.

Options for offline WMS/WMTS, in rough order of effort and coverage:

| Approach | Effort | Coverage | Notes |
|---|---|---|---|
| **Pre-built MBTiles download** | Low | NOAA + any publisher | Already planned in Phase 4. Covers NOAA's weekly releases. Depends on a third party publishing conversions. |
| **Ambient cache only** | Zero | Best-effort | User browses online, tiles land in MapLibre's cache, may be available offline. Unpredictable — depends on tile-server cache headers. No code required but no guarantees. |
| **Client-side tile scraping → MBTiles** | Medium | Any WMS/WMTS/XYZ | App walks a tile grid for the selected region + zoom range, issues a WMS GetMap per tile, writes the PNG into a local SQLite MBTiles file, then registers the result as a new `mbtiles` chart source. Works universally and uses the same read-path as pre-built MBTiles. Slow and bandwidth-heavy; must respect per-source rate limits and ToS. |
| **Server-side WMS→MBTiles conversion** | High (infra) | Any WMS/WMTS | Run `gdal2mbtiles` or MapProxy on a server, convert WMS to MBTiles once, distribute the file. Out of scope for a pure-client app unless we operate such a server. |

**Recommended path if we pursue this:** add a universal "download region" primitive in `lib/scrapeTiles.ts` that iterates a tile grid and writes an MBTiles file via `expo-sqlite`. Auto-pick the strategy per source: if the URL contains `{bbox-epsg-3857}`, scrape; otherwise try `OfflineManager` first. This generalizes the download flow across XYZ raster, WMS, and WMTS without branching UI.

### PMTiles chart source type

PMTiles is a single-file archive format for tile pyramids, designed for cloud-optimized serverless distribution. It deduplicates tiles internally (often 70%+ smaller than MBTiles) and supports efficient HTTP range requests for remote access. Both raster and vector PMTiles exist.

**Current status in our stack:** `maplibre-react-native` v11.0.0-beta.24 pins `maplibre-native` iOS 6.22.1, which **already includes PMTiles support** (added in 6.20.0 via [PR #2882](https://github.com/maplibre/maplibre-native/pull/2882), January 2025; local file range requests enhanced in [PR #3404](https://github.com/maplibre/maplibre-native/pull/3404), May 2025). The native SDK handles the protocol internally — no `addProtocol` call from JS is needed. The React Native bridge just passes the URL string through.

**What's blocking us from shipping this today:** the exact URL scheme for local PMTiles files on iOS is not documented in the public changelog. It's likely `pmtiles://` (following the `mbtiles://` precedent) but could also require a `file://` prefix or an absolute path. Needs a device spike to confirm before we commit to an API shape.

**Plan when we pick this up:**

1. **URL scheme spike** — write a trivial test: create a style with `pmtiles://...`, `file://...`, and an absolute path pointing at a small sample PMTiles file. Load in the app. Report which (if any) works.
2. **If the spike succeeds**, add PMTiles as a chart source type parallel to MBTiles:
   - `PMTilesOptions` type in [lib/chartSources.ts](../../lib/chartSources.ts) with `path`, `format`, `tileSize`, `minZoom`, `maxZoom`, `bounds`, `attribution`
   - `ChartSourceType` gains `"pmtiles"`
   - `buildMapStyle` handles the new case, mirroring the mbtiles implementation
3. **Create `lib/pmtiles.ts`** — parses the PMTiles v3 fixed-layout binary header (first 127 bytes) with a `DataView` on the result of `file.bytes()`. Simpler than MBTiles metadata reading because no SQLite is involved. Extracts tile type, compression, min/max zoom, bounds, center, tile counts. Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
4. **Add `PMTilesForm`** in [components/charts/StyleForms.tsx](../../components/charts/StyleForms.tsx) — near-duplicate of `MBTilesForm` with a different extension filter and parser. Reject vector PMTiles in v1 (raster only) with a helpful error pointing users to the `custom` type.
5. **Unify file cleanup** — rename `deleteMBTilesFile` to something like `deleteLocalChartFile` since the logic is identical for both formats.

**Not in scope for the PMTiles follow-up:**

- **Vector PMTiles** — needs a user-provided style with glyphs/sprites/layers. Can be expressed today as a `custom` source where the user pastes a style referencing a `pmtiles://` vector source (assuming the URL scheme works), but we won't auto-generate styling.
- **Remote PMTiles URLs** — PMTiles' headline feature is HTTP range requests against cloud storage. That's a separate line item, not part of the local-file work.

**Why not in Phase 1:** PMTiles is ~95% duplication of the MBTiles code once the URL scheme is known, but we haven't verified the URL scheme works on iOS 6.22.1 for local files. Doing MBTiles first proves out the import/delete/buildMapStyle pattern; adding PMTiles later is incremental.

### Open-in-app from Files, Mail, AirDrop, Safari

Phase 1 registers `.mbtiles` as a known file type via `UTImportedTypeDeclarations` + `CFBundleDocumentTypes` in [app.json](../../app.json) (needed to make the in-app document picker work). That same declaration — with a small additional wiring — will let iOS show Open Waters as a target anywhere the user encounters a `.mbtiles` file: the Files app's "Open with…" menu, AirDrop receive sheet, Mail attachments, Safari downloads, the document picker in other apps.

**What's needed to activate this:**

1. Bump `LSHandlerRank` from `"Alternate"` to `"Owner"` in [app.json](../../app.json) — claims Open Waters as the preferred handler for `.mbtiles` (we're the only app likely to want them on a user's device).
2. Add a URL handler in [app/_layout.tsx](../../app/_layout.tsx) (or a dedicated hook) that:
   - Listens for incoming file URLs via `Linking.addEventListener('url', ...)` and `Linking.getInitialURL()` (for cold-start launches)
   - Filters for URLs ending in `.mbtiles`
   - Calls the existing `importMBTilesFile()` helper from [lib/mbtiles.ts](../../lib/mbtiles.ts)
   - Navigates to a review screen where the user can edit the name and save the new chart source
3. Clean up the iOS inbox directory — when another app opens a file into ours, iOS drops it in `Documents/Inbox/`. `importMBTilesFile()` already copies to `Documents/mbtiles/`, so after a successful import we should `File.delete()` the inbox copy to avoid leaving duplicates.

**No native code required** — all of this is via Expo's `Linking` API and the existing file-system helpers. Estimated effort: 1–2 hours once Phase 1 is stable.

**Related follow-up:** the same pattern will work for `.pmtiles` once that chart source type exists — declare a second UTI, add a second `LSItemContentTypes` entry, and the URL handler can branch on extension.

### Other future improvements

- **Vector MBTiles** — raster MBTiles are the v0.1 focus; vector MBTiles work via `mbtiles://` but need a full vector style with glyphs, sprites, and styled layers. Follow-up via the `custom` chart source type.
- **Background downloads** — `expo-background-fetch` or `expo-task-manager` for long-running pack downloads. Particularly relevant for 1 GB+ NOAA MBTiles.
- **Pack invalidation UX** — NOAA updates weekly; surface staleness indicators in the offline management screen.
- **`setExcludedFromBackup` native helper** — `expo-file-system` doesn't expose `NSURLIsExcludedFromBackupKey`. Large MBTiles/PMTiles files written to `documentDirectory/` are backed up to iCloud by default, which can eat a user's 5 GB free tier. Needs a small native helper or an upstream contribution to `expo-file-system`.

---

## Open Questions

1. **`data:` or `file://` URI as `mapStyle`** — Does `OfflineManager.createPack` accept a `data:application/json;base64,...` URL as the `mapStyle` parameter? What about a `file://` path to a style JSON written to `documentDirectory`? If either works, `raster` and `custom` sources get offline support trivially by serializing the generated `StyleSpecification` to a local file (or inline data URI) and passing the resulting URL. **Test required — try both.**

2. **VectorCharts token + offline** — Does the VectorCharts API validate tokens on every tile request, or only at style fetch time? If per-request, offline use won't work without a different licensing arrangement.

3. **MBTiles vector tile support** — Vector MBTiles (`.pbf` format) work with `mbtiles://` but need a full vector style with `glyphs`, `sprite`, and styled layers. For v0.1 we focus on raster MBTiles only. Vector MBTiles could be a follow-up via the `custom` type (user pastes a style that references an `mbtiles://` vector source).

4. **MBTiles file size** — A single NOAA regional MBTiles can be 100 MB–1+ GB. Need:
   - Progress UI during import/download
   - Storage space check before starting
   - Cancel-and-resume support for large downloads
   - Background download support

5. **Tile count limits for user-added sources** — MapLibre's default `setTileCountLimit` enforces Mapbox ToS (which doesn't apply to NOAA, OpenSeaMap, etc.). For user-added sources, the limit may need to be raised or removed.

6. **Pack staleness** — NOAA MBTiles update weekly. Should the app notify users when their offline packs are stale? What's a reasonable staleness threshold for a nautical chart?

7. **Chart source deletion with existing packs** — If a user deletes a chart source that has live `OfflineManager` packs referencing it via `metadata.chartSourceId`, the native packs remain but become orphaned. Options: (a) on chart-source delete, call `OfflineManager.getPacks()`, filter by `metadata.chartSourceId`, and delete matching packs; (b) leave them and render as "orphaned" in the management UI with a delete action. Prefer (a) for simplicity, with a confirmation dialog warning the user their offline data will be deleted too.

8. **Multi-source custom styles** — A `custom` style may reference multiple tile sources. `OfflineManager` handles this natively, but the stored pack's "size" and "tile count" are cumulative. Make sure the UI reflects this clearly.
