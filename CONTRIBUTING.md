# Contributing

Open Waters is a modern, open source, mobile-first marine navigation app built with React Native and Expo. See [docs/](docs/README.md) for feature documentation, specs, and the project vision.

## Project Status

Open Waters is in **early alpha** with limited users. There are no external consumers of internal APIs, no install base to migrate, and no release compatibility commitments.

**Prefer breaking changes over backward compatibility.** When refactoring or redesigning:

- Rename, move, or delete APIs freely — don't preserve old names as aliases
- Don't add deprecation shims, compatibility layers, or migration paths for internal code
- Don't keep feature flags, fallbacks, or "legacy" branches around after a change lands
- Change database schemas with a straightforward migration — don't preserve old columns or dual-write
- Update all call sites in the same change; don't leave TODOs to clean up later

A clean codebase beats a compatible one. Revisit this guidance when we have real users.

## Getting Started

This project is built with [Expo](https://expo.dev/), a framework and platform for universal React applications. To learn more, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

### Prerequisites

- Node.js 20+
- Xcode 16+

### Setup

```sh
npm install
npx expo prebuild          # generate native projects
npx expo run:ios
```

### Development Commands

```sh
npm start                  # start Expo dev server
npm run ios                # build and run on iOS
npm test                   # run tests
npm run lint               # run eslint
```

## Architecture

### Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Framework  | React Native + Expo                  |
| Language   | TypeScript (strict mode)             |
| Navigation | expo-router (file-based routing)     |
| State      | Valtio with AsyncStorage persistence |
| Map Engine | MapLibre React Native v11            |
| Testing    | Jest                                 |
| Linting    | ESLint (expo config)                 |

### Directory Structure

```
app/                 Expo Router screens (file-based routing)
  _layout.tsx        Root layout (Stack navigator)
  index.tsx          Main screen (renders ChartView)
  ViewOptions.tsx    Modal for chart/unit selection
components/          React components
  ui/                Shared, platform-abstracted UI primitives (Button, BottomSheet, OverlayButton)
  ChartView.tsx      Main map view (orchestrates all overlays)
hooks/               Valtio stores and custom hooks
styles/              Map style configs (JSON) and style index
lib/                 Utility libraries (WMS/WMTS format helpers)
assets/              Images and fonts
```

### Key Patterns

#### Import Aliases

Use `@/` for all imports. Never use relative paths like `../../hooks/`.

```typescript
import { useCameraState } from "@/hooks/useCameraState";
import mapStyles from "@/styles";
```

#### State Management (Valtio)

Stores are **Valtio proxies** holding state only. Actions are **plain exported functions** that mutate the proxy directly. This keeps actions callable from anywhere (components, effects, callbacks, background tasks) without needing a hook at the call site.

Each store file exports:

- `xyzState` — the live proxy (use from imperative code, background tasks, mutators)
- `useXyz()` — a tracked snapshot hook (use from React render)

```typescript
import { proxy, useSnapshot } from "valtio";

type State = {
  items: Item[];
};

export const itemsState = proxy<State>({ items: [] });

export function useItems() {
  return useSnapshot(itemsState);
}

// Actions: mutate the proxy directly
export async function loadItems() {
  itemsState.items = await fetchItems();
}

export async function addItem(fields: ItemFields) {
  const item = await insertItem(fields);
  itemsState.items.unshift(item);
  return item;
}
```

Components destructure the snapshot. `useSnapshot` tracks each property access, so components only re-render when the fields they actually read change:

```typescript
import { useItems, loadItems, addItem } from "@/hooks/useItems";

function MyComponent() {
  const { items } = useItems();
  useEffect(() => { loadItems(); }, []);
  return <Button onPress={() => addItem({ name: "New" })} />;
}
```

**Computed values** are getters on the proxy. They're tracked through their inputs:

```typescript
export const trackRecordingState = proxy({
  track: null as Track | null,
  distance: 0,
  get isRecording(): boolean {
    return this.track !== null;
  },
  get averageSpeed(): number {
    return this.distance > 0 ? this.distance / elapsed : 0;
  },
});
```

**Persistence** uses `persistProxy` from `@/persistProxy`, which writes the snapshot to AsyncStorage on every change and hydrates on first call. Getter-only properties are skipped automatically.

```typescript
import { persistProxy } from "@/persistProxy";
import { proxy, useSnapshot } from "valtio";

export const someState = proxy<State>({ someValue: "default" });

persistProxy(someState, { name: "some-state" });

export function useSome() {
  return useSnapshot(someState);
}

export function setSomeValue(value: string) {
  someState.someValue = value;
}
```

For partial persistence (only some fields) or hydration side effects, pass `partialize` and/or `hydrate`:

```typescript
persistProxy(activeRouteState, {
  name: "active-route",
  partialize: (s) => (s.route?.id != null ? { id: s.route.id } : null),
  hydrate: (state, persisted) => {
    if (persisted?.id != null) loadRoute(persisted.id);
  },
});
```

**Subscriptions** outside React (background tasks, effects that shouldn't re-render):

```typescript
import { subscribe } from "valtio";
import { subscribeKey } from "valtio/utils";

// Whole-tree subscription
const unsub = subscribe(navigationState, () => { ... });

// Single field
const unsub = subscribeKey(cameraState, "trackingMode", (next) => { ... });
```

**Database-backed lists** use `useDbQuery` from `@/hooks/useDbQuery` instead of a store — the DB is the source of truth, mutations write directly via the DB layer, and `useDbQuery` re-fetches on table changes. See `useTracks` and `useMarkers` for examples.

**Watch-outs:**

- Snapshots are deeply readonly. Calling `.sort()` or passing to APIs typed as mutable arrays needs a copy or `Readonly<T>` widening at the consumer.
- `Object.keys/values/entries` on a `useSnapshot` result can throw on Hermes with Valtio 2.x. We carry [patches/valtio+2.3.1.patch](patches/valtio+2.3.1.patch) via `patch-package` to remove Valtio's `Object.preventExtensions(snap)` call until the upstream fix lands.
- Don't pass the live proxy to native components — MapLibre's `initialViewState` (and similar) freeze the input, which freezes the proxy itself. Spread to a plain object: `{ ...proxyState }`.
- Mutating after `await` is a race if the same code path can run concurrently. Capture state locally before the await, or serialize the work.
- The proxy itself can't be reassigned. Mutate in place; expose a clear/reset action for tests.

Existing stores:

- `cameraState` / `useCameraState` — follow-user mode, tracking mode (key: `"camera"`)
- `cameraPositionState` / `useCameraPosition` — last viewport center/zoom (key: `"camera-position"`)
- `cameraViewState` / `useCameraView` — current bearing, bounds, zoom (not persisted)
- `themePreferenceState` / `useThemePreference` — chart theme preference (key: `"chart-theme"`)
- `preferredUnitsState` / `usePreferredUnits` — speed/distance/depth/temperature unit preferences (key: `"preferred-units"`)
- `navigationState` / `useNavigation` — unified vessel position/speed/heading from device GPS or Signal K (not persisted)
- `trackRecordingState` / `useTrackRecording` — active recording state, computed `isRecording`, `averageSpeed` (key: `"track-recording"`)
- `useTracks({ order, position })` / `useTrack(id)` / `useTrackPoints(id)` — DB-backed reactive queries
- `useMarkers({ order, position })` / `useMarker(id)` — DB-backed reactive queries
- `activeRouteState` / `useActiveRoute` — active route in viewing/editing/navigating modes (key: `"active-route"`)
- `useRoutes({ order })` / `useRoute(id)` — DB-backed reactive queries
- `chartStoreState` / `useChartStore` — installed charts index, selected chart (key: `"chart-store"`)
- `offlinePacksState` / `useOfflinePacks` — tile pack download state (not persisted)
- `downloadsState` / `useDownloads` — MBTiles download progress (not persisted)
- `offlineSettingsState` / `useOfflineSettings` — cache size and tile-count limits (key: `"offline-settings"`)
- `connectionsState` / `useConnections` — Signal K / NMEA TCP connections (key: `"connections"`)
- `aisState` / `useAIS` — AIS vessel data, keyed by MMSI (not persisted)
- `atonState` / `useAtoN` — Aids-to-Navigation data, keyed by ID (not persisted)
- `sheetState` / `useSheets` — sheet height tracking for overlay positioning (not persisted)
- `downloadOverlayState` / `useDownloadOverlay` — visibility flag for download region overlay (not persisted)

#### Components

- **PascalCase** filenames for components
- **camelCase** with `use` prefix for hooks
- Extract small reusable components where possible. Example: `OverlayButton` in `components/ui/` for consistent styling of all map overlay buttons
- Prefer small, focused components. If a component grows beyond 100 lines, consider breaking it up.
- Map overlays use `SafeAreaView` with absolute positioning at screen corners
- The chart is always full-screen; all UI is overlay
- Platform-dependent components should be generic and live in `components/ui/` (e.g. `BottomSheet`, `Button`), then used by cross-platform components (e.g. `TrackSheet`) that contain the actual content and logic. This keeps platform-specific code isolated and reusable and limits duplication in app-specific features.

#### Native UI (`@expo/ui`)

The app uses `@expo/ui` for platform-native components (SwiftUI on iOS)..

**Three-tier component strategy:**

1. **Native-first** — Use `@expo/ui` components for standard UI (buttons, forms, pickers, sheets). These automatically look and feel native on each platform.
2. **Bridge with `RNHostView`** — When React Native views (e.g. `Pressable`, custom layouts) must live inside a native container (e.g. a bottom sheet), wrap them in `RNHostView` from `@expo/ui`. Without this bridge, RN touch handlers won't receive events inside native containers.
3. **Pure RN** — For views that exist only in the RN tree (map overlays, HUD), use standard React Native components.

For examples of how to use `@expo/ui`, see:

- [expo-ui-playground](https://github.com/betomoedano/expo-ui-playground/)
- [native-component-list](https://github.com/expo/expo/tree/main/apps/native-component-list/src/screens/UI)

#### Map Styles

Map sources are defined in `styles/index.ts` as an array of `{ id, name, style }` objects. Styles can be either a URL string or an inline MapLibre style JSON object.

```typescript
export default [
  { id: "noaa", name: "NOAA (RNC)", style: noaaJson },
  { id: "openseamap", name: "OpenSeaMap", style: openseamapJson },
  // ...
];
```

#### Icons

Use `SymbolView` from `expo-symbols` directly with SF Symbol names (e.g. `"location.fill"`, `"plus"`, `"record.circle"`). Browse available symbols in Apple's [SF Symbols](https://developer.apple.com/sf-symbols/) app.

#### Unit Conversions

Use `toSpeed()` and `toDistance()` from `@/hooks/usePreferredUnits` for all unit conversions. Internal data is always in SI/metric units (meters, meters/second); conversion happens at the display layer only.

### Naming Conventions

| What           | Convention            | Example                         |
| -------------- | --------------------- | ------------------------------- |
| Components     | PascalCase            | `ChartView.tsx`                 |
| Hooks          | camelCase, use-prefix | `useCameraState.tsx`            |
| Valtio proxies | `xyzState` + `useXyz` | `cameraState`, `useCameraState` |
| Store actions  | plain named exports   | `export function loadItems()`   |
| State types    | `State`               | `type State = { ... }`          |
| Storage keys   | kebab-case string     | `"preferred-units"`             |
| Constants      | SCREAMING_SNAKE_CASE  | `SPEED_THRESHOLD`               |
| Enums          | PascalCase            | `NavigationState.Underway`      |

### TypeScript

- Strict mode is enabled
- Define `State` interface for Valtio stores (actions are standalone functions, not typed on the store)
- Use type guards (`'href' in props`) for polymorphic components
- Use `fontVariant: ['tabular-nums']` for any dynamically changing numeric display
- Avoid `as` casts where possible; prefer proper type definitions
- Avoid `any` type; if necessary, isolate it to a single utility function

## Testing

Navigation software has safety implications — a wrong calculation or rendering bug can put people in danger. The testing approach prioritizes correctness of critical logic and the ability to reproduce real-world scenarios without requiring a boat.

- **What to test:** Navigation math, unit conversions, API response parsing, state management logic
- **What not to test:** Map rendering (native OpenGL), GPS accuracy, full E2E flows
- **Fixtures:** Use saved API responses as JSON fixtures for deterministic tests

Run tests:

```sh
npm test
```

## Design Principles

1. **The chart is the app.** Full-screen map. Everything else is an overlay or sheet.
2. **Progressive disclosure.** Simple by default, detailed on demand.
3. **Readable at arm's length.** Minimum 15pt text. Bold for critical values. High contrast.
4. **Respect the platform.** Native components for standard UI (`@expo/ui`). Custom only for chart overlays.
5. **Offline-first.** Every feature works without connectivity. Online is an enhancement.

## Contributor License Agreement

All contributors must sign the [Contributor License Agreement](CLA.md) before their pull request can be merged. The CLA grants Open Water Software, LLC the rights needed to distribute your contributions (including through the iOS App Store) while you retain full copyright ownership of your work.

You will be prompted to sign the CLA automatically when you open your first pull request.

## Safety

This is navigation software. Incorrect calculations or rendering bugs can put people in danger.

- Navigation math (bearing, distance, course) must be tested with known-good reference values
- Unit conversions get tests for every function
- Depth alarms must trigger at correct thresholds across all unit configurations
- Night mode must not leak bright white/blue elements (destroys night vision)
- The app includes a "not for primary navigation" disclaimer
