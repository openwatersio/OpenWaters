# Routes

Create multi-leg routes by placing waypoints on the chart, then navigate along a route with bearing, distance, ETA, and automatic waypoint advancement.

## Features

- **Create a route** — Start a new route from the toolbar or route list. Long-press the chart to add waypoints. Drag waypoints to reposition.
- **View and edit** — Opening a route puts it in edit mode. There is no separate read-only view; viewing is editing. Reorder, add, or remove waypoints from the waypoint list.
- **Navigate a route** — Start navigation from the route editor. The app shows bearing, distance, and ETA to the active waypoint with Previous / Next / Stop controls.
- **Automatic waypoint advancement** — The app detects arrival at each waypoint using a combination of arrival circle, angle bisector, and perpendicular crossing, with a configurable arrival radius.
- **Sailing mode** — Restricts waypoint advancement to the arrival circle only, useful when tacking upwind and unable to lay the mark directly.
- **Smart start** — When resuming navigation mid-route, the app snaps to the nearest leg so you pick up where you left off.
- **Manage routes** — Browse all saved routes sorted by recent, name, or distance. Rename, export as GPX, or delete from the list.
- **GPX export** — Share any route as a standard GPX 1.1 `<rte>` element.

## Creating a route

There are several ways to start a new route:

- From the **route list**, tap the new route button
- From a **location sheet**, tap the route button to start a route to that position
- From the **toolbar** while viewing a chart location

Long-press on the chart to add waypoints. The current vessel position can be used as the starting point.

## Route navigation

Start navigation from the route editor. The navigation screen shows:

- Bearing and distance to the active waypoint
- ETA computed from leg-aligned VMG (velocity made good projected onto the leg axis, not the instantaneous bearing to the waypoint — this produces a much more stable number on a layline)
- Previous / Next / Stop controls
- The active route on the chart with completed segments dimmed, the active leg highlighted, and remaining segments dashed

Navigation state (route ID, active waypoint index) persists across app restarts so an in-progress voyage survives a relaunch.

## Waypoint arrival detection

Arrival detection uses:

1. **Arrival circle** — Distance to waypoint is less than the effective radius (capped at 10% of leg length to prevent instant-firing on short legs). Configurable in Settings: 25 / 50 / 100 / 200 m, default 50 m.
2. **Bisector crossing** — At interior waypoints, crossing the angle bisector of the incoming and outgoing legs, gated by a cross-track tolerance.
3. **Perpendicular crossing** — On terminal legs, crossing the plane perpendicular to the incoming leg at the waypoint.

Special cases: first leg uses circle only (no previous waypoint). Near-U-turns (>170 degree turn) fall back to circle only.

**Sailing mode** suppresses the bisector and perpendicular triggers entirely, advancing only when the vessel enters the arrival circle. Enable it in Settings under "Advance on arrival circle only". This is useful when tacking upwind — without it, crossing the perpendicular on an unfavored tack would advance the waypoint before you've actually reached the mark.

## Map overlay

The route overlay renders differently based on mode:

- **Editing** — Dashed line with numbered, draggable waypoint annotations. Tap to select, long-press the chart to add.
- **Navigating** — Completed segments dimmed, active leg solid, remaining segments dashed. Waypoints are read-only with the active waypoint highlighted.
