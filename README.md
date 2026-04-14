# Open Waters App

An experiment in building modern marine charts. Currently alpha and not to be use for navigation.

## Features

- [**Tracks**](docs/tracks.md) — Record the vessel's path in the background with smart sampling, display tracks on the chart, and export as GPX.
- [**Markers**](docs/markers.md) — Drop pins on the chart, name and color-code them, and navigate with live bearing and distance.
- [**Routes**](docs/routes.md) — Create multi-leg routes with drag-and-drop waypoints, then navigate with automatic waypoint advancement and ETA.
- [**Charts**](docs/charts/) — Browse and install nautical charts from a curated catalog, add custom tile sources, or import MBTiles for offline use.
- [**Instruments**](docs/instruments.md) — Connect to onboard instruments via Signal K or NMEA 0183 over WiFi to display depth, wind, heading, and AIS targets.

See the [roadmap](docs/roadmap.md) for what's planned and the [vision](docs/vision/) for the long-term direction.

## Contributing

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

Read the [contributing documentation](CONTRIBUTING.md) for guidelines on how to contribute to the project.

## License

Open Waters is licensed under the [GNU General Public License v3.0](LICENSE).

All contributors must accept a [Contributor License Agreement](CLA.md), which grants Open Water Software, LLC the rights needed to distribute the app through the iOS App Store. Contributors retain full copyright ownership of their work.
