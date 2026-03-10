# SeaScape

A modern, open source, mobile-first, community driven, extensible marine navigation app.

> [!NOTE]
> This is a snapshot of the current thinking about the project. It will evolve as the project progresses. The goal is to have a clear, shared vision that guides where the project is going.

## Table of Contents

- [Market](#market)
  - [Target Audience](#target-audience)
  - [Competitive Analysis](#competitive-analysis)
- [Product](#product)
  - [Naming](#naming)
  - [Feature Roadmap](#feature-roadmap)
  - [Design Principles & UX](#design-principles--ux)
  - [Offline-First Architecture](#offline-first-architecture)
  - [Internationalization](#internationalization)
- [Technology](#technology)
  - [Target Platforms](#target-platforms)
  - [Technology Research](#technology-research)
  - [Battery & Performance](#battery--performance)
  - [Testing Strategy](#testing-strategy)
- [Business & Operations](#business--operations)
  - [License](#license)
  - [Sustainability](#sustainability)
  - [Distribution Plan](#distribution-plan)

# Market

## Target Audience

Any mariner inclined to reach for a phone or tablet is accustomed to living with modern apps and expects a polished experience. SeaScape aims to serve three distinct user segments, each with different needs, usage patterns, and value to the project:

### Cruisers

Liveaboard and long-distance sailors who depend on their chart plotter every day for passage planning, anchoring, and coastal navigation. This is the founder's own segment and where SeaScape will have the deepest domain expertise.

- **Needs:** Offline charts (critical — often no connectivity), route planning, tides/currents, weather, integration with onboard instruments. These users push every feature to its limits.
- **Usage:** Daily, for hours at a time. Often the primary navigation display at the helm.
- **Tech comfort:** Varies. Some run very complicated setups and are willing to configure and customize, others would rather have paper charts.
- **Willingness to pay:** Moderate. Will pay for quality chart data and reliability, but value open source and data portability. Many have been burned by vendor lock-in.
- **Design implication:** Must support power-user workflows without compromising simplicity for others. Configurable information density. Offline-first is non-negotiable.

### Day Sailors

Casual and weekend sailors on boats, typically smaller boats, typically coastal or lake sailing within a day's range of home port. This is the largest addressable market and where adoption growth will come from.

- **Needs:** Simple chart viewing, GPS position, basic waypoints, weather, tides. "Does this app tell me where I am and is the water deep enough?"
- **Usage:** Intermittent — weekends, seasonal. Short sessions (2-8 hours).
- **Tech comfort:** Varies widely. App must be immediately usable without a manual.
- **Willingness to pay:** Low. Free tier must be fully functional for this segment.
- **Design implication:** Clean, uncluttered UI by default. Progressive disclosure — don't overwhelm with data. Onboarding should be near-zero friction.

### Racers

Competitive sailors (club racing through offshore) who need real-time performance data, tactical weather routing, and instrument integration. This is where commercial revenue potential is highest.

- **Needs:** Real-time instrument data (wind angle, VMG, laylines), weather routing optimized for speed, polars integration, start line tools, tactical overlays. Features SeaScape won't have in early versions.
- **Usage:** Intense but periodic — race days, regattas, deliveries.
- **Tech comfort:** Very high. Expect integration with existing racing instruments and software.
- **Willingness to pay:** High. Already spending on Expedition, PredictWind, dedicated instruments. Will pay for premium features that provide competitive advantage.
- **Design implication:** v0.3+ opportunity via plugin architecture. Don't design core UX for this segment, but don't preclude it either. Signal K integration and extensibility lay the groundwork.

The core tension is between simplicity and power. The answer is **progressive disclosure** — a clean default experience that reveals depth as users need it, with extensibility that lets the community build what they need without bloating the core app.

## Competitive Analysis

See [competitive-analysis.md](competitive-analysis.md) for detailed analysis of open source and commercial alternatives, feature matrices, and key insights.

---

# Product

## Naming

"SeaScape" is a working title. The project lives under **Open Water Software, LLC** (openwaters.io), an umbrella for marine open source projects (tides, bathymetry, charts, etc.). The final name should ideally connect to that brand.

### Candidates

| Name            | App Store Conflicts                                                                                                                | Pros                                                                                      | Cons                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **Open Waters** | No app store conflicts. Non-app conflicts: OpenWater (software company, Inc. 5000), Open Water Foundation, open-waters (EPA tool). | Strongest brand tie-in to Open Water Software. Clean app store namespace.                 | Generic. Crowded non-app brand space.                                                 |
| **Chartbook**   | None found. Aqua Map uses "Chartbooks" as a feature name.                                                                          | Self-explanatory — says exactly what it is. Evokes physical nautical chart books.         | No brand tie-in. Slightly old-fashioned.                                              |
| **Open Helm**   | None found                                                                                                                         | Good brand bridge (Open Water → Open Helm). Communicates both open source and navigation. | "Open [X]" pattern is overused. Kubernetes "Helm" dominates tech search results.      |
| **Pelorus**     | Pelorus (luxury travel itinerary app) on both iOS and Google Play                                                                  | Unique, genuinely nautical (a bearing compass), highly defensible trademark               | Most people won't know what it means. Name taken on both stores (different category). |

**Decision:**: TBD

## Feature Roadmap

Features are prioritized using MoSCoW (Must/Should/Could/Won't) across three milestones. The goal is to ship a useful, differentiated v0.1 as quickly as possible, then layer on capabilities.

### v0.1 — Minimum Viable Chart Plotter

Ship a usable chart viewer with basic navigation. Enough to replace a paper chart on a day sail.

#### Must Have

- [ ] **Map display with nautical charts** — Render vector tiles via MapLibre GL with nautical chart styling (OpenSeaMap or similar open data source)
- [ ] **Real-time GPS position** — Show user's position, heading, and speed on the chart
- [ ] **Zoom, pan, rotate** — Standard map interactions; north-up and course-up modes
- [ ] **Offline chart storage** — Download chart regions for use without connectivity
- [ ] **Basic waypoints** — Drop pins, name them, navigate to them with bearing/distance
- [ ] **Route creation** — Create multi-leg routes by placing waypoints on the chart
- [ ] **Track recording** — Record GPS track while underway; display on chart
- [ ] **Settings & vessel profile** — Configure vessel name, draft, beam, LOA (used later for depth shading and routing)
- [ ] **Safety disclaimer** — "Not for primary navigation" disclaimer in app store listing, first launch, and about screen. Research competitor language and legal requirements before finalizing.

#### Should Have

- [ ] **Chart layer toggling** — Show/hide depth contours, buoys, lights, land features independently
- [ ] **Depth shading by vessel draft** — Color-code areas as safe/caution/danger based on vessel draft (inspired by Wavve)
- [ ] **Distance/bearing measurement tool** — Tap two points to get distance and bearing
- [ ] **GPX import/export** — Import/export waypoints, routes, and tracks for interoperability

#### Could Have

- [ ] **Satellite/hybrid base map** — Toggle between chart-only and satellite imagery overlay
- [ ] **Search** — Find locations, marinas, navigational aids by name
- [ ] **Day/night/dusk color schemes** — Reduce screen brightness and shift colors for night use

### v0.2 — Weather, Tides & Instruments

Layer on environmental data and onboard instrument connectivity.

#### Must Have

- [ ] **Tide station data** — Display tide predictions for nearby stations; tide graphs with current time indicator
- [ ] **Current station data** — Display tidal current predictions and direction
- [ ] **Weather overlay** — Wind, wave, and pressure data displayed on the chart
- [ ] **Signal K integration** — Connect to a Signal K server on the boat's Wi-Fi network to receive instrument data (depth, wind, speed, heading, AIS targets)

#### Should Have

- [ ] **Instrument dashboard** — Configurable panel showing live data from Signal K (SOG, COG, depth, wind speed/direction, water temp)
- [ ] **AIS target display** — Show nearby vessels from Signal K or internet AIS with name, MMSI, COG, SOG
- [ ] **AIS collision warnings** — CPA/TCPA alerts for vessels on converging courses
- [ ] **Anchor alarm** — Set anchor position and radius; alert if vessel drifts outside the watch circle

#### Could Have

- [ ] **Bluetooth LE sensor support** — Connect directly to BLE marine sensors (wind, depth, GPS) without requiring a Signal K server
- [ ] **GRIB file viewer** — Import and display GRIB weather files for offshore passage planning
- [ ] **Weather along route** — Show forecast conditions at each waypoint for a planned departure time

### v0.3 — Smart Navigation & Community

Intelligent routing and community features that differentiate SeaScape.

#### Must Have

- [ ] **Auto-routing** — Calculate routes that avoid land, shallow water (based on vessel draft), and restricted areas
- [ ] **Tide/current-aware routing** — Factor tidal gates and current streams into route timing and ETA
- [ ] **Departure planner** — Suggest optimal departure time based on tides, currents, weather, and daylight

#### Should Have

- [ ] **Open community POI layer** — User-contributed anchorages, marinas, fuel docks, hazards with ratings and reviews (open data, not vendor-locked)
- [ ] **Route sharing** — Share routes via link or GPX with other SeaScape users
- [ ] **Logbook** — Automatic trip logging with track, conditions, and notes

#### Could Have

- [ ] **Plugin/extension architecture** — Allow community-developed plugins to add chart sources, data overlays, instrument widgets, or integrations
- [ ] **Chart Store** — A commercial marketplace for subscribing to chart data from hydrographic offices and third-party providers (e.g. UKHO, LINZ, MarineCharts.io). Enables worldwide coverage beyond free NOAA data and provides a potential sustainability model for the project.
- [ ] **Multi-device sync** — Sync waypoints, routes, and settings across phone, tablet, and desktop
- [ ] **MOB (Man Overboard) alarm** — One-tap MOB button that marks position, sounds alarm, and provides bearing back to the MOB point

### Out of Scope (for now)

- Proprietary chart formats (S-63 encrypted, Navionics, C-MAP)
- Fishfinder/sonar integration
- Radar overlay
- Autopilot output/control
- Social features (seeing other boaters live on map)
- Catch logging / fishing-specific features

## Design Principles & UX

### Design Philosophy

**The app should feel like a top-tier consumer app that happens to be a chart plotter.** The quality bar is AirBnB, Uber, Apple Maps — not traditional marine software. Clean, modern, confident. A day sailor should be able to use it without a manual. A cruiser should be able to live in it for hours.

### Core Principles

1. **The chart is the app.** The map fills the screen. Everything else is an overlay, a sheet, or a bar. Never shrink the chart to make room for chrome.
2. **Progressive disclosure.** Show the most important information by default. Make it easy to drill into more detail. Don't hide critical data, but don't overwhelm with it either.
3. **Readable at arm's length, in motion, in glare.** Every text element must be legible on a bouncing boat in direct sunlight. Err on the side of too large, too bold, too contrasty.
4. **Respect the platform.** Use native iOS and Android components for standard UI (settings, lists, navigation, sheets, toggles). Custom components only for the chart experience itself — data bars, instrument panels, map overlays.
5. **Adapt to conditions.** The app must work equally well in the brightest midday sun and the darkest offshore night. Theme switching is automatic and seamless.

### Information Density

- **Default view:** Full-screen chart with a minimal data bar showing 2-3 key values (SOG, COG, depth when available). Compact enough to not obscure the chart.
- **Expanded view:** Swipe or tap the data bar to expand into a fuller instrument panel with additional readings. Pull down or tap to collapse.
- **Context-sensitive:** When navigating to a waypoint, show bearing and distance. When anchored, show swing radius. When underway with no route, show SOG/COG. The data bar adapts to what matters right now.
- **No clutter by default.** Layer toggles, settings, and secondary information live behind taps — not on the main screen.

### Color Themes

Three modes, with automatic switching by time of day (sunrise/sunset calculated from GPS position). Manual override always available.

| Mode      | When                             | Chart Style                                         | UI Chrome                              | Purpose                                                                      |
| --------- | -------------------------------- | --------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| **Day**   | Sunrise to ~1hr before sunset    | High contrast, light water, dark land/text          | Light backgrounds, dark text           | Maximum readability in direct sunlight                                       |
| **Dusk**  | ~1hr before/after sunrise/sunset | Reduced contrast, muted colors                      | Dark backgrounds, muted text           | Transition period, reduces eye strain                                        |
| **Night** | Sunset to sunrise                | Dark water, dim red/amber tones, minimal brightness | Near-black backgrounds, red/amber text | Preserves night vision (scotopic adaptation). Critical for offshore watches. |

**Design constraints for night mode:**

- No bright whites or blues — these destroy night vision for up to 30 minutes
- Red and amber are the only safe accent colors
- Minimum possible screen brightness
- All chart symbology must remain distinguishable in the night palette

### Platform Design Language

- **Standard UI:** Platform-native components via `@expo/ui` and React Navigation. Settings screens, lists, toggles, bottom sheets, and navigation structure should feel native to iOS and Android respectively.
- **Chart experience:** Custom cross-platform design. The data bar, instrument panels, waypoint popups, and map overlays are custom components that look the same on both platforms — this is the app's identity.
- **Bottom sheet pattern:** Following the Uber/AirBnB model, contextual information surfaces via bottom sheets over the map. Waypoint details, tide graphs, route info — all in sheets that the user can swipe to expand or dismiss.

### Typography

- **System fonts** — San Francisco on iOS, Roboto on Android. No custom fonts. System fonts are optimized for readability on each platform and come free.
- **Tabular numbers** for any value that changes dynamically — SOG, COG, depth, bearing, distance, coordinates. Prevents layout jitter as digits change.
- **Minimum body text size: 15pt.** Larger than typical mobile apps. On a boat, the phone is often at arm's length, mounted on a helm bracket, or being read in difficult conditions.
- **Bold for critical values.** Depth, speed, and bearing should be immediately scannable. Use font weight to create visual hierarchy in the data bar.

### Interaction Patterns

- **Map gestures:** Standard — pinch to zoom, drag to pan, two-finger rotate. Double-tap to zoom in. Single-tap on chart features (buoys, waypoints, depth soundings) to show details in a popup or sheet.
- **Long press to create.** Long press on the chart to drop a waypoint or start a measurement. Follows iOS/Android convention for creation actions.
- **Swipe for context.** Swipe up on the data bar for more detail. Swipe down to dismiss sheets. Gesture-driven navigation minimizes small tap targets on a moving boat.
- **Large touch targets.** All interactive elements should be at least 44x44pt (iOS HIG minimum). For frequently-used controls on the chart (zoom, center on position, compass), consider going larger.

### Responsive Layout

The app should work across phones, tablets, and desktop screens. Each form factor gets an appropriate level of information density:

- **Phone:** The most constrained layout. Full-screen chart with a compact data bar. Details surface via bottom sheets. One thing at a time.
- **Tablet:** More room to show secondary information alongside the chart. A side panel can display route details, tide graphs, or instrument readings without covering the map. Split-view multitasking support on iPad.
- **Desktop (macOS/Windows):** The most spacious layout. Multiple panels can be open simultaneously — chart, instruments, weather, route planning — in a traditional windowed layout. Keyboard shortcuts for power users.

Use responsive breakpoints, not platform detection. A tablet in portrait may get the phone layout; a phone in landscape on a helm mount may get more density. Let the available space drive the layout.

### Modes & Context

Charting is one mode a sailor operates in. The app should eventually support different contexts, adapting its information hierarchy to what the user is doing:

- **Dock/anchor:** Focused on conditions — weather forecast, tide predictions, wind trends. "Should I leave today?" The chart is secondary; data panels are primary.
- **Coastal navigation:** The core charting mode. Chart is primary, with real-time position, nearby hazards, waypoint navigation, and depth. Active piloting.
- **Offshore/passage:** Long stretches of open water. Traffic, hazards, weather routing, ETA, watch schedules, and position reports matter more than chart detail. The chart zooms out; the data bar shows passage-relevant info.

These modes don't need to be explicit UI states at launch — they can emerge naturally through progressive disclosure and context-sensitive data bars. But the architecture should anticipate them, so the UI can adapt as the feature set grows.

## Offline-First Architecture

The app works offline. Period. An intermittent internet connection is needed to sync content (charts, tide data, weather forecasts), but once synced, the app is fully functional with no connectivity.

### Design Principle

**Offline is the default state, not a fallback.** On the water — especially for cruisers — there is often no cell service. Every feature must be designed to work without a network connection first, with online connectivity as an enhancement that refreshes and syncs data when available.

### Data by Category

| Data                          | Storage                  | Sync Strategy                                                                                                    | Offline Behavior                                                                                                                                                 |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Charts (PMTiles)**          | Local filesystem         | Auto-sync nearby charts during daily use; manually download additional regions on Wi-Fi; background update check | Fully offline. No charts = no app, so this is the first thing users download.                                                                                    |
| **Waypoints, routes, tracks** | Local database           | Local-first. Sync across devices (v0.3) when connected.                                                          | Fully offline. All user data lives on-device. Never depends on a server.                                                                                         |
| **Vessel profile & settings** | Local storage            | Local-first. Sync across devices (v0.3) when connected.                                                          | Fully offline.                                                                                                                                                   |
| **Tide predictions**          | Pre-computed local cache | Download predictions for selected stations (e.g., 7-30 days ahead). Refresh when connected.                      | Works with cached predictions. Show "last updated" timestamp. Tide predictions are deterministic — can be computed from harmonic constituents offline if needed. |
| **Weather**                   | Cached forecasts         | Fetch latest forecast when connected. Cache most recent.                                                         | Show last-fetched forecast with age indicator ("3 hours old"). Weather is inherently perishable — stale data is clearly marked but still useful.                 |
| **AIS (internet)**            | In-memory only           | Real-time stream when connected                                                                                  | Not available offline. AIS via Signal K (local Wi-Fi) works independently of internet.                                                                           |
| **GPS position**              | Device sensor            | N/A                                                                                                              | Always works — GPS is satellite-based, no internet needed.                                                                                                       |
| **Signal K instruments**      | In-memory (live data)    | N/A — local Wi-Fi connection to boat's network                                                                   | Works on boat's local network. Independent of internet.                                                                                                          |

### Connectivity States

The app should clearly communicate its connectivity state without being annoying about it:

- **Online** — All data fresh. Background sync happening. No indicator needed.
- **Offline with fresh data** — Everything works. Subtle indicator (e.g., small icon) showing offline status. No interruption to workflow.
- **Offline with stale data** — Everything works but some data is old. Show age on stale items (e.g., "Weather: 6h ago"). User decides if it's still useful.
- **Offline with missing data** — Charts not downloaded for this area, no tide data cached. Clear messaging about what's missing and how to get it ("Download charts for this region").

### Storage Considerations

- **Charts are the largest data.** A single US coastal region in PMTiles could be 50-500MB. Two download modes: (1) nearby charts auto-sync in the background as part of normal use — if you're browsing an area with connectivity, those tiles get cached; (2) explicit "Download region" for passage planning or areas you know you'll visit without connectivity.
- **Local database for user data.** SQLite (via expo-sqlite or similar) for waypoints, routes, tracks. This is the source of truth — cloud sync is a convenience layer on top, not a dependency.
- **Cache budget.** Weather and tide caches should have sensible defaults (e.g., 7 days of tide predictions, last weather forecast) and be refreshed opportunistically when connectivity appears.

## Internationalization

i18n support should be built into the app from day one. Retrofitting localization is significantly harder than starting with it, and marine navigation is inherently global.

### Approach

- **Framework from v0.1, translations when contributed.** Ship v0.1 with English only, but every user-facing string goes through a localization system. When a community member contributes a translation, it plugs in without code changes.
- **Use `expo-localization` + `i18next`** (or similar). `expo-localization` provides the device locale; `i18next` with `react-i18next` is the most mature i18n library for React with pluralization, interpolation, and namespace support. Translation files live as JSON in the repo.

### What Gets Localized

| Layer                    | Approach                          | Notes                                                                                                                                         |
| ------------------------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **App UI strings**       | i18next translation keys          | Buttons, labels, menus, settings, error messages, onboarding                                                                                  |
| **Map labels**           | MapLibre `text-field` expressions | Protomaps/OSM tiles already contain `name:fr`, `name:es`, etc. Use `coalesce` expressions to prefer the user's locale, falling back to `name` |
| **Chart data**           | Source-dependent                  | NOAA ENC data is English-only. International chart sources (UKHO, BSH) may provide native-language labels. Pass through as-is.                |
| **Tide station names**   | Pass through from API             | NOAA station names are English. International tide services will use local names. No translation needed.                                      |
| **Date/time formatting** | Platform locale APIs              | Use `Intl.DateTimeFormat` or `expo-localization` for locale-appropriate date, time, and number formatting                                     |

### Units

Units should be configurable with sensible regional defaults. Marine navigation has strong conventions, but depth units are a real split.

| Measurement     | Options                           | Default                                               |
| --------------- | --------------------------------- | ----------------------------------------------------- |
| **Speed**       | Knots, km/h, mph                  | Knots (universal marine convention)                   |
| **Distance**    | Nautical miles, km, statute miles | Nautical miles                                        |
| **Depth**       | Feet, meters, fathoms             | Feet (US locale), meters (everywhere else)            |
| **Wind speed**  | Knots, m/s, km/h, Beaufort        | Knots                                                 |
| **Temperature** | °F, °C                            | °F (US locale), °C (everywhere else)                  |
| **Pressure**    | hPa/mbar, inHg                    | inHg (US locale), hPa (everywhere else)               |
| **Coordinates** | DD, DM, DMS                       | DM (degrees decimal minutes — standard marine format) |

Locale-based defaults can be overridden in settings. All unit conversions happen at the display layer — internal data is stored in SI/nautical units.

### Translation Workflow

- Translation files stored as `locales/{lang}.json` in the repo
- Community contributions via pull request — low barrier, version-controlled
- Consider [Weblate](https://weblate.org/) or [Crowdin](https://crowdin.com/) if translation volume grows beyond what PRs can handle
- Strings should use descriptive keys (`nav.speed.label`, `settings.units.depth`) rather than English text as keys, to avoid breakage when English copy changes

### RTL Support

RTL languages (Arabic, Hebrew) are a future concern. The app should avoid hardcoded directional assumptions (use `start`/`end` instead of `left`/`right` in styles), but full RTL support is not required for v0.1.

---

# Technology

- MUST: iOS, Android
- SHOULD: MacOS, Windows
- COULD: Linux

## Application Framework: React Native + Expo

- **Cross-platform from day one.** iOS, Android, and (via Expo) macOS/Windows are all reachable from a single codebase. This directly serves the target platform matrix (MUST: iOS/Android, SHOULD: macOS/Windows).
- **Expo 54 + React Native 0.81** — Already in the project. Expo provides managed native modules for GPS (`expo-location`), haptics, file system, and more — reducing native boilerplate significantly.
- **JavaScript/TypeScript ecosystem** — Signal K (the primary instrument integration target) is Node.js-based with JSON data models. Sharing types and parsing logic between SeaScape and Signal K is natural.
- **Large contributor pool.** React/JS is the most widely known frontend stack, lowering the barrier for open source contributors.

### Map Library: MapLibre Native

- **Open source, no vendor lock-in.** MapLibre is the community fork of Mapbox GL after Mapbox went proprietary. It's the only production-grade open source vector tile renderer for native mobile.
- **v11 (currently alpha, in the project) brings:**
  - Better React Native New Architecture support (bridgeless mode)
  - PMTiles support in MapLibre Native (Android 11.8.0, iOS 6.10.0) — critical for offline charts
  - Configurable SDK versions — adopt upstream MapLibre Native releases immediately
- **Offline support** — Built-in `OfflineManager` for downloading tile regions. Supports MBTiles and (in v11) PMTiles natively.
- **Custom styling** — MapLibre style spec allows full control over chart rendering: depth contours, buoy symbols, light sectors, etc.
- **Ecosystem** — Used by Protomaps, OpenFreeMap, MapTiler, Stadia Maps. Strong community.

### Chart Data: Nautical Vector Tiles

The current state of modern nautical chart data is one of the biggest gaps/challenges for this project. NOAA provides official US charts in S-57 format, but these are not directly usable in a mobile app. OpenSeaMap provides open vector data for seamarks and buoys, but coverage and styling are inconsistent. There is no single, global, open source nautical vector tile provider with a modern style (yet).

#### Data Sources (Open)

| Source                                                               | Coverage  | Format                  | Update Freq | License         | Notes                                                                                 |
| -------------------------------------------------------------------- | --------- | ----------------------- | ----------- | --------------- | ------------------------------------------------------------------------------------- |
| **[NOAA ENC](https://nauticalcharts.noaa.gov/charts/noaa-enc.html)** | US waters | S-57 (.000)             | Weekly      | Public domain   | Official US nautical charts; also available as MBTiles via NOAA Chart Display Service |
| **[OpenSeaMap](https://map.openseamap.org/)**                        | Worldwide | OSM data + raster tiles | Continuous  | ODbL            | Seamarks, buoys, lights as OSM tags; vector tile generator exists but immature        |
| **[OpenStreetMap](https://www.openstreetmap.org/)**                  | Worldwide | PBF / vector tiles      | Continuous  | ODbL            | Land features, coastlines, ports, marinas; base map layer                             |
| **[Protomaps](https://protomaps.com/)**                              | Worldwide | PMTiles                 | Monthly     | ODbL (OSM data) | OSM-based vector basemap in a single PMTiles file; great for offline                  |

#### Chart Rendering Pipeline

The recommended approach is a **layered tile stack** rendered by MapLibre:

```
Layer 1: Base map (land, roads, coastline)     ← Protomaps / OpenFreeMap PMTiles
Layer 2: Nautical overlay (buoys, lights, etc.) ← OpenSeaMap vector tiles or custom S-57 pipeline
Layer 3: Depth contours & bathymetry            ← NOAA ENC converted to vector tiles
Layer 4: Dynamic data (AIS, weather, user data) ← App-rendered GeoJSON overlays
```

**S-57 → Vector Tiles pipeline:**

1. Download NOAA ENC files (.000 format)
2. Convert to GeoJSON using GDAL (`ogr2ogr`)
3. Process through [tippecanoe](https://github.com/felt/tippecanoe) to generate MVT/MBTiles or PMTiles
4. Style with MapLibre style spec (custom nautical symbology)
5. Serve as PMTiles (single file, no tile server needed) or host on static storage

Existing projects doing this: [s57tiler](https://github.com/manimaul/s57tiler), [BAUV-Maps](https://github.com/kaaninan/BAUV-Maps)

**Commercial option:** [MarineCharts.io](https://marinecharts.io/) offers pre-built nautical vector tiles with MapLibre-compatible styles (US coverage). Could accelerate v0.1 while building the open pipeline in parallel.

#### Tile Format: PMTiles (recommended)

| Format        | Offline            | Server Required                   | Deduplication             | MapLibre Native Support |
| ------------- | ------------------ | --------------------------------- | ------------------------- | ----------------------- |
| **PMTiles**   | Single file        | No (static hosting or local file) | Yes (70%+ size reduction) | Yes (v11.8+)            |
| **MBTiles**   | Single file        | No (SQLite)                       | No                        | Yes (mature)            |
| **XYZ tiles** | Directory of files | Yes (or pre-downloaded)           | No                        | Yes                     |

PMTiles is the recommended format for SeaScape because:

- Single file per region — simple to download and manage offline
- No tile server needed — can be read directly from local storage or static CDN
- Built-in deduplication reduces download size significantly (ocean tiles are mostly identical)
- Native support in MapLibre v11 (already in the project)

### Data APIs

| Data                 | Source                                                          | API                     | Cost                  | Notes                                                          |
| -------------------- | --------------------------------------------------------------- | ----------------------- | --------------------- | -------------------------------------------------------------- |
| **Tides & currents** | [Neaps](https://openwaters.io/tides/neaps)                      | TypeScript              | Free                  | 6,000+ global stations; metadata, predictions, no observations |
| **Marine weather**   | [Open-Meteo](https://open-meteo.com/en/docs/marine-weather-api) | REST (JSON)             | Free (non-commercial) | Waves, swell, wind; 7-day forecast; no API key required        |
| **General weather**  | [Open-Meteo](https://open-meteo.com/)                           | REST (JSON)             | Free (non-commercial) | Wind, temp, pressure, precipitation; ECMWF/GFS models          |
| **AIS (internet)**   | Various                                                         | WebSocket/REST          | Varies                | AISHub (free community), MarineTraffic (paid), or Signal K     |
| **Instrument data**  | [Signal K](https://signalk.org/)                                | REST + WebSocket (JSON) | Free (onboard)        | Depth, wind, speed, heading, AIS — all via one connection      |

### Open Questions

- **International chart data.** NOAA covers US waters only. For worldwide coverage, we need additional hydrographic office data (UKHO, BSH, LINZ, etc.) or rely on OpenSeaMap. This is a v0.2+ concern.
- **MapLibre React Native v11 stability.** Currently alpha. Need to track progress toward stable release and test offline PMTiles loading on both platforms.
- **S-57 → PMTiles pipeline automation.** Need to build or adopt a CI pipeline that pulls weekly NOAA ENC updates and produces fresh PMTiles. s57tiler is a starting point but may need customization for our style spec.
- **Nautical symbology.** IHO S-52 defines how nautical charts should look. Creating a MapLibre style spec that faithfully renders S-52 symbology is significant work. Evaluate whether MarineCharts.io or community styles can bootstrap this.

## Battery & Performance

A chart plotter on a boat may run for hours with the screen on, GPS active, and no way to charge. Battery efficiency is a first-class concern, not an afterthought.

### Stay Awake Mode

The app should have an explicit **Stay Awake** toggle that prevents the screen from sleeping. When enabled:

- Screen stays on indefinitely (using `expo-keep-awake` or equivalent)
- GPS continues updating
- Map continues rendering at the helm

When disabled (the default), the app follows normal OS screen sleep behavior. The user controls this — the app never silently prevents sleep.

### Battery Optimization Strategies

- **Reduce GPS polling when stationary.** If the vessel hasn't moved beyond a threshold (e.g., at anchor or at the dock), reduce GPS update frequency from 1Hz to every 5-10 seconds. Resume full-rate polling when movement is detected.
- **Reduce map frame rate when idle.** If the user hasn't interacted with the map and the vessel is stationary, drop MapLibre rendering to a lower frame rate or pause re-renders entirely. Resume on touch or movement.
- **Batch network requests.** When connectivity is available, batch tide, weather, and chart sync requests rather than making many small requests. Minimize radio wake-ups.
- **Defer background work.** Chart update checks, cache cleanup, and data sync should happen when the device is charging or on Wi-Fi, not while actively navigating on battery.
- **Dark/night mode reduces OLED power.** On OLED screens (most modern phones), a dark chart color scheme significantly reduces power draw. Night mode should be the default suggestion when Stay Awake is enabled after sunset.

### Performance Budgets

- **Map rendering:** Target 60fps during pan/zoom interaction, allow drop to 30fps during passive tracking (no user interaction).
- **GPS updates:** 1Hz while underway, reduced to 0.1-0.2Hz when stationary.
- **Memory:** PMTiles are memory-mapped — MapLibre handles this efficiently, but monitor memory pressure when loading large chart regions. Set an upper bound on cached tiles in memory.
- **Startup time:** App should be usable (map visible, GPS locked) within 3 seconds of launch. Chart rendering can progressively load detail.

### Track Recording & Background GPS

When recording a track, the app needs GPS updates even when backgrounded or when the screen is off. This requires:

- Background location permissions (iOS: "Always" location access; Android: background location)
- Reduced GPS rate in background — 0.1-0.5Hz is sufficient for track recording (a boat moves slowly). No need for 1Hz when the screen is off.
- Efficient track point storage — don't record a point every second if the vessel is on a steady heading. Use distance/heading-change thresholds to reduce storage and battery use.
- Clear user messaging about battery impact when enabling track recording for long passages.

## Testing Strategy

Navigation software has safety implications — a wrong calculation or rendering bug can put people in danger. The testing approach prioritizes correctness of critical logic and the ability to reproduce real-world scenarios without requiring a boat.

### Test Framework

**Vitest** for unit and integration tests. Already in the project and well-suited to the TypeScript/React Native stack. Use `react-native-testing-library` for component tests.

### What to Test

Philosophy: **test what is testable, and test what you don't want to break.**

| Layer                    | What to Test                                                                      | Approach                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Navigation math**      | Bearing, distance, course calculations, coordinate conversions, great circle math | Unit tests with known-good reference values. These are pure functions — easy to test, critical to get right. |
| **Unit conversions**     | Feet↔meters, knots↔km/h, coordinate format conversions                            | Unit tests. Every conversion function gets a test.                                                           |
| **Anchor watch**         | Swing radius calculation, drag detection thresholds                               | Unit tests with simulated position sequences                                                                 |
| **Tide/weather parsing** | NOAA CO-OPS and Open-Meteo API response parsing                                   | Unit tests with fixture data (saved API responses)                                                           |
| **Signal K parsing**     | Delta and full-model message parsing, unit extraction                             | Unit tests with fixture data                                                                                 |
| **State management**     | Zustand store logic — waypoint CRUD, route management, settings                   | Integration tests                                                                                            |
| **Offline behavior**     | Cache hits/misses, stale data handling, download state machine                    | Integration tests with mocked storage                                                                        |
| **Components**           | Data bar, instrument panels, settings screens                                     | Component tests with `react-native-testing-library`                                                          |

### What NOT to Test (or test differently)

- **Map rendering** — MapLibre renders tiles via native OpenGL. Don't try to unit test map output. Instead, rely on visual review and snapshot testing for style configurations.
- **GPS accuracy** — The device's GPS is outside our control. Test the app's _response_ to GPS data, not the data itself.
- **Full E2E flows** — Defer comprehensive end-to-end testing until the app is stable enough to warrant the maintenance cost. Use manual testing and the beta program for now.

### Fixture Data & Simulated Navigation

The app should support loading fixture data for development and testing:

- **Recorded GPS tracks** — Capture real-world GPS sessions (GPX files) and replay them in the app. Useful for testing coastal navigation, anchor watch, and route following without leaving the desk.
- **Simulated position provider** — A development-mode position source that replays a recorded track or follows a predefined route at configurable speed. Replaces `expo-location` during testing.
- **Saved API responses** — Snapshot NOAA, Open-Meteo, and Signal K responses as JSON fixtures for deterministic testing.
- **Synthetic edge cases** — Generate position sequences for scenarios that are hard to capture in the wild: GPS drift at anchor, sudden course changes, signal loss and recovery.

### CI

**GitHub Actions** for automated testing on every push and PR:

- Run Vitest suite
- TypeScript type checking (`tsc --noEmit`)
- Lint (`eslint`)
- Build verification (EAS Build dry run or `expo export` to catch build-breaking changes)

Keep the CI fast — aim for under 5 minutes. Save device-specific builds for release branches.

### Beta Testing

- **TestFlight** (iOS) and **Google Play internal testing** (Android) for distributing beta builds
- **EAS Build + EAS Update** for managing beta builds and OTA updates to testers
- Beta group: start with a small group of trusted cruisers who use the app on real boats in real conditions. Expand as stability improves.
- Include a built-in feedback mechanism — shake-to-report or a feedback button in settings that captures device info, app version, and current position (with permission)

### Safety-Critical Testing

Features with safety implications deserve extra scrutiny:

- **Depth alarms** — Verify alarm triggers at correct thresholds across all depth unit configurations
- **Anchor watch** — Verify drag detection under various GPS accuracy conditions, including noisy signals
- **Navigation calculations** — Cross-reference bearing/distance calculations against known-good sources (e.g., Vincenty formula reference implementations)
- **Night mode** — Verify no bright-white elements leak through that could destroy night vision

These areas should have the highest test coverage and be explicitly called out in PR review checklists.

---

# Business & Operations

## License

**Decision: GPL v3** — with awareness of App Store constraints that may require a distribution exception or dual-licensing strategy.

### Why GPL v3

- **Copyleft protection.** Modifications to SeaScape must be shared back. No one can fork the app, close the source, and compete with a proprietary version. This matters for a project where the core value is community trust and data openness.
- **Aligned with the marine open source ecosystem.** OpenCPN uses GPLv2. Choosing GPL v3 keeps SeaScape in the same family and signals the same values to the cruising and open source communities.
- **Chart data is not affected.** GPL applies to source code, not content. Chart data sold through the Chart Store, weather data, tide predictions — none of this is subject to the GPL. The commercial Chart Store model works fine under GPL v3.
- **Dependency compatibility.** All current dependencies (React Native, Expo, MapLibre, Zustand) use MIT or BSD licenses, which are forward-compatible with GPL v3. No conflicts.

### App Store Distribution Risk

The FSF's position is that GPL v3 is incompatible with Apple's App Store terms. The core conflict: Apple's DRM and device restrictions constitute "additional restrictions" that GPL v3 Section 3 prohibits. Google Play has the same theoretical issue but has been less aggressive about enforcement.

**The VLC precedent:** VLC was removed from the iOS App Store in 2011 after a developer filed a GPL compliance complaint. It took a massive relicensing effort (230+ contributors) to move to MPL 2.0, and VLC returned to iOS in 2013.

**Mitigation options:**

1. **Copyright holder exception.** As long as the project retains copyright ownership (via CLA or sole authorship), the copyright holder can grant themselves permission to distribute on the App Store without violating the GPL. This is how Signal (AGPL v3) and WordPress (GPLv2) ship on the App Store.
2. **Dual license.** Offer the code under GPL v3 for general use, with an App Store-compatible license (e.g., MPL 2.0) for distribution builds. This preserves copyleft intent while solving the distribution problem.
3. **CLA for contributors.** A Contributor License Agreement would assign copyright or grant sufficient rights to the project to maintain the ability to distribute on the App Store. Adds friction for contributors but is common practice (Apache, Eclipse, Qt).

**Recommendation:** Start with GPL v3 + a lightweight CLA. This preserves copyleft, enables App Store distribution via copyright holder exception, and can be revisited if the CLA becomes a contributor friction problem.

### Plugin Implications

Under GPL v3, plugins that run in-process and use SeaScape's internal APIs are generally considered derivative works and must be GPL-compatible. This is the same model OpenCPN uses (40+ plugins, all GPLv2+). If the plugin architecture later needs to support proprietary plugins, a plugin API exception (similar to WordPress's) could be added.

## Sustainability

SeaScape needs a path to financial sustainability before v0.1 ships. The goal isn't profit — it's covering hosting costs, chart data licensing, and eventually enabling dedicated development time.

### Revenue Tiers

#### Tier 1: Community Support (from launch)

- **GitHub Sponsors / Patreon** — Recurring donations from users who value the project. Low friction, low revenue, but establishes the relationship early. Target: cover hosting and infrastructure costs.
- **One-time donations** — For users who want to support the project without a subscription.

#### Tier 2: Paid App (from v0.1)

- **Paid download on App Store / Google Play** — A one-time purchase price (e.g., $9.99) rather than a subscription. Rationale:
  - Sailors are skeptical of subscriptions (burned by Navionics switching from one-time to subscription, which generated widespread resentment).
  - A one-time price signals confidence in the product and respect for the user.
  - The source code remains free and open under GPL v3 — the paid download covers the convenience of the App Store build, signing, and distribution.
  - F-Droid (Android) can offer the app for free, built from source.
- **Alternative: freemium with a paid upgrade.** The core app is free, with an in-app purchase to unlock premium features (instrument dashboard, advanced overlays, etc.). Lower barrier to adoption, but more complex to implement and explain alongside open source.
- **Open question:** One-time purchase vs. subscription vs. freemium. Needs user research.

#### Tier 3: Add-on Store (from v0.3)

- **Chart Store** — Revenue share from chart data subscriptions. Hydrographic offices (UKHO, LINZ, etc.) and third-party providers (MarineCharts.io) sell chart data through SeaScape's in-app marketplace. SeaScape takes a percentage (10-20%) to fund development. This is the highest-potential revenue source.
- **Paid plugins/extensions** — Third-party developers can sell premium plugins (racing tools, advanced weather routing, specialized instrument dashboards) through an extension marketplace. SeaScape takes a percentage.
- **Premium data services** — Enhanced weather data, high-resolution bathymetry, or real-time AIS feeds available as paid subscriptions.

### What's Free, What's Paid

| Feature                        | Free (source / F-Droid) | Paid (App Store) | Add-on Store |
| ------------------------------ | ----------------------- | ---------------- | ------------ |
| Core charting & navigation     | Yes                     | Yes              | —            |
| NOAA charts (US)               | Yes                     | Yes              | —            |
| GPS, waypoints, routes, tracks | Yes                     | Yes              | —            |
| Tides & weather                | Yes                     | Yes              | —            |
| Signal K integration           | Yes                     | Yes              | —            |
| International charts           | —                       | —                | Subscription |
| Premium plugins                | —                       | —                | Per-plugin   |
| Enhanced data feeds            | —                       | —                | Subscription |

### Precedents

- **OpenCPN:** Free on desktop, paid on Google Play. Has sustained development for 15+ years but relies heavily on volunteer effort. Limited ability to fund full-time developers.
- **Signal:** AGPL v3, funded by the Signal Foundation (non-profit). Free on all platforms. Not a revenue model SeaScape can replicate.
- **Krita:** GPL v3, free on all platforms, but sells on Steam and Microsoft Store for convenience. Similar to the proposed paid App Store model.
- **Blender:** GPL v2, funded by the Blender Foundation via corporate sponsors and the Development Fund. Relevant if SeaScape attracts corporate interest (marine hardware companies, charter companies).

### Priority

1. Set up GitHub Sponsors before v0.1 — zero effort, immediate availability
2. Ship v0.1 as a paid app on App Store / Google Play — validates willingness to pay
3. Build Chart Store infrastructure for v0.3 — the long-term sustainability play

## Distribution Plan

### Versioning

Semver (`MAJOR.MINOR.PATCH`). The version communicates stability expectations:

- **0.x.y** — Pre-release. The app works but is not yet reliable for real-world navigation. Breaking changes can happen between minor versions. This is the "building in public" phase.
- **1.0.0** — The app is reliable enough for actual charting and navigation. A real user (you) can depend on it for coastal navigation. This is a "feels ready" milestone, not a feature checkbox.
- **Post-1.0** — Semver rules apply. Patch for bug fixes, minor for new features, major for breaking changes.

Build numbers are separate from version numbers. Use auto-incrementing build numbers for App Store / Google Play (managed by EAS or CI).

### Platforms

#### iOS — App Store

- **TestFlight** for beta distribution. TestFlight supports up to 10,000 external testers, handles crash reporting, and is frictionless for iOS users. Use this from the earliest builds.
- **App Store submission** at v0.1 or later, when the app provides enough value to justify a paid listing. Requires Apple Developer Program ($99/year).
- **App Review considerations:** Navigation apps get extra scrutiny. Apple requires a privacy policy, location usage descriptions, and may question "not for primary navigation" disclaimers. Prepare for a few rounds of review feedback.

#### Android — Google Play + F-Droid

- **Google Play internal testing** for beta distribution. Similar to TestFlight — invite-only, managed through Google Play Console. Use from early builds.
- **Google Play production** at v0.1, alongside the iOS launch. Requires Google Play Developer account ($25 one-time).
- **F-Droid** — Actively maintain an F-Droid listing. This is the right thing to do for a GPL v3 project:
  - F-Droid builds from source, which validates that the app is truly open source and reproducible.
  - It serves the community that specifically seeks out free/open software — these are likely to be contributors.
  - F-Droid metadata lives in the [fdroiddata](https://gitlab.com/fdroid/fdroiddata) repo as a YAML file describing the build. Maintenance is minimal once set up.
  - The app is free on F-Droid (built from source by the community). The paid Google Play listing covers convenience, automatic updates, and supporting the project.

#### Desktop (macOS / Windows) — Future

Not a priority for v0.1. When ready:

- **macOS:** Distribute via the Mac App Store (Catalyst or native build via Expo) or direct download (notarized `.dmg`).
- **Windows:** Microsoft Store or direct download (`.msix` or `.exe`). Krita's model of selling on the Microsoft Store while offering a free download is a good precedent.

### Build & Release Pipeline

Use **GitHub Actions** for the full build pipeline:

1. **On PR / push:** Run tests, lint, type check (already defined in Testing Strategy)
2. **On release tag:** Build production binaries for iOS and Android
3. **iOS builds:** Use `eas build` (Expo Application Services) for iOS builds. Self-hosting iOS builds requires macOS runners and managing certificates/provisioning profiles — EAS handles this for $0 on the free tier (limited builds) and abstracts away code signing. This is the one place EAS earns its keep.
4. **Android builds:** Can be built on standard GitHub Actions runners (Linux). EAS is optional here — the value is lower since Android builds don't require macOS or complex signing.
5. **Submission:** `eas submit` can automate App Store / Google Play uploads, or use Fastlane for more control.

### Release Process

1. Tag a release on `main` (`git tag v0.1.0`)
2. GitHub Actions triggers production builds
3. Builds upload to TestFlight (iOS) and Google Play internal testing (Android)
4. Manual review / smoke test on real devices
5. Promote to production in App Store Connect and Google Play Console
6. F-Droid picks up the new tag automatically (once the fdroiddata recipe is in place)
7. Create a GitHub Release with changelog

### Release Cadence

Ship when ready. No fixed schedule. As the project matures and gains users, consider moving to a more predictable cadence — but for now, the overhead of scheduled releases isn't worth it.
