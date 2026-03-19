# Contributing

SeaScape is a modern, open source, mobile-first marine navigation app built with React Native and Expo. See [docs/](docs/README.md) for the full product plan, competitive analysis, and roadmap.

## Getting Started

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

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Framework  | React Native + Expo                   |
| Language   | TypeScript (strict mode)              |
| Navigation | expo-router (file-based routing)      |
| State      | Zustand with AsyncStorage persistence |
| Map Engine | MapLibre React Native v11             |
| Testing    | Jest                                  |
| Linting    | ESLint (expo config)                  |

### Directory Structure

```
app/                 Expo Router screens (file-based routing)
  _layout.tsx        Root layout (Stack navigator)
  index.tsx          Main screen (renders ChartView)
  ViewOptions.tsx    Modal for chart/unit selection
components/          React components
  ui/                Shared, platform-abstracted UI primitives (Button, BottomSheet, OverlayButton)
  ChartView.tsx      Main map view (orchestrates all overlays)
hooks/               Zustand stores and custom hooks
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

#### State Management (Zustand)

All app state uses Zustand stores with a consistent pattern:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type State = {
  someValue: string;
};

type Actions = {
  set: (state: Partial<State>) => void;
};

export const useSomeState = create<State & Actions>()(
  persist(
    (set) => ({
      someValue: "default",
      set: (state) => set(state),
    }),
    {
      name: "some-state", // AsyncStorage key, kebab-case
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

Existing stores:

- `useCameraState` — zoom, bounds, follow-user mode (key: `"camera"`)
- `useViewOptions` — selected map style (key: `"view-options"`)
- `usePreferredUnits` — speed unit preference (key: `"preferred-units"`)
- `useNavigationState` — GPS position, speed, moored/underway state (not persisted)

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

Use `usePreferredUnits` for all unit conversions. Internal data is always in SI/metric units (meters, meters/second); conversion happens at the display layer only via `toSpeed()` and `toDistance()`.

### Naming Conventions

| What           | Convention            | Example                       |
| -------------- | --------------------- | ----------------------------- |
| Components     | PascalCase            | `ChartView.tsx`               |
| Hooks          | camelCase, use-prefix | `useCameraState.tsx`          |
| Zustand stores | use-prefix export     | `export const useCameraState` |
| State types    | `State`               | `type State = { ... }`        |
| Action types   | `Actions`             | `type Actions = { ... }`      |
| Storage keys   | kebab-case string     | `"preferred-units"`           |
| Constants      | SCREAMING_SNAKE_CASE  | `SPEED_THRESHOLD`             |
| Enums          | PascalCase            | `NavigationState.Underway`    |

### TypeScript

- Strict mode is enabled
- Define `State` and `Actions` interfaces for all Zustand stores
- Use `Partial<State>` for setter methods
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

## Safety

This is navigation software. Incorrect calculations or rendering bugs can put people in danger.

- Navigation math (bearing, distance, course) must be tested with known-good reference values
- Unit conversions get tests for every function
- Depth alarms must trigger at correct thresholds across all unit configurations
- Night mode must not leak bright white/blue elements (destroys night vision)
- The app includes a "not for primary navigation" disclaimer
