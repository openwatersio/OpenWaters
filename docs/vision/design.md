# Design Principles & UX

## Design Philosophy

**The app should feel like a top-tier consumer app that happens to be a chart plotter.** The quality bar is AirBnB, Uber, Apple Maps — not traditional marine software. Clean, modern, confident. A day sailor should be able to use it without a manual. A cruiser should be able to live in it for hours.

## Core Principles

1. **The chart is the app.** The map fills the screen. Everything else is an overlay, a sheet, or a bar. Never shrink the chart to make room for chrome.
2. **Progressive disclosure.** Show the most important information by default. Make it easy to drill into more detail. Don't hide critical data, but don't overwhelm with it either.
3. **Readable at arm's length, in motion, in glare.** Every text element must be legible on a bouncing boat in direct sunlight. Err on the side of too large, too bold, too contrasty.
4. **Respect the platform.** Use native iOS components for standard UI (settings, lists, navigation, sheets, toggles). Custom components only for the chart experience itself — data bars, instrument panels, map overlays.
5. **Adapt to conditions.** The app must work equally well in the brightest midday sun and the darkest offshore night. Theme switching is automatic and seamless.

## Information Density

- **Default view:** Full-screen chart with a minimal data bar showing 2-3 key values (SOG, COG, depth when available). Compact enough to not obscure the chart.
- **Expanded view:** Swipe or tap the data bar to expand into a fuller instrument panel with additional readings. Pull down or tap to collapse.
- **Context-sensitive:** When navigating to a waypoint, show bearing and distance. When anchored, show swing radius. When underway with no route, show SOG/COG. The data bar adapts to what matters right now.
- **No clutter by default.** Layer toggles, settings, and secondary information live behind taps — not on the main screen.

## Color Themes

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

## Typography

- **System fonts** — San Francisco on iOS. No custom fonts. System fonts are optimized for readability and come free.
- **Tabular numbers** for any value that changes dynamically — SOG, COG, depth, bearing, distance, coordinates. Prevents layout jitter as digits change.
- **Minimum body text size: 15pt.** Larger than typical mobile apps. On a boat, the phone is often at arm's length, mounted on a helm bracket, or being read in difficult conditions.
- **Bold for critical values.** Depth, speed, and bearing should be immediately scannable. Use font weight to create visual hierarchy in the data bar.

## Interaction Patterns

- **Map gestures:** Standard — pinch to zoom, drag to pan, two-finger rotate. Double-tap to zoom in. Single-tap on chart features (buoys, waypoints, depth soundings) to show details in a popup or sheet.
- **Long press to create.** Long press on the chart to drop a waypoint or start a measurement. Follows iOS convention for creation actions.
- **Swipe for context.** Swipe up on the data bar for more detail. Swipe down to dismiss sheets. Gesture-driven navigation minimizes small tap targets on a moving boat.
- **Large touch targets.** All interactive elements should be at least 44x44pt (iOS HIG minimum). For frequently-used controls on the chart (zoom, center on position, compass), consider going larger.

## Responsive Layout

The app should work across phones and tablets. Each form factor gets an appropriate level of information density:

- **Phone:** The most constrained layout. Full-screen chart with a compact data bar. Details surface via bottom sheets. One thing at a time.
- **Tablet:** More room to show secondary information alongside the chart. A side panel can display route details, tide graphs, or instrument readings without covering the map. Split-view multitasking support on iPad.

Use responsive breakpoints, not platform detection. A tablet in portrait may get the phone layout; a phone in landscape on a helm mount may get more density. Let the available space drive the layout.

## Modes & Context

Charting is one mode a sailor operates in. The app should eventually support different contexts, adapting its information hierarchy to what the user is doing:

- **Dock/anchor:** Focused on conditions — weather forecast, tide predictions, wind trends. "Should I leave today?" The chart is secondary; data panels are primary.
- **Coastal navigation:** The core charting mode. Chart is primary, with real-time position, nearby hazards, waypoint navigation, and depth. Active piloting.
- **Offshore/passage:** Long stretches of open water. Traffic, hazards, weather routing, ETA, watch schedules, and position reports matter more than chart detail. The chart zooms out; the data bar shows passage-relevant info.

These modes don't need to be explicit UI states at launch — they can emerge naturally through progressive disclosure and context-sensitive data bars. But the architecture should anticipate them, so the UI can adapt as the feature set grows.

## Offline-First Architecture

The app works offline. Period. An intermittent internet connection is needed to sync content (charts, tide data, weather forecasts), but once synced, the app is fully functional with no connectivity.

**Offline is the default state, not a fallback.** On the water — especially for cruisers — there is often no cell service. Every feature must be designed to work without a network connection first, with online connectivity as an enhancement that refreshes and syncs data when available.

### Data by Category

| Data                          | Storage                  | Sync Strategy                                                                                                    | Offline Behavior                                                                                                                                                 |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Charts (PMTiles)**          | Local filesystem         | Auto-sync nearby charts during daily use; manually download additional regions on Wi-Fi; background update check | Fully offline. No charts = no app, so this is the first thing users download.                                                                                    |
| **Waypoints, routes, tracks** | Local database           | Local-first. Sync across devices when connected.                                                                 | Fully offline. All user data lives on-device. Never depends on a server.                                                                                         |
| **Vessel profile & settings** | Local storage            | Local-first. Sync across devices when connected.                                                                 | Fully offline.                                                                                                                                                   |
| **Tide predictions**          | Pre-computed local cache | Download predictions for selected stations (e.g., 7-30 days ahead). Refresh when connected.                      | Works with cached predictions. Show "last updated" timestamp. Tide predictions are deterministic — can be computed from harmonic constituents offline if needed. |
| **Weather**                   | Cached forecasts         | Fetch latest forecast when connected. Cache most recent.                                                         | Show last-fetched forecast with age indicator ("3 hours old"). Weather is inherently perishable — stale data is clearly marked but still useful.                 |
| **AIS (internet)**            | In-memory only           | Real-time stream when connected                                                                                  | Not available offline. AIS via Signal K (local Wi-Fi) works independently of internet.                                                                           |
| **GPS position**              | Device sensor            | N/A                                                                                                              | Always works — GPS is satellite-based, no internet needed.                                                                                                       |
| **Signal K instruments**      | In-memory (live data)    | N/A — local Wi-Fi connection to boat's network                                                                   | Works on boat's local network. Independent of internet.                                                                                                          |

### Connectivity States

The app should clearly communicate its connectivity state without being annoying about it:

- **Online** — All data fresh. Background sync happening. No indicator needed.
- **Offline with fresh data** — Everything works. Subtle indicator showing offline status. No interruption to workflow.
- **Offline with stale data** — Everything works but some data is old. Show age on stale items (e.g., "Weather: 6h ago"). User decides if it's still useful.
- **Offline with missing data** — Charts not downloaded for this area, no tide data cached. Clear messaging about what's missing and how to get it ("Download charts for this region").

## Internationalization

i18n support should be built into the app from day one. Retrofitting localization is significantly harder than starting with it, and marine navigation is inherently global.

### Approach

- **Framework from v0.1, translations when contributed.** Ship v0.1 with English only, but every user-facing string goes through a localization system. When a community member contributes a translation, it plugs in without code changes.
- **Use `expo-localization` + `i18next`** (or similar). `expo-localization` provides the device locale; `i18next` with `react-i18next` is the most mature i18n library for React with pluralization, interpolation, and namespace support. Translation files live as JSON in the repo.

### Units

Units should be configurable with sensible regional defaults. Marine navigation has strong conventions, but depth units are a real split.

| Measurement     | Options                           | Default                                               |
| --------------- | --------------------------------- | ----------------------------------------------------- |
| **Speed**       | Knots, km/h, mph                  | Knots (universal marine convention)                   |
| **Distance**    | Nautical miles, km, statute miles | Nautical miles                                        |
| **Depth**       | Feet, meters, fathoms             | Feet (US locale), meters (everywhere else)            |
| **Wind speed**  | Knots, m/s, km/h, Beaufort        | Knots                                                 |
| **Temperature** | F, C                              | F (US locale), C (everywhere else)                    |
| **Pressure**    | hPa/mbar, inHg                    | inHg (US locale), hPa (everywhere else)               |
| **Coordinates** | DD, DM, DMS                       | DM (degrees decimal minutes — standard marine format) |

Locale-based defaults can be overridden in settings. All unit conversions happen at the display layer — internal data is stored in SI/nautical units.
