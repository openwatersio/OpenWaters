import type { DataPoint } from "@/instruments/hooks/useInstruments";
import { validateChecksum } from "@/instruments/nmea";

/** Result of decoding an AIS message */
export type AISDecodeResult = {
  mmsi: string;
  isSelf: boolean;
  paths: Record<string, DataPoint>;
} | null;

// --- 6-bit ASCII decoding ---

/**
 * Decode AIS 6-bit armored ASCII payload into a Uint8Array of bits.
 * Each payload character maps to 6 bits. The resulting array has one
 * element per bit (0 or 1), MSB first within each character.
 */
export function decodeSixBit(payload: string, fillBits: number): Uint8Array {
  const totalBits = payload.length * 6 - fillBits;
  const bits = new Uint8Array(totalBits);

  for (let i = 0; i < payload.length; i++) {
    let value = payload.charCodeAt(i) - 48;
    if (value > 40) value -= 8;

    const bitsFromChar = i === payload.length - 1 ? 6 - fillBits : 6;
    for (let b = 0; b < bitsFromChar; b++) {
      const bitIndex = i * 6 + b;
      if (bitIndex < totalBits) {
        bits[bitIndex] = (value >> (5 - b)) & 1;
      }
    }
  }

  return bits;
}

/** Extract an unsigned integer from a bit array */
export function getUint(bits: Uint8Array, offset: number, length: number): number {
  let value = 0;
  for (let i = 0; i < length; i++) {
    value = (value << 1) | (bits[offset + i] ?? 0);
  }
  return value;
}

/** Extract a signed integer (two's complement) from a bit array */
export function getInt(bits: Uint8Array, offset: number, length: number): number {
  const value = getUint(bits, offset, length);
  // If the MSB is set, it's negative
  if (value >= (1 << (length - 1))) {
    return value - (1 << length);
  }
  return value;
}

/** Extract a 6-bit packed ASCII string from a bit array */
export function getString(bits: Uint8Array, offset: number, length: number): string {
  const chars: string[] = [];
  for (let i = 0; i < length; i += 6) {
    const charValue = getUint(bits, offset + i, 6);
    // 6-bit ASCII: 0 = '@', 1-31 = 'A'-'_', 32 = ' ', 33-63 mapped
    if (charValue < 32) {
      chars.push(String.fromCharCode(charValue + 64));
    } else {
      chars.push(String.fromCharCode(charValue));
    }
  }
  // Trim trailing @ signs (padding) and whitespace
  return chars.join("").replace(/@+$/, "").trim();
}

// --- Field conversion helpers ---

/** Convert AIS latitude (1/10000 minute) to decimal degrees. Returns null if N/A (91°) */
function aisLatitude(raw: number): number | null {
  if (raw === 0x3412140) return null; // 91° = not available
  return raw / 600000;
}

/** Convert AIS longitude (1/10000 minute) to decimal degrees. Returns null if N/A (181°) */
function aisLongitude(raw: number): number | null {
  if (raw === 0x6791AC0) return null; // 181° = not available
  return raw / 600000;
}

/** Convert AIS SOG (1/10 knot) to m/s. Returns null if N/A (1023) */
function aisSog(raw: number): number | null {
  if (raw === 1023) return null;
  return (raw / 10) * 0.514444;
}

/** Convert AIS COG (1/10 degree) to radians. Returns null if N/A (3600) */
function aisCog(raw: number): number | null {
  if (raw === 3600) return null;
  return (raw / 10) * (Math.PI / 180);
}

/** Convert AIS heading (degrees) to radians. Returns null if N/A (511) */
function aisHeading(raw: number): number | null {
  if (raw === 511) return null;
  return raw * (Math.PI / 180);
}

/** Convert AIS ROT to radians/second. Returns null if N/A */
function aisRot(raw: number): number | null {
  if (raw === -128) return null;
  if (raw === 0) return 0;
  // ROT = 4.733 * sqrt(rate of turn sensor)
  // So rate = sign(raw) * (raw/4.733)^2 in degrees/min
  const sign = raw > 0 ? 1 : -1;
  const degreesPerMin = sign * (raw / 4.733) ** 2;
  // Convert to radians/second
  return (degreesPerMin * Math.PI) / (180 * 60);
}

/** Map AIS navigation status to Signal K state string */
function aisNavStatus(status: number): string | null {
  const map: Record<number, string> = {
    0: "motoring",
    1: "anchored",
    2: "not under command",
    3: "restricted maneuverability",
    4: "constrained by draft",
    5: "moored",
    6: "aground",
    7: "fishing",
    8: "sailing",
    14: "ais-sart",
    15: "default",
  };
  return map[status] ?? null;
}

/** Create a DataPoint for AIS data */
function makeAISDataPoint(
  value: DataPoint["value"],
  source: string,
  sentence: string,
): DataPoint {
  return {
    value,
    timestamp: Date.now(),
    source,
    meta: { sentence },
  };
}

// --- Message type parsers ---

/** Types 1, 2, 3 — Class A position report */
function parseType123(
  bits: Uint8Array,
  source: string,
): { mmsi: string; paths: Record<string, DataPoint> } | null {
  if (bits.length < 168) return null;

  const mmsi = String(getUint(bits, 8, 30)).padStart(9, "0");
  const paths: Record<string, DataPoint> = {};

  const navStatus = aisNavStatus(getUint(bits, 38, 4));
  if (navStatus) {
    paths["navigation.state"] = makeAISDataPoint(navStatus, source, "VDM");
  }

  const rot = aisRot(getInt(bits, 42, 8));
  if (rot !== null) {
    paths["navigation.rateOfTurn"] = makeAISDataPoint(rot, source, "VDM");
  }

  const sog = aisSog(getUint(bits, 50, 10));
  if (sog !== null) {
    paths["navigation.speedOverGround"] = makeAISDataPoint(sog, source, "VDM");
  }

  const longitude = aisLongitude(getInt(bits, 61, 28));
  const latitude = aisLatitude(getInt(bits, 89, 27));
  if (longitude !== null && latitude !== null) {
    paths["navigation.position"] = makeAISDataPoint(
      { latitude, longitude },
      source,
      "VDM",
    );
  }

  const cog = aisCog(getUint(bits, 116, 12));
  if (cog !== null) {
    paths["navigation.courseOverGroundTrue"] = makeAISDataPoint(cog, source, "VDM");
  }

  const heading = aisHeading(getUint(bits, 128, 9));
  if (heading !== null) {
    paths["navigation.headingTrue"] = makeAISDataPoint(heading, source, "VDM");
  }

  return { mmsi, paths };
}

/** Type 5 — Class A static and voyage data (spans 2 sentences, 424 bits) */
function parseType5(
  bits: Uint8Array,
  source: string,
): { mmsi: string; paths: Record<string, DataPoint> } | null {
  if (bits.length < 424) return null;

  const mmsi = String(getUint(bits, 8, 30)).padStart(9, "0");
  const paths: Record<string, DataPoint> = {};

  const imo = getUint(bits, 40, 30);
  if (imo > 0) {
    paths["registrations.imo"] = makeAISDataPoint(
      `IMO ${imo}`,
      source,
      "VDM",
    );
  }

  const callSign = getString(bits, 70, 42);
  if (callSign) {
    paths["communication.callsignVhf"] = makeAISDataPoint(callSign, source, "VDM");
  }

  const name = getString(bits, 112, 120);
  if (name) {
    paths["name"] = makeAISDataPoint(name, source, "VDM");
  }

  const shipType = getUint(bits, 232, 8);
  paths["design.aisShipType"] = makeAISDataPoint(shipType, source, "VDM");

  // Dimensions: A (bow), B (stern), C (port), D (starboard)
  const dimA = getUint(bits, 240, 9);
  const dimB = getUint(bits, 249, 9);
  const dimC = getUint(bits, 258, 6);
  const dimD = getUint(bits, 264, 6);
  const length = dimA + dimB;
  const beam = dimC + dimD;
  if (length > 0) {
    paths["design.length"] = makeAISDataPoint(length, source, "VDM");
  }
  if (beam > 0) {
    paths["design.beam"] = makeAISDataPoint(beam, source, "VDM");
  }

  const draft = getUint(bits, 294, 8) / 10;
  if (draft > 0) {
    paths["design.draft"] = makeAISDataPoint(draft, source, "VDM");
  }

  // ETA: month (4 bits), day (5 bits), hour (5 bits), minute (6 bits)
  const etaMonth = getUint(bits, 274, 4);
  const etaDay = getUint(bits, 278, 5);
  const etaHour = getUint(bits, 283, 5);
  const etaMinute = getUint(bits, 289, 6);
  // 0 values mean "not available"
  if (etaMonth > 0 && etaDay > 0) {
    const etaStr = etaHour < 24 && etaMinute < 60
      ? `${String(etaMonth).padStart(2, "0")}-${String(etaDay).padStart(2, "0")} ${String(etaHour).padStart(2, "0")}:${String(etaMinute).padStart(2, "0")}`
      : `${String(etaMonth).padStart(2, "0")}-${String(etaDay).padStart(2, "0")}`;
    paths["navigation.eta"] = makeAISDataPoint(etaStr, source, "VDM");
  }

  const destination = getString(bits, 302, 120);
  if (destination) {
    paths["navigation.destination"] = makeAISDataPoint(destination, source, "VDM");
  }

  return { mmsi, paths };
}

/** Type 18 — Class B CS position report */
function parseType18(
  bits: Uint8Array,
  source: string,
): { mmsi: string; paths: Record<string, DataPoint> } | null {
  if (bits.length < 168) return null;

  const mmsi = String(getUint(bits, 8, 30)).padStart(9, "0");
  const paths: Record<string, DataPoint> = {};

  const sog = aisSog(getUint(bits, 46, 10));
  if (sog !== null) {
    paths["navigation.speedOverGround"] = makeAISDataPoint(sog, source, "VDM");
  }

  const longitude = aisLongitude(getInt(bits, 57, 28));
  const latitude = aisLatitude(getInt(bits, 85, 27));
  if (longitude !== null && latitude !== null) {
    paths["navigation.position"] = makeAISDataPoint(
      { latitude, longitude },
      source,
      "VDM",
    );
  }

  const cog = aisCog(getUint(bits, 112, 12));
  if (cog !== null) {
    paths["navigation.courseOverGroundTrue"] = makeAISDataPoint(cog, source, "VDM");
  }

  const heading = aisHeading(getUint(bits, 124, 9));
  if (heading !== null) {
    paths["navigation.headingTrue"] = makeAISDataPoint(heading, source, "VDM");
  }

  return { mmsi, paths };
}

/** Type 19 — Class B CS extended position report */
function parseType19(
  bits: Uint8Array,
  source: string,
): { mmsi: string; paths: Record<string, DataPoint> } | null {
  if (bits.length < 312) return null;

  const mmsi = String(getUint(bits, 8, 30)).padStart(9, "0");
  const paths: Record<string, DataPoint> = {};

  const sog = aisSog(getUint(bits, 46, 10));
  if (sog !== null) {
    paths["navigation.speedOverGround"] = makeAISDataPoint(sog, source, "VDM");
  }

  const longitude = aisLongitude(getInt(bits, 57, 28));
  const latitude = aisLatitude(getInt(bits, 85, 27));
  if (longitude !== null && latitude !== null) {
    paths["navigation.position"] = makeAISDataPoint(
      { latitude, longitude },
      source,
      "VDM",
    );
  }

  const cog = aisCog(getUint(bits, 112, 12));
  if (cog !== null) {
    paths["navigation.courseOverGroundTrue"] = makeAISDataPoint(cog, source, "VDM");
  }

  const heading = aisHeading(getUint(bits, 124, 9));
  if (heading !== null) {
    paths["navigation.headingTrue"] = makeAISDataPoint(heading, source, "VDM");
  }

  const name = getString(bits, 143, 120);
  if (name) {
    paths["name"] = makeAISDataPoint(name, source, "VDM");
  }

  const shipType = getUint(bits, 263, 8);
  paths["design.aisShipType"] = makeAISDataPoint(shipType, source, "VDM");

  const dimA = getUint(bits, 271, 9);
  const dimB = getUint(bits, 280, 9);
  const dimC = getUint(bits, 289, 6);
  const dimD = getUint(bits, 295, 6);
  const length = dimA + dimB;
  const beam = dimC + dimD;
  if (length > 0) {
    paths["design.length"] = makeAISDataPoint(length, source, "VDM");
  }
  if (beam > 0) {
    paths["design.beam"] = makeAISDataPoint(beam, source, "VDM");
  }

  return { mmsi, paths };
}

/** Type 24 Part A — Class B static data (name) */
function parseType24A(
  bits: Uint8Array,
  source: string,
): { mmsi: string; paths: Record<string, DataPoint> } | null {
  // Name ends at bit 160 (offset 40 + 120 bits). Fill bits often trim
  // the 168-bit message to 160-166 bits, so check against actual need.
  if (bits.length < 160) return null;

  const mmsi = String(getUint(bits, 8, 30)).padStart(9, "0");
  const name = getString(bits, 40, 120);
  if (!name) return null;

  return {
    mmsi,
    paths: { name: makeAISDataPoint(name, source, "VDM") },
  };
}

/** Type 24 Part B — Class B static data (call sign, ship type, dimensions) */
function parseType24B(
  bits: Uint8Array,
  source: string,
): { mmsi: string; paths: Record<string, DataPoint> } | null {
  // Last field (dim starboard) ends at bit 162. Fill bits often trim below 168.
  if (bits.length < 162) return null;

  const mmsi = String(getUint(bits, 8, 30)).padStart(9, "0");
  const paths: Record<string, DataPoint> = {};

  // Type 24 Part B layout: shipType(40-47), vendorId(48-89), callSign(90-131), dims(132+)
  const shipType = getUint(bits, 40, 8);
  paths["design.aisShipType"] = makeAISDataPoint(shipType, source, "VDM");

  const callSign = getString(bits, 90, 42);
  if (callSign) {
    paths["communication.callsignVhf"] = makeAISDataPoint(callSign, source, "VDM");
  }

  const dimA = getUint(bits, 132, 9);
  const dimB = getUint(bits, 141, 9);
  const dimC = getUint(bits, 150, 6);
  const dimD = getUint(bits, 156, 6);
  const length = dimA + dimB;
  const beam = dimC + dimD;
  if (length > 0) {
    paths["design.length"] = makeAISDataPoint(length, source, "VDM");
  }
  if (beam > 0) {
    paths["design.beam"] = makeAISDataPoint(beam, source, "VDM");
  }

  return { mmsi, paths };
}

// --- Multi-sentence reassembly ---

type Fragment = {
  payload: string;
  fillBits: number;
  timestamp: number;
};

/** Pending multi-sentence messages, keyed by "sequenceId-channel" */
const pendingFragments = new Map<string, Fragment[]>();

/** Timeout for incomplete multi-sentence messages (10 seconds) */
const FRAGMENT_TIMEOUT = 10_000;

/** Prune stale incomplete fragments */
function pruneFragments() {
  const now = Date.now();
  for (const [key, fragments] of pendingFragments) {
    if (now - fragments[0].timestamp > FRAGMENT_TIMEOUT) {
      pendingFragments.delete(key);
    }
  }
}

// --- Public API ---

/**
 * Process an AIS VDM/VDO sentence.
 *
 * Call this for each `!AIVDM` or `!AIVDO` sentence. Multi-sentence messages
 * (e.g., Type 5) are reassembled automatically — returns null for intermediate
 * fragments and the decoded result when the final fragment arrives.
 */
export function decodeAIS(sentence: string, source: string): AISDecodeResult {
  if (!validateChecksum(sentence)) return null;

  const starIndex = sentence.lastIndexOf("*");
  const body = sentence.substring(1, starIndex);
  const fields = body.split(",");

  // fields: [tag, totalFragments, fragmentNum, seqId, channel, payload, fillBits]
  if (fields.length < 7) return null;

  const totalFragments = parseInt(fields[1], 10);
  const fragmentNum = parseInt(fields[2], 10);
  const seqId = fields[3];
  const channel = fields[4];
  const payload = fields[5];
  const fillBits = parseInt(fields[6], 10);

  const isSelf = fields[0].endsWith("VDO");

  let fullPayload: string;
  let finalFillBits: number;

  if (totalFragments === 1) {
    // Single-sentence message
    fullPayload = payload;
    finalFillBits = fillBits;
  } else {
    // Multi-sentence reassembly
    const key = `${seqId}-${channel}`;

    if (fragmentNum === 1) {
      // First fragment — start new assembly
      pendingFragments.set(key, [{ payload, fillBits, timestamp: Date.now() }]);
      pruneFragments();
      return null;
    }

    const existing = pendingFragments.get(key);
    if (!existing || existing.length !== fragmentNum - 1) {
      // Out of order or missing fragment
      pendingFragments.delete(key);
      return null;
    }

    existing.push({ payload, fillBits, timestamp: Date.now() });

    if (fragmentNum < totalFragments) {
      // Not the last fragment yet
      return null;
    }

    // All fragments received — concatenate payloads
    fullPayload = existing.map((f) => f.payload).join("");
    finalFillBits = fillBits; // Only the last fragment has meaningful fill bits
    pendingFragments.delete(key);
  }

  const bits = decodeSixBit(fullPayload, finalFillBits);
  if (bits.length < 6) return null;

  const messageType = getUint(bits, 0, 6);

  let result: { mmsi: string; paths: Record<string, DataPoint> } | null = null;

  switch (messageType) {
    case 1:
    case 2:
    case 3:
      result = parseType123(bits, source);
      break;
    case 5:
      result = parseType5(bits, source);
      break;
    case 18:
      result = parseType18(bits, source);
      break;
    case 19:
      result = parseType19(bits, source);
      break;
    case 24: {
      const partNum = getUint(bits, 38, 2);
      if (partNum === 0) {
        result = parseType24A(bits, source);
      } else {
        result = parseType24B(bits, source);
      }
      break;
    }
    default:
      return null;
  }

  if (!result) return null;

  return {
    mmsi: result.mmsi,
    isSelf,
    paths: result.paths,
  };
}

/** Clear pending fragments (for testing) */
export function clearFragments() {
  pendingFragments.clear();
}
