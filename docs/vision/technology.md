# Technology

## Application Framework: React Native + Expo

- **Cross-platform from day one.** iOS and (eventually) macOS are reachable from a single codebase.
- **Expo 54 + React Native 0.81** — Expo provides managed native modules for GPS (`expo-location`), haptics, file system, and more — reducing native boilerplate significantly.
- **JavaScript/TypeScript ecosystem** — Signal K (the primary instrument integration target) is Node.js-based with JSON data models. Sharing types and parsing logic between Open Waters and Signal K is natural.
- **Large contributor pool.** React/JS is the most widely known frontend stack, lowering the barrier for open source contributors.

## Map Library: MapLibre Native

- **Open source, no vendor lock-in.** MapLibre is the community fork of Mapbox GL after Mapbox went proprietary. It's the only production-grade open source vector tile renderer for native mobile.
- **v11 brings:**
  - Better React Native New Architecture support (bridgeless mode)
  - PMTiles support in MapLibre Native (Android 11.8.0, iOS 6.10.0) — critical for offline charts
  - Configurable SDK versions — adopt upstream MapLibre Native releases immediately
- **Offline support** — Built-in `OfflineManager` for downloading tile regions. Supports MBTiles and PMTiles natively.
- **Custom styling** — MapLibre style spec allows full control over chart rendering: depth contours, buoy symbols, light sectors, etc.
- **Ecosystem** — Used by Protomaps, OpenFreeMap, MapTiler, Stadia Maps. Strong community.

## Chart Data: Nautical Vector Tiles

The current state of modern nautical chart data is one of the biggest challenges for this project. NOAA provides official US charts in S-57 format, but these are not directly usable in a mobile app. OpenSeaMap provides open vector data for seamarks and buoys, but coverage and styling are inconsistent. There is no single, global, open source nautical vector tile provider with a modern style (yet).

### Data Sources (Open)

| Source                                                               | Coverage  | Format                  | Update Freq | License         | Notes                                                                                 |
| -------------------------------------------------------------------- | --------- | ----------------------- | ----------- | --------------- | ------------------------------------------------------------------------------------- |
| **[NOAA ENC](https://nauticalcharts.noaa.gov/charts/noaa-enc.html)** | US waters | S-57 (.000)             | Weekly      | Public domain   | Official US nautical charts; also available as MBTiles via NOAA Chart Display Service |
| **[OpenSeaMap](https://map.openseamap.org/)**                        | Worldwide | OSM data + raster tiles | Continuous  | ODbL            | Seamarks, buoys, lights as OSM tags; vector tile generator exists but immature        |
| **[OpenStreetMap](https://www.openstreetmap.org/)**                  | Worldwide | PBF / vector tiles      | Continuous  | ODbL            | Land features, coastlines, ports, marinas; base map layer                             |
| **[Protomaps](https://protomaps.com/)**                              | Worldwide | PMTiles                 | Monthly     | ODbL (OSM data) | OSM-based vector basemap in a single PMTiles file; great for offline                  |

### Chart Rendering Pipeline

The approach is a **layered tile stack** rendered by MapLibre:

```
Layer 1: Base map (land, roads, coastline)     <- Protomaps / OpenFreeMap PMTiles
Layer 2: Nautical overlay (buoys, lights, etc.) <- OpenSeaMap vector tiles or custom S-57 pipeline
Layer 3: Depth contours & bathymetry            <- NOAA ENC converted to vector tiles
Layer 4: Dynamic data (AIS, weather, user data) <- App-rendered GeoJSON overlays
```

**S-57 to Vector Tiles pipeline:**

1. Download NOAA ENC files (.000 format)
2. Convert to GeoJSON using GDAL (`ogr2ogr`)
3. Process through [tippecanoe](https://github.com/felt/tippecanoe) to generate MVT/MBTiles or PMTiles
4. Style with MapLibre style spec (custom nautical symbology)
5. Serve as PMTiles (single file, no tile server needed) or host on static storage

### Tile Format: PMTiles

| Format        | Offline            | Server Required                   | Deduplication             | MapLibre Native Support |
| ------------- | ------------------ | --------------------------------- | ------------------------- | ----------------------- |
| **PMTiles**   | Single file        | No (static hosting or local file) | Yes (70%+ size reduction) | Yes (v11.8+)            |
| **MBTiles**   | Single file        | No (SQLite)                       | No                        | Yes (mature)            |
| **XYZ tiles** | Directory of files | Yes (or pre-downloaded)           | No                        | Yes                     |

PMTiles is the recommended format because:

- Single file per region — simple to download and manage offline
- No tile server needed — can be read directly from local storage or static CDN
- Built-in deduplication reduces download size significantly (ocean tiles are mostly identical)
- Native support in MapLibre v11

## Data APIs

| Data                 | Source                                                          | API                     | Cost                  | Notes                                                          |
| -------------------- | --------------------------------------------------------------- | ----------------------- | --------------------- | -------------------------------------------------------------- |
| **Tides & currents** | [Neaps](https://openwaters.io/tides/neaps)                      | TypeScript              | Free                  | 6,000+ global stations; metadata, predictions, no observations |
| **Marine weather**   | [Open-Meteo](https://open-meteo.com/en/docs/marine-weather-api) | REST (JSON)             | Free (non-commercial) | Waves, swell, wind; 7-day forecast; no API key required        |
| **General weather**  | [Open-Meteo](https://open-meteo.com/)                           | REST (JSON)             | Free (non-commercial) | Wind, temp, pressure, precipitation; ECMWF/GFS models          |
| **AIS (internet)**   | Various                                                         | WebSocket/REST          | Varies                | AISHub (free community), MarineTraffic (paid), or Signal K     |
| **Instrument data**  | [Signal K](https://signalk.org/)                                | REST + WebSocket (JSON) | Free (onboard)        | Depth, wind, speed, heading, AIS — all via one connection      |

## Battery & Performance

A chart plotter on a boat may run for hours with the screen on, GPS active, and no way to charge. Battery efficiency is a first-class concern.

### Stay Awake Mode

The app has an explicit **Stay Awake** toggle that prevents the screen from sleeping. When enabled:

- Screen stays on indefinitely (using `expo-keep-awake`)
- GPS continues updating
- Map continues rendering at the helm

When disabled (the default), the app follows normal OS screen sleep behavior.

### Battery Optimization Strategies

- **Reduce GPS polling when stationary.** If the vessel hasn't moved beyond a threshold (e.g., at anchor or at the dock), reduce GPS update frequency from 1Hz to every 5-10 seconds. Resume full-rate polling when movement is detected.
- **Reduce map frame rate when idle.** If the user hasn't interacted with the map and the vessel is stationary, drop MapLibre rendering to a lower frame rate or pause re-renders entirely. Resume on touch or movement.
- **Batch network requests.** When connectivity is available, batch tide, weather, and chart sync requests rather than making many small requests. Minimize radio wake-ups.
- **Defer background work.** Chart update checks, cache cleanup, and data sync should happen when the device is charging or on Wi-Fi, not while actively navigating on battery.
- **Dark/night mode reduces OLED power.** On OLED screens, a dark chart color scheme significantly reduces power draw. Night mode should be the default suggestion when Stay Awake is enabled after sunset.

### Performance Budgets

- **Map rendering:** Target 60fps during pan/zoom interaction, allow drop to 30fps during passive tracking (no user interaction).
- **GPS updates:** 1Hz while underway, reduced to 0.1-0.2Hz when stationary.
- **Memory:** PMTiles are memory-mapped — MapLibre handles this efficiently, but monitor memory pressure when loading large chart regions.
- **Startup time:** App should be usable (map visible, GPS locked) within 3 seconds of launch.

## Testing Strategy

Navigation software has safety implications — a wrong calculation or rendering bug can put people in danger. The testing approach prioritizes correctness of critical logic and the ability to reproduce real-world scenarios without requiring a boat.

### What to Test

| Layer                    | What to Test                                                                      | Approach                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Navigation math**      | Bearing, distance, course calculations, coordinate conversions, great circle math | Unit tests with known-good reference values. Pure functions — easy to test, critical to get right.           |
| **Unit conversions**     | Feet/meters, knots/km/h, coordinate format conversions                            | Unit tests. Every conversion function gets a test.                                                           |
| **Tide/weather parsing** | NOAA CO-OPS and Open-Meteo API response parsing                                   | Unit tests with fixture data (saved API responses)                                                           |
| **Signal K parsing**     | Delta and full-model message parsing, unit extraction                             | Unit tests with fixture data                                                                                 |
| **NMEA parsing**         | Sentence parsing, checksum validation, AIS decoding                               | Unit tests with real NMEA sentences                                                                          |
| **State management**     | Zustand store logic — waypoint CRUD, route management, settings                   | Integration tests                                                                                            |
| **Offline behavior**     | Cache hits/misses, stale data handling, download state machine                    | Integration tests with mocked storage                                                                        |
| **Components**           | Data bar, instrument panels, settings screens                                     | Component tests with `react-native-testing-library`                                                          |

### Fixture Data & Simulated Navigation

The app should support loading fixture data for development and testing:

- **Recorded GPS tracks** — Capture real-world GPS sessions (GPX files) and replay them in the app.
- **Simulated position provider** — A development-mode position source that replays a recorded track or follows a predefined route at configurable speed.
- **Saved API responses** — Snapshot NOAA, Open-Meteo, and Signal K responses as JSON fixtures for deterministic testing.
- **Synthetic edge cases** — Generate position sequences for scenarios that are hard to capture in the wild: GPS drift at anchor, sudden course changes, signal loss and recovery.

### Safety-Critical Testing

Features with safety implications deserve extra scrutiny:

- **Depth alarms** — Verify alarm triggers at correct thresholds across all depth unit configurations
- **Anchor watch** — Verify drag detection under various GPS accuracy conditions, including noisy signals
- **Navigation calculations** — Cross-reference bearing/distance calculations against known-good sources (e.g., Vincenty formula reference implementations)
- **Night mode** — Verify no bright-white elements leak through that could destroy night vision

## Open Questions

- **International chart data.** NOAA covers US waters only. For worldwide coverage, we need additional hydrographic office data (UKHO, BSH, LINZ, etc.) or rely on OpenSeaMap.
- **S-57 to PMTiles pipeline automation.** Need to build or adopt a CI pipeline that pulls weekly NOAA ENC updates and produces fresh PMTiles.
- **Nautical symbology.** IHO S-52 defines how nautical charts should look. Creating a MapLibre style spec that faithfully renders S-52 symbology is significant work.
