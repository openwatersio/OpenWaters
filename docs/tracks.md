# Tracks

Record the vessel's path as a series of GPS points, display tracks on the chart, and export as GPX.

## Features

- **Record** — Tap the record button to start tracking. GPS recording continues in the background with the screen off, showing a blue status bar indicator on iOS.
- **Live display** — The active track draws on the chart in real time with a smooth animated tail that follows the vessel.
- **Manage tracks** — From the main menu (or a long-press the record button) view the track list sorted by name, distance, or proximity. Rename, export, or delete tracks from there.
- **GPX export** — Share any track as a standard GPX 1.1 file, compatible with other marine navigation apps.
- **Auto-discard** — Tracks shorter than 1 minute or 200 meters are silently discarded on stop to avoid clutter.

## Recording behavior

Recording uses a smart sampling strategy to balance detail with storage. After a minimum 2-second interval, a point is recorded when any of these conditions are met:

- Distance from last point exceeds 10 m
- Heading changes more than 5 degrees
- 30 seconds have elapsed (breadcrumbs while drifting)

## Track display

The track overlay uses two rendering layers:

- **Historical track** — Smoothed with Catmull-Rom splines for a clean appearance
- **Animated tail** — A 1-second linear easing segment that stays in sync with the vessel position indicator

Tracks are rendered as a red line (3px, 80% opacity) with round caps and joins.

## UI

- **Idle** — Red circle icon in the bottom-left corner of the chart. Tap to start recording, long-press to open the track list.
- **Recording** — Elapsed time and distance badge with a red stop button.

## Data storage

Tracks are stored in SQLite with two tables: `tracks` (metadata, distance, color) and `track_points` (latitude, longitude, speed, heading, accuracy, timestamp). This provides crash resilience and fast querying compared to file-based storage.
