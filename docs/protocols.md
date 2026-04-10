# Marine Instrument Protocols

Reference for the communication protocols used to connect with onboard marine instruments.

## NMEA 0183

The dominant legacy protocol. ASCII text sentences over serial (RS-422) or WiFi (TCP/UDP).

### Sentence format

```
$TTYYY,field1,field2,...,fieldN*CC<CR><LF>
```

- `TT` = talker ID (`GP` GPS, `SD` depth sounder, `WI` weather, `HC` compass, `AI` AIS)
- `YYY` = sentence type
- `*CC` = XOR checksum (hex)
- Max 82 bytes per sentence

### Key sentences

| Sentence    | Data                   | Example fields                                                  |
| ----------- | ---------------------- | --------------------------------------------------------------- |
| `GGA`       | GPS fix                | time, lat, lon, fix quality, satellites, HDOP, altitude         |
| `RMC`       | Recommended minimum    | time, status, lat, lon, SOG (knots), COG, date, mag variation   |
| `DBT`       | Depth below transducer | depth in feet, meters, fathoms                                  |
| `DPT`       | Depth                  | depth (m), transducer offset, max range                         |
| `MWV`       | Wind speed & angle     | angle, R/T reference, speed, units, status                      |
| `HDG`       | Heading                | magnetic heading, deviation, variation                          |
| `VDM`/`VDO` | AIS data               | fragment count, fragment num, channel, 6-bit payload, fill bits |

### WiFi transport

WiFi multiplexers (Yacht Devices, Digital Yacht, Vesper) bridge serial instruments to the network. They either create their own AP or join the boat's WiFi, then serve NMEA sentences as plain-text lines over:

- **TCP** on port **10110** (IANA-registered) — guaranteed delivery, typically 4-8 concurrent clients
- **UDP** broadcast on port **10110** — fire-and-forget, unlimited clients

Data rate: 4800 baud default (~5-6 sentences/sec). High-speed variant at 38400 baud.

## NMEA 2000

Modern binary protocol on CAN bus at 250 kbit/s. Messages identified by PGN (Parameter Group Number). Mobile devices cannot connect directly — requires a gateway that bridges N2K to WiFi.

### Common gateways

| Product      | Manufacturer  | Notes                                                     |
| ------------ | ------------- | --------------------------------------------------------- |
| YDWG-02      | Yacht Devices | N2K to WiFi, TCP + UDP, bidirectional, ~$200              |
| W2K-1        | Actisense     | N2K to 0183 over WiFi, SD card logging                    |
| iKommunicate | Digital Yacht | N2K + 0183 to Signal K (JSON), acts as Signal K server    |

All gateways convert N2K to NMEA 0183 sentences over TCP/UDP, so the app treats them identically to a direct 0183 WiFi connection.

## Signal K

Open-source, JSON-based marine data standard. A Signal K server (typically Node.js on a Raspberry Pi) ingests NMEA 0183/2000 and exposes data via standard web protocols.

### Why Signal K is ideal for a mobile app

- JSON is native to JavaScript — no binary parsing
- WebSocket streaming works out of the box in React Native
- REST API via standard `fetch()` for one-off queries
- Server handles all NMEA protocol translation
- mDNS/Bonjour discovery (`_signalk-http._tcp`, `_signalk-ws._tcp`)
- All values in SI units (m/s, meters, radians, Kelvin)
- AIS targets included as additional vessel entries

### Connection flow

1. Discover via mDNS or manual IP entry
2. `GET /signalk` — returns endpoint URLs
3. Connect WebSocket to `/signalk/v1/stream?subscribe=self`
4. Receive delta messages with changed values
5. Subscribe to specific paths with configurable update rates

### Key data paths

| Path                                | Unit            | Description             |
| ----------------------------------- | --------------- | ----------------------- |
| `navigation.position`               | decimal degrees | `{latitude, longitude}` |
| `navigation.speedOverGround`        | m/s             | SOG                     |
| `navigation.courseOverGroundTrue`   | rad             | COG                     |
| `navigation.headingTrue`            | rad             | True heading            |
| `environment.depth.belowSurface`    | m               | Depth                   |
| `environment.depth.belowTransducer` | m               | Depth                   |
| `environment.depth.belowKeel`       | m               | Depth under keel        |
| `environment.wind.speedApparent`    | m/s             | AWS                     |
| `environment.wind.angleApparent`    | rad             | AWA (relative to bow)   |
| `environment.wind.speedTrue`        | m/s             | TWS                     |
| `environment.wind.directionTrue`    | rad             | TWD                     |
| `environment.water.temperature`     | K               | Water temp              |

AIS targets appear under `vessels.<mmsi>` with the same path structure.

### Delta message format

```json
{
  "context": "vessels.self",
  "updates": [
    {
      "timestamp": "2026-03-19T10:30:00.000Z",
      "values": [
        {
          "path": "navigation.position",
          "value": { "latitude": 47.6, "longitude": -122.3 }
        },
        { "path": "environment.depth.belowTransducer", "value": 8.7 }
      ]
    }
  ]
}
```

### Signal K v2 server APIs

The Signal K v2 specification includes higher-level REST APIs beyond raw instrument data:

| API           | Endpoint                          | Purpose                                              |
| ------------- | --------------------------------- | ---------------------------------------------------- |
| Resources     | `/signalk/v2/api/resources/`      | CRUD for waypoints, routes, notes, regions, charts   |
| Course        | `.../navigation/course`           | Active navigation — set destination, follow route    |
| History       | `/signalk/v2/api/history/`        | Time-series queries for tracks, depth, conditions    |
| Autopilot     | `.../autopilots/`                 | Unified autopilot control (engage, heading, tack)    |
| Notifications | `/signalk/v2/api/notifications/`  | Instrument alerts — depth alarm, anchor drag, AIS    |
| Radar         | `.../radars/`                     | Radar control and spoke data streaming               |

## AIS (Automatic Identification System)

AIS data arrives via NMEA `!AIVDM` sentences containing 6-bit armored ASCII payloads that must be decoded.

### Key message types

| Type | Class            | Data                                                              |
| ---- | ---------------- | ----------------------------------------------------------------- |
| 1-3  | Class A position | MMSI, nav status, ROT, SOG, position, COG, heading                |
| 5    | Class A static   | IMO, call sign, name, type, dimensions, draught, destination, ETA |
| 18   | Class B position | SOG, position, COG, heading                                       |
| 19   | Class B extended | Adds name, type, dimensions                                       |
| 21   | AtoN             | Aid-to-navigation position, type, status                          |
| 24   | Class B static   | Name (Part A), type/dimensions/call sign (Part B)                 |

### AIS hardware for small boats

Vesper XB-8000, Digital Yacht AIT5000, Quark-elec QK-A026. All broadcast NMEA over WiFi (UDP/TCP). Some devices like Digital Yacht NavLink Blue use BLE.

## Online services

| Service               | Data                                          | Cost                               | Notes                                                |
| --------------------- | --------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| **AISStream.io**      | Real-time AIS via WebSocket                   | Free                               | Subscribe by bounding box, all message types as JSON |
| **NOAA CO-OPS**       | Tides, currents, water level, weather         | Free                               | No API key needed. U.S. coastal stations.            |
| **Open-Meteo Marine** | Wave height/period/direction, swell, currents | Free (non-commercial)              | No API key. 7-day forecast, hourly.                  |
| **StormGlass.io**     | Comprehensive marine weather                  | Free 10 req/day; paid commercial   | Aggregates multiple weather models                   |
| **GEBCO**             | Global bathymetry (15 arc-sec grid)           | Free                               | WMS tiles for map overlay. NetCDF/GeoTIFF download.  |
