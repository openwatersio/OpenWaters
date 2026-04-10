# Instruments

Connect to onboard marine instruments to display depth, wind, heading, AIS targets, and other sensor data on the chart.

## Features

- **NMEA 0183 over TCP** — Connect directly to WiFi multiplexers (Yacht Devices, Digital Yacht, Vesper) that broadcast NMEA sentences on the local network. Automatic discovery via mDNS, or manual host and port entry.
- **Signal K integration** — Connect to a [Signal K server](https://signalk.org) over WebSocket for real-time instrument data. Automatic endpoint discovery via mDNS/Bonjour, or manual URL entry.
- **AIS targets on map** — Nearby vessels render on the chart with heading indicators. Tap for vessel details (name, type, speed, course, destination). Data from onboard AIS receivers or online services (AISStream.io).
- **Multiple connections** — Connect to several instruments simultaneously (e.g. a Signal K server and a separate NMEA WiFi gateway). Data from all sources merges into the same store.
- **Background operation** — Instrument connections stay alive when the app is backgrounded during track recording (piggybacking on the background location session).
- **Automatic reconnection** — Lost connections retry with exponential backoff.

## Connections

The connections screen (accessible from Settings) shows:

- **Discovered services** — Instruments found via mDNS on the local network, with type badges (Signal K or NMEA).
- **Manual add** — Enter a Signal K server URL or NMEA host and port directly.
- **Connection status** — Each connection shows its current state (disconnected, connecting, connected) and recent data.

## Data model

Instrument data uses a flat key-value store with [Signal K-compatible paths](https://signalk.org/specification/) as keys. All values are in SI units (meters, m/s, radians, Kelvin, decimal degrees). This means:

- Signal K data flows in without path translation
- NMEA data gets mapped to the same paths during parsing
- Components don't care which protocol the data came from
- Switching from a direct NMEA connection to a Signal K server requires no UI changes

AIS targets are stored separately, keyed by MMSI, with the same path-value structure per vessel. Stale vessels are pruned after a configurable timeout.

## Supported data

| Data                | Signal K path                       | NMEA source |
| ------------------- | ----------------------------------- | ----------- |
| Position            | `navigation.position`               | RMC, GGA    |
| Speed over ground   | `navigation.speedOverGround`        | RMC         |
| Course over ground  | `navigation.courseOverGroundTrue`   | RMC         |
| Heading (magnetic)  | `navigation.headingMagnetic`        | HDG         |
| Heading (true)      | `navigation.headingTrue`            | HDG         |
| Depth (transducer)  | `environment.depth.belowTransducer` | DBT, DPT    |
| Depth (below keel)  | `environment.depth.belowKeel`       | DPT         |
| Apparent wind speed | `environment.wind.speedApparent`    | MWV         |
| Apparent wind angle | `environment.wind.angleApparent`    | MWV         |
| Water temperature   | `environment.water.temperature`     | MTW         |
| Speed through water | `navigation.speedThroughWater`      | VHW         |

See [protocols.md](protocols.md) for details on NMEA 0183, NMEA 2000, Signal K, and AIS.
