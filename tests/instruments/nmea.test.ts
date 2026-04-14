import {
  validateChecksum,
  parseLatitude,
  parseLongitude,
  parseSentence,
} from "@/instruments/nmea";

const SOURCE = "nmea.tcp.192.168.1.1:10110";

describe("validateChecksum", () => {
  it("validates a correct checksum", () => {
    expect(validateChecksum("$SDDBT,17.5,f,5.3,M,2.9,F*38")).toBe(true);
  });

  it("rejects an incorrect checksum", () => {
    expect(validateChecksum("$SDDBT,17.5,f,5.3,M,2.9,F*00")).toBe(false);
  });

  it("rejects sentences without a checksum", () => {
    expect(validateChecksum("$SDDBT,17.5,f,5.3,M,2.9,F")).toBe(false);
  });

  it("validates AIS sentence checksums (! prefix)", () => {
    expect(validateChecksum("!AIVDM,1,1,,B,15MgK70P00G?tlhE6;gqm6200>`<,0*4A")).toBe(true);
  });
});

describe("parseLatitude", () => {
  it("parses N hemisphere", () => {
    const lat = parseLatitude("4736.00000", "N");
    expect(lat).toBeCloseTo(47.6, 4);
  });

  it("parses S hemisphere as negative", () => {
    const lat = parseLatitude("3342.00000", "S");
    expect(lat).toBeCloseTo(-33.7, 4);
  });

  it("returns null for empty fields", () => {
    expect(parseLatitude("", "N")).toBeNull();
    expect(parseLatitude("4736.00000", "")).toBeNull();
  });
});

describe("parseLongitude", () => {
  it("parses W hemisphere as negative", () => {
    const lon = parseLongitude("12218.00000", "W");
    expect(lon).toBeCloseTo(-122.3, 4);
  });

  it("parses E hemisphere as positive", () => {
    const lon = parseLongitude("00212.34567", "E");
    expect(lon).toBeCloseTo(2.205761, 3);
  });
});

describe("parseSentence", () => {
  describe("DBT — Depth Below Transducer", () => {
    it("parses depth in meters", () => {
      const result = parseSentence("$SDDBT,17.5,f,5.3,M,2.9,F*38", SOURCE);
      expect(result).not.toBeNull();
      expect(result!.isSelf).toBe(true);

      const depth = result!.paths["environment.depth.belowTransducer"];
      expect(depth.value).toBe(5.3);
      expect(depth.source).toBe(SOURCE);
      expect(depth.meta?.sentence).toBe("DBT");
      expect(depth.meta?.talker).toBe("SD");
    });
  });

  describe("DPT — Depth", () => {
    it("parses depth with positive offset (below surface)", () => {
      const result = parseSentence("$SDDPT,5.3,0.5,*78", SOURCE);
      expect(result).not.toBeNull();
      expect(result!.paths["environment.depth.belowTransducer"]?.value).toBe(5.3);
      expect(result!.paths["environment.depth.belowSurface"]?.value).toBe(5.8);
    });

    it("parses depth with negative offset (below keel)", () => {
      const result = parseSentence("$SDDPT,5.3,-1.0,*51", SOURCE);
      expect(result).not.toBeNull();
      expect(result!.paths["environment.depth.belowTransducer"]?.value).toBe(5.3);
      expect(result!.paths["environment.depth.belowKeel"]?.value).toBeCloseTo(4.3);
    });
  });

  describe("MWV — Wind Speed and Angle", () => {
    it("parses apparent wind in knots", () => {
      const result = parseSentence("$WIMWV,214.8,R,7.2,N,A*29", SOURCE);
      expect(result).not.toBeNull();

      const angle = result!.paths["environment.wind.angleApparent"];
      expect(angle.value).toBeCloseTo(214.8 * (Math.PI / 180), 4);

      const speed = result!.paths["environment.wind.speedApparent"];
      expect(speed.value).toBeCloseTo(7.2 * 0.514444, 4);
    });

    it("parses true wind in m/s", () => {
      const result = parseSentence("$WIMWV,180.0,T,5.0,M,A*2A", SOURCE);
      expect(result).not.toBeNull();
      expect(result!.paths["environment.wind.directionTrue"]).toBeDefined();
      expect(result!.paths["environment.wind.speedTrue"]?.value).toBe(5.0);
    });

    it("returns null for invalid status", () => {
      const result = parseSentence("$WIMWV,214.8,R,7.2,N,V*3E", SOURCE);
      expect(result).toBeNull();
    });
  });

  describe("HDG — Heading", () => {
    it("parses magnetic heading", () => {
      const result = parseSentence("$HCHDG,101.1,,,7.1,W*3C", SOURCE);
      expect(result).not.toBeNull();

      const heading = result!.paths["navigation.headingMagnetic"];
      expect(heading.value).toBeCloseTo(101.1 * (Math.PI / 180), 4);
    });

    it("computes true heading from variation", () => {
      const result = parseSentence("$HCHDG,101.1,,,7.1,W*3C", SOURCE);
      expect(result).not.toBeNull();

      const trueHeading = result!.paths["navigation.headingTrue"];
      expect(trueHeading).toBeDefined();
      // 101.1 + 7.1 * -1 (W) = 94.0 degrees
      expect(trueHeading.value).toBeCloseTo(94.0 * (Math.PI / 180), 4);
    });
  });

  describe("HDT — Heading True", () => {
    it("parses true heading", () => {
      const result = parseSentence("$IIHDT,46.3,T*13", SOURCE);
      expect(result).not.toBeNull();

      const heading = result!.paths["navigation.headingTrue"];
      expect(heading.value).toBeCloseTo(46.3 * (Math.PI / 180), 4);
      expect(heading.meta?.sentence).toBe("HDT");
    });
  });

  describe("HDM — Heading Magnetic", () => {
    it("parses magnetic heading", () => {
      const result = parseSentence("$IIHDM,37.1,M*17", SOURCE);
      expect(result).not.toBeNull();

      const heading = result!.paths["navigation.headingMagnetic"];
      expect(heading.value).toBeCloseTo(37.1 * (Math.PI / 180), 4);
      expect(heading.meta?.sentence).toBe("HDM");
    });
  });

  describe("RMC — Recommended Minimum", () => {
    it("parses position, SOG, and COG", () => {
      const result = parseSentence(
        "$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A",
        SOURCE,
      );
      expect(result).not.toBeNull();

      const pos = result!.paths["navigation.position"]?.value as {
        latitude: number;
        longitude: number;
      };
      expect(pos.latitude).toBeCloseTo(48.1173, 3);
      expect(pos.longitude).toBeCloseTo(11.5167, 3);

      const sog = result!.paths["navigation.speedOverGround"];
      expect(sog.value).toBeCloseTo(22.4 * 0.514444, 3);

      const cog = result!.paths["navigation.courseOverGroundTrue"];
      expect(cog.value).toBeCloseTo(84.4 * (Math.PI / 180), 4);
    });

    it("returns null for void status", () => {
      const result = parseSentence(
        "$GPRMC,123519,V,,,,,,,230394,,,N*51",
        SOURCE,
      );
      expect(result).toBeNull();
    });
  });

  describe("GGA — GPS Fix", () => {
    it("parses position", () => {
      const result = parseSentence(
        "$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,47.0,M,,*4F",
        SOURCE,
      );
      expect(result).not.toBeNull();

      const pos = result!.paths["navigation.position"]?.value as {
        latitude: number;
        longitude: number;
      };
      expect(pos.latitude).toBeCloseTo(48.1173, 3);
      expect(pos.longitude).toBeCloseTo(11.5167, 3);
    });

    it("returns null for no fix", () => {
      const result = parseSentence(
        "$GPGGA,123519,,,,,0,00,99.9,,,,,,*7C",
        SOURCE,
      );
      expect(result).toBeNull();
    });
  });

  describe("MTW — Water Temperature", () => {
    it("parses temperature and converts to Kelvin", () => {
      const result = parseSentence("$YXMTW,17.25,C*23", SOURCE);
      expect(result).not.toBeNull();

      const temp = result!.paths["environment.water.temperature"];
      expect(temp.value).toBeCloseTo(290.4, 1);
    });
  });

  describe("VHW — Water Speed and Heading", () => {
    it("parses speed through water", () => {
      const result = parseSentence("$VWVHW,,,,,5.5,N,,*28", SOURCE);
      expect(result).not.toBeNull();

      const speed = result!.paths["navigation.speedThroughWater"];
      expect(speed.value).toBeCloseTo(5.5 * 0.514444, 4);
    });
  });

  describe("edge cases", () => {
    it("returns null for empty string", () => {
      expect(parseSentence("", SOURCE)).toBeNull();
    });

    it("returns null for invalid checksum", () => {
      expect(parseSentence("$SDDBT,17.5,f,5.3,M,2.9,F*00", SOURCE)).toBeNull();
    });

    it("returns null for AIS sentences (! prefix)", () => {
      expect(
        parseSentence("!AIVDM,1,1,,B,15MgK70P00G?tlhE6;gqm6200>`<,0*4A", SOURCE),
      ).toBeNull();
    });

    it("returns null for unrecognized sentence types", () => {
      expect(parseSentence("$GPXXX,1,2,3*53", SOURCE)).toBeNull();
    });
  });
});
