import type { DataPoint } from "@/instruments/hooks/useInstruments";

/**
 * AIS Stream WebSocket message envelope. See
 * https://aisstream.io/documentation for the full taxonomy.
 *
 * Only the fields we actually consume are typed — unrecognized fields are
 * passed through silently.
 */
export type AISStreamMessage = {
  MessageType: string;
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    /** "2022-12-29 18:22:32.318353 +0000 UTC" or RFC 3339 */
    time_utc?: string;
  };
  Message?: Record<string, unknown>;
};

/** Source tag attached to every DataPoint we derive from AIS Stream. */
export const AISSTREAM_SOURCE = "aisstream";

/** Sentinel from the AIS spec: 511° means "heading not available". */
const HEADING_NOT_AVAILABLE = 511;

/** Knots → m/s. */
const KNOTS_TO_MPS = 0.514444;

/** Degrees → radians. */
const DEG_TO_RAD = Math.PI / 180;

/** AIS Stream `time_utc` parser with a `Date.now()` fallback. */
function parseTimestamp(raw: string | undefined): number {
  if (!raw) return Date.now();
  // Strip the trailing "UTC" — JS Date can't parse that suffix but the
  // "+0000" before it is unambiguous on its own.
  const cleaned = raw.replace(/\s*UTC\s*$/, "").trim();
  const t = Date.parse(cleaned);
  return Number.isNaN(t) ? Date.now() : t;
}

/** Trim trailing AIS `@` padding and whitespace from a 6-bit packed string. */
function trimAis(s: string | undefined): string | undefined {
  if (s == null) return undefined;
  const trimmed = s.replace(/@+$/, "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

type RawPosition = {
  Latitude?: number;
  Longitude?: number;
  Cog?: number;
  Sog?: number;
  TrueHeading?: number;
  NavigationalStatus?: number;
  /** AIS sentinel `-128` = "no info"; otherwise deg/min (sign = direction). */
  RateOfTurn?: number;
};

type RawEta = {
  Day?: number;
  Hour?: number;
  Minute?: number;
  Month?: number;
};

type RawStaticData = {
  Type?: number;
  CallSign?: string;
  Destination?: string;
  ImoNumber?: number;
  MaximumStaticDraught?: number;
  Dimension?: { A?: number; B?: number; C?: number; D?: number };
  Eta?: RawEta;
  /** Some payloads (Type 24B) call it ShipType instead of Type. */
  ShipType?: number;
};

type RawStaticDataReport = {
  /**
   * AIS Stream encodes the part-number bit as a boolean: `false` = Part A,
   * `true` = Part B. (See aisstream/ais-message-models type-definition.yaml.)
   */
  PartNumber?: boolean;
  ReportA?: { Name?: string };
  ReportB?: RawStaticData;
};

type RawAidsToNavigationReport = {
  Type?: number;
  Name?: string;
  NameExtension?: string;
  Longitude?: number;
  Latitude?: number;
  OffPosition?: boolean;
  VirtualAtoN?: boolean;
  Dimension?: { A?: number; B?: number; C?: number; D?: number };
};

/** AIS RateOfTurn sentinel — "not available". */
const ROT_NOT_AVAILABLE = -128;

/** AIS ETA: format MM-DDTHH:MM (no year — AIS doesn't broadcast one). */
function formatEta(eta: RawEta): string | undefined {
  const { Month, Day, Hour, Minute } = eta;
  // AIS uses 0 for "not available" in each field.
  if (!Month || !Day) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Month)}-${pad(Day)}T${pad(Hour ?? 0)}:${pad(Minute ?? 0)}`;
}

/**
 * Result of decoding one AIS Stream message. Discriminated on `kind` so the
 * client can route vessel paths to {@link updateAISVessel} and AtoN paths to
 * {@link updateAtoN}.
 */
export type AISStreamDecodeResult =
  | { kind: "vessel"; mmsi: string; paths: Record<string, DataPoint> }
  | { kind: "aton"; id: string; paths: Record<string, DataPoint> }
  | null;

function dp(value: DataPoint["value"], timestamp: number): DataPoint {
  return { value, timestamp, source: AISSTREAM_SOURCE };
}

function decodePositionPaths(
  pos: RawPosition,
  timestamp: number,
): Record<string, DataPoint> {
  const paths: Record<string, DataPoint> = {};
  if (typeof pos.Latitude === "number" && typeof pos.Longitude === "number") {
    paths["navigation.position"] = dp(
      { latitude: pos.Latitude, longitude: pos.Longitude },
      timestamp,
    );
  }
  if (typeof pos.Cog === "number") {
    paths["navigation.courseOverGroundTrue"] = dp(pos.Cog * DEG_TO_RAD, timestamp);
  }
  if (typeof pos.Sog === "number") {
    paths["navigation.speedOverGround"] = dp(pos.Sog * KNOTS_TO_MPS, timestamp);
  }
  if (
    typeof pos.TrueHeading === "number" &&
    pos.TrueHeading !== HEADING_NOT_AVAILABLE
  ) {
    paths["navigation.headingTrue"] = dp(pos.TrueHeading * DEG_TO_RAD, timestamp);
  }
  if (typeof pos.NavigationalStatus === "number") {
    paths["navigation.state"] = dp(pos.NavigationalStatus, timestamp);
  }
  if (
    typeof pos.RateOfTurn === "number" &&
    pos.RateOfTurn !== ROT_NOT_AVAILABLE
  ) {
    // AIS RateOfTurn is deg/min; Signal K convention is rad/s. Convert.
    const rotRadPerSec = (pos.RateOfTurn * DEG_TO_RAD) / 60;
    paths["navigation.rateOfTurn"] = dp(rotRadPerSec, timestamp);
  }
  return paths;
}

function decodeStaticDataPaths(
  data: RawStaticData,
  timestamp: number,
): Record<string, DataPoint> {
  const paths: Record<string, DataPoint> = {};
  if (typeof data.Type === "number") {
    paths["design.aisShipType"] = dp(data.Type, timestamp);
  }
  const callSign = trimAis(data.CallSign);
  if (callSign) {
    paths["communication.callsignVhf"] = dp(callSign, timestamp);
  }
  const destination = trimAis(data.Destination);
  if (destination) {
    paths["navigation.destination"] = dp(destination, timestamp);
  }
  if (typeof data.ImoNumber === "number" && data.ImoNumber > 0) {
    paths["registrations.imo"] = dp(String(data.ImoNumber), timestamp);
  }
  if (typeof data.MaximumStaticDraught === "number" && data.MaximumStaticDraught > 0) {
    paths["design.draft"] = dp(data.MaximumStaticDraught, timestamp);
  }
  const dim = data.Dimension;
  if (dim) {
    const a = typeof dim.A === "number" ? dim.A : 0;
    const b = typeof dim.B === "number" ? dim.B : 0;
    const c = typeof dim.C === "number" ? dim.C : 0;
    const d = typeof dim.D === "number" ? dim.D : 0;
    const length = a + b;
    const beam = c + d;
    if (length > 0) paths["design.length"] = dp(length, timestamp);
    if (beam > 0) paths["design.beam"] = dp(beam, timestamp);
  }
  if (data.Eta) {
    const eta = formatEta(data.Eta);
    if (eta) paths["navigation.eta"] = dp(eta, timestamp);
  }
  // Some payloads use ShipType in place of Type.
  if (typeof data.ShipType === "number" && !paths["design.aisShipType"]) {
    paths["design.aisShipType"] = dp(data.ShipType, timestamp);
  }
  return paths;
}

/**
 * Type 24 — Class B static data, delivered as two halves (PartNumber 0 / 1).
 * Part A is just the vessel name; Part B carries call sign, ship type, and
 * dimensions. Each part arrives in its own AIS Stream message.
 */
function decodeStaticDataReport(
  report: RawStaticDataReport,
  timestamp: number,
): Record<string, DataPoint> {
  const paths: Record<string, DataPoint> = {};
  // `PartNumber` is a boolean: false = Part A (name only), true = Part B
  // (identity + dimensions). The two parts arrive in separate messages.
  if (report.PartNumber === false && report.ReportA) {
    const name = trimAis(report.ReportA.Name);
    if (name) paths["name"] = dp(name, timestamp);
  } else if (report.PartNumber === true && report.ReportB) {
    Object.assign(paths, decodeStaticDataPaths(report.ReportB, timestamp));
  }
  return paths;
}

/** Type 21 — Aid to Navigation report. Routed to the AtoN store, not vessels. */
function decodeAtoNPaths(
  report: RawAidsToNavigationReport,
  timestamp: number,
): Record<string, DataPoint> {
  const paths: Record<string, DataPoint> = {};
  if (
    typeof report.Latitude === "number" &&
    typeof report.Longitude === "number"
  ) {
    paths["navigation.position"] = dp(
      { latitude: report.Latitude, longitude: report.Longitude },
      timestamp,
    );
  }
  if (typeof report.Type === "number") {
    paths["atonType"] = dp(report.Type, timestamp);
  }
  // AIS Type 21 names are 14 chars + an optional NameExtension. Concatenate
  // both before trimming so the trailing-`@` pad on the base name doesn't
  // chop the extension off.
  const rawName = `${report.Name ?? ""}${report.NameExtension ?? ""}`;
  const name = trimAis(rawName);
  if (name) paths["name"] = dp(name, timestamp);
  // DataPoint.value doesn't include boolean today; encode as 1/0 — the AtoN
  // detail sheet's `getBoolean()` already accepts that shape alongside true/false.
  if (typeof report.OffPosition === "boolean") {
    paths["offPosition"] = dp(report.OffPosition ? 1 : 0, timestamp);
  }
  if (typeof report.VirtualAtoN === "boolean") {
    paths["virtual"] = dp(report.VirtualAtoN ? 1 : 0, timestamp);
  }
  return paths;
}

/** Decode a single AIS Stream message into a per-path DataPoint map. */
export function decodeAISStreamMessage(
  msg: AISStreamMessage,
): AISStreamDecodeResult {
  const meta = msg.MetaData;
  if (!meta || typeof meta.MMSI !== "number") return null;
  const mmsi = String(meta.MMSI);
  const timestamp = parseTimestamp(meta.time_utc);

  const inner = msg.Message ?? {};
  const atonReport = inner["AidsToNavigationReport"] as
    | RawAidsToNavigationReport
    | undefined;

  // AtoN reports are routed to the AtoN store, not the vessel store.
  if (atonReport) {
    const atonPaths = decodeAtoNPaths(atonReport, timestamp);
    // Position fallback from MetaData (same logic as vessels below). Done
    // before adding the synthetic `mmsi` path so the emptiness check below
    // reflects whether the message actually carried any decodable AtoN data.
    if (
      !atonPaths["navigation.position"] &&
      typeof meta.latitude === "number" &&
      typeof meta.longitude === "number" &&
      (meta.latitude !== 0 || meta.longitude !== 0)
    ) {
      atonPaths["navigation.position"] = dp(
        { latitude: meta.latitude, longitude: meta.longitude },
        timestamp,
      );
    }
    if (Object.keys(atonPaths).length === 0) return null;
    atonPaths["mmsi"] = dp(mmsi, timestamp);
    return { kind: "aton", id: mmsi, paths: atonPaths };
  }

  const paths: Record<string, DataPoint> = {};

  // Ship name lives on MetaData on every message type — opportunistic identity.
  const name = trimAis(meta.ShipName);
  if (name) {
    paths["name"] = dp(name, timestamp);
  }

  const positionReport = inner["PositionReport"] as RawPosition | undefined;
  const classBPosition = inner["StandardClassBPositionReport"] as
    | RawPosition
    | undefined;
  const extendedClassB = inner["ExtendedClassBPositionReport"] as
    | (RawPosition & RawStaticData & { Name?: string })
    | undefined;
  const staticData = inner["ShipStaticData"] as RawStaticData | undefined;
  const staticDataReport = inner["StaticDataReport"] as
    | RawStaticDataReport
    | undefined;
  const longRange = inner["LongRangeAisBroadcastMessage"] as
    | RawPosition
    | undefined;
  const sarAircraft = inner["StandardSearchAndRescueAircraftReport"] as
    | RawPosition
    | undefined;

  if (positionReport) {
    Object.assign(paths, decodePositionPaths(positionReport, timestamp));
  }
  if (classBPosition) {
    Object.assign(paths, decodePositionPaths(classBPosition, timestamp));
  }
  if (extendedClassB) {
    Object.assign(paths, decodePositionPaths(extendedClassB, timestamp));
    Object.assign(paths, decodeStaticDataPaths(extendedClassB, timestamp));
    const extName = trimAis(extendedClassB.Name);
    if (extName && !paths["name"]) {
      paths["name"] = dp(extName, timestamp);
    }
  }
  if (staticData) {
    Object.assign(paths, decodeStaticDataPaths(staticData, timestamp));
  }
  if (staticDataReport) {
    Object.assign(paths, decodeStaticDataReport(staticDataReport, timestamp));
  }
  if (longRange) {
    // Type 27: low-resolution Class A position, used over satellite. Same
    // position fields as PositionReport, plus a `ShipType` field — the one
    // position-bearing message that also carries ship type, so it's worth
    // pulling identity from too.
    Object.assign(paths, decodePositionPaths(longRange, timestamp));
    const lrShipType = (longRange as RawPosition & { ShipType?: number })
      .ShipType;
    if (typeof lrShipType === "number" && !paths["design.aisShipType"]) {
      paths["design.aisShipType"] = dp(lrShipType, timestamp);
    }
  }
  if (sarAircraft) {
    // Type 9: SAR aircraft. Same paths as a vessel position report — by MMSI
    // (typically a 111... prefix). Altitude isn't surfaced by the detail
    // sheet today, so we don't bother routing it through.
    Object.assign(paths, decodePositionPaths(sarAircraft, timestamp));
  }

  // Fall back to MetaData position when no inner message contributed one.
  // Mainly relevant for ShipStaticData / StaticDataReport: the inner body
  // has no position, but MetaData carries where the broadcast was last
  // received from. Without this, a static-only vessel never plots.
  if (
    !paths["navigation.position"] &&
    typeof meta.latitude === "number" &&
    typeof meta.longitude === "number" &&
    // Filter out the (0, 0) "null island" sentinel some samples use.
    (meta.latitude !== 0 || meta.longitude !== 0)
  ) {
    paths["navigation.position"] = dp(
      { latitude: meta.latitude, longitude: meta.longitude },
      timestamp,
    );
  }

  if (Object.keys(paths).length === 0) return null;
  return { kind: "vessel", mmsi, paths };
}
