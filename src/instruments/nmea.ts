import type { DataPoint } from "@/instruments/hooks/useInstruments";

/** Result of parsing a single NMEA sentence */
export type NMEAParseResult = {
  paths: Record<string, DataPoint>;
  /** AIS sentences return false — they're handled by the AIS decoder */
  isSelf: true;
} | null;

/** Validate NMEA 0183 checksum: XOR each char between $ (or !) and * */
export function validateChecksum(sentence: string): boolean {
  const starIndex = sentence.lastIndexOf("*");
  if (starIndex === -1 || starIndex + 3 > sentence.length) return false;

  const start = sentence[0] === "$" || sentence[0] === "!" ? 1 : 0;
  let checksum = 0;
  for (let i = start; i < starIndex; i++) {
    checksum ^= sentence.charCodeAt(i);
  }

  const expected = sentence.substring(starIndex + 1, starIndex + 3).toUpperCase();
  const actual = checksum.toString(16).toUpperCase().padStart(2, "0");
  return expected === actual;
}

/** Parse ddmm.mmmmm latitude format to decimal degrees */
export function parseLatitude(field: string, hemisphere: string): number | null {
  if (!field || !hemisphere) return null;
  const degrees = parseInt(field.substring(0, 2), 10);
  const minutes = parseFloat(field.substring(2));
  if (isNaN(degrees) || isNaN(minutes)) return null;
  const value = degrees + minutes / 60;
  return hemisphere === "S" ? -value : value;
}

/** Parse dddmm.mmmmm longitude format to decimal degrees */
export function parseLongitude(field: string, hemisphere: string): number | null {
  if (!field || !hemisphere) return null;
  const degrees = parseInt(field.substring(0, 3), 10);
  const minutes = parseFloat(field.substring(3));
  if (isNaN(degrees) || isNaN(minutes)) return null;
  const value = degrees + minutes / 60;
  return hemisphere === "W" ? -value : value;
}

/** Convert knots to meters per second */
function knotsToMs(knots: number): number {
  return knots * 0.514444;
}

/** Convert degrees to radians */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Convert Celsius to Kelvin */
function celsiusToKelvin(celsius: number): number {
  return celsius + 273.15;
}

/** Parse a float from a field, returning null if empty or invalid */
function parseField(field: string): number | null {
  if (!field) return null;
  const value = parseFloat(field);
  return isNaN(value) ? null : value;
}

/** Create a DataPoint with NMEA metadata */
function makeDataPoint(
  value: DataPoint["value"],
  source: string,
  sentence: string,
  talker: string,
): DataPoint {
  return {
    value,
    timestamp: Date.now(),
    source,
    meta: { sentence, talker },
  };
}

// --- Per-sentence parsers ---

/** DBT — Depth Below Transducer */
function parseDBT(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  // fields[3] is depth in meters
  const meters = parseField(fields[3]);
  if (meters === null) return null;
  return {
    "environment.depth.belowTransducer": makeDataPoint(meters, source, "DBT", talker),
  };
}

/** DPT — Depth */
function parseDPT(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  const depth = parseField(fields[1]);
  if (depth === null) return null;
  const offset = parseField(fields[2]);

  const result: Record<string, DataPoint> = {
    "environment.depth.belowTransducer": makeDataPoint(depth, source, "DPT", talker),
  };

  // Positive offset = transducer below waterline → belowSurface = depth + offset
  // Negative offset = distance from keel → belowKeel = depth + offset
  if (offset !== null) {
    if (offset >= 0) {
      result["environment.depth.belowSurface"] = makeDataPoint(
        depth + offset,
        source,
        "DPT",
        talker,
      );
    } else {
      result["environment.depth.belowKeel"] = makeDataPoint(
        depth + offset,
        source,
        "DPT",
        talker,
      );
    }
  }

  return result;
}

/** MWV — Wind Speed and Angle */
function parseMWV(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  // fields[5] = status, A = valid
  if (fields[5] !== "A") return null;

  const angle = parseField(fields[1]);
  if (angle === null) return null;

  const speedRaw = parseField(fields[3]);
  if (speedRaw === null) return null;

  // Convert speed to m/s based on units field
  let speed: number;
  switch (fields[4]) {
    case "N":
      speed = knotsToMs(speedRaw);
      break;
    case "M":
      speed = speedRaw;
      break;
    case "K":
      speed = speedRaw / 3.6;
      break;
    case "S":
      speed = speedRaw * 0.44704; // statute miles/hr to m/s
      break;
    default:
      return null;
  }

  const angleRad = degreesToRadians(angle);

  // R = relative (apparent), T = true
  if (fields[2] === "R") {
    return {
      "environment.wind.angleApparent": makeDataPoint(angleRad, source, "MWV", talker),
      "environment.wind.speedApparent": makeDataPoint(speed, source, "MWV", talker),
    };
  } else if (fields[2] === "T") {
    return {
      "environment.wind.directionTrue": makeDataPoint(angleRad, source, "MWV", talker),
      "environment.wind.speedTrue": makeDataPoint(speed, source, "MWV", talker),
    };
  }
  return null;
}

/** HDG — Heading, Deviation & Variation */
function parseHDG(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  const heading = parseField(fields[1]);
  if (heading === null) return null;

  const result: Record<string, DataPoint> = {
    "navigation.headingMagnetic": makeDataPoint(
      degreesToRadians(heading),
      source,
      "HDG",
      talker,
    ),
  };

  // If variation is present, compute true heading
  const variation = parseField(fields[4]);
  if (variation !== null) {
    const varSign = fields[5] === "W" ? -1 : 1;
    const trueHeading = heading + variation * varSign;
    result["navigation.headingTrue"] = makeDataPoint(
      degreesToRadians(trueHeading),
      source,
      "HDG",
      talker,
    );
  }

  return result;
}

/** HDT — Heading True */
function parseHDT(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  const heading = parseField(fields[1]);
  if (heading === null) return null;

  return {
    "navigation.headingTrue": makeDataPoint(
      degreesToRadians(heading),
      source,
      "HDT",
      talker,
    ),
  };
}

/** HDM — Heading Magnetic */
function parseHDM(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  const heading = parseField(fields[1]);
  if (heading === null) return null;

  return {
    "navigation.headingMagnetic": makeDataPoint(
      degreesToRadians(heading),
      source,
      "HDM",
      talker,
    ),
  };
}

/** RMC — Recommended Minimum Navigation Information */
function parseRMC(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  // fields[2] = status, A = active
  if (fields[2] !== "A") return null;

  const latitude = parseLatitude(fields[3], fields[4]);
  const longitude = parseLongitude(fields[5], fields[6]);
  if (latitude === null || longitude === null) return null;

  const result: Record<string, DataPoint> = {
    "navigation.position": makeDataPoint(
      { latitude, longitude },
      source,
      "RMC",
      talker,
    ),
  };

  const sog = parseField(fields[7]);
  if (sog !== null) {
    result["navigation.speedOverGround"] = makeDataPoint(
      knotsToMs(sog),
      source,
      "RMC",
      talker,
    );
  }

  const cog = parseField(fields[8]);
  if (cog !== null) {
    result["navigation.courseOverGroundTrue"] = makeDataPoint(
      degreesToRadians(cog),
      source,
      "RMC",
      talker,
    );
  }

  return result;
}

/** GGA — Global Positioning System Fix Data */
function parseGGA(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  // fields[6] = fix quality, 0 = invalid
  if (fields[6] === "0" || !fields[6]) return null;

  const latitude = parseLatitude(fields[2], fields[3]);
  const longitude = parseLongitude(fields[4], fields[5]);
  if (latitude === null || longitude === null) return null;

  return {
    "navigation.position": makeDataPoint(
      { latitude, longitude },
      source,
      "GGA",
      talker,
    ),
  };
}

/** MTW — Mean Temperature of Water */
function parseMTW(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  const temp = parseField(fields[1]);
  if (temp === null) return null;

  // Unit field: C = Celsius (standard), but handle any case
  const value = fields[2] === "C" ? celsiusToKelvin(temp) : celsiusToKelvin(temp);

  return {
    "environment.water.temperature": makeDataPoint(value, source, "MTW", talker),
  };
}

/** VHW — Water Speed and Heading */
function parseVHW(
  fields: string[],
  source: string,
  talker: string,
): Record<string, DataPoint> | null {
  // fields[5] = speed in knots
  const speedKnots = parseField(fields[5]);
  if (speedKnots === null) return null;

  return {
    "navigation.speedThroughWater": makeDataPoint(
      knotsToMs(speedKnots),
      source,
      "VHW",
      talker,
    ),
  };
}

// --- Sentence dispatch ---

const parsers: Record<
  string,
  (fields: string[], source: string, talker: string) => Record<string, DataPoint> | null
> = {
  DBT: parseDBT,
  DPT: parseDPT,
  MWV: parseMWV,
  HDG: parseHDG,
  HDT: parseHDT,
  HDM: parseHDM,
  RMC: parseRMC,
  GGA: parseGGA,
  MTW: parseMTW,
  VHW: parseVHW,
};

/**
 * Parse a single NMEA 0183 sentence.
 *
 * Returns null for:
 * - Invalid checksum
 * - AIS sentences (VDM/VDO) — handled by lib/ais.ts
 * - Unrecognized sentence types
 * - Sentences with invalid/missing required fields
 */
export function parseSentence(sentence: string, source: string): NMEAParseResult {
  const trimmed = sentence.trim();
  if (!trimmed) return null;

  // AIS sentences start with ! — delegate to AIS decoder
  if (trimmed[0] === "!") return null;

  if (!validateChecksum(trimmed)) return null;

  // Extract content between $ and *
  const starIndex = trimmed.lastIndexOf("*");
  const body = trimmed.substring(1, starIndex);
  const fields = body.split(",");

  // First field is talker + sentence type (e.g., "GPGGA", "SDDBT")
  const tag = fields[0];
  if (tag.length < 3) return null;

  const talker = tag.substring(0, tag.length - 3);
  const sentenceType = tag.substring(tag.length - 3);

  const parser = parsers[sentenceType];
  if (!parser) return null;

  const paths = parser(fields, source, talker);
  if (!paths) return null;

  return { paths, isSelf: true };
}
