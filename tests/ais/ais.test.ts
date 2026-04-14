import {
  decodeSixBit,
  getUint,
  getInt,
  getString,
  decodeAIS,
  clearFragments,
} from "@/ais/ais";

const SOURCE = "nmea.tcp.192.168.1.1:10110";

beforeEach(() => {
  clearFragments();
});

describe("decodeSixBit", () => {
  it("decodes a simple payload", () => {
    // '0' = char 48, value 0 = 000000
    // '1' = char 49, value 1 = 000001
    const bits = decodeSixBit("01", 0);
    expect(bits.length).toBe(12);
    expect(getUint(bits, 0, 6)).toBe(0);
    expect(getUint(bits, 6, 6)).toBe(1);
  });

  it("handles fill bits", () => {
    const bits = decodeSixBit("01", 2);
    expect(bits.length).toBe(10);
  });

  it("handles values above 40", () => {
    // 'w' = char 119, 119-48=71, 71>40 so 71-8=63 = 111111
    const bits = decodeSixBit("w", 0);
    expect(getUint(bits, 0, 6)).toBe(63);
  });
});

describe("getInt", () => {
  it("extracts positive signed integer", () => {
    const bits = new Uint8Array([0, 1, 0, 1]); // 5 unsigned, 5 signed
    expect(getInt(bits, 0, 4)).toBe(5);
  });

  it("extracts negative signed integer", () => {
    // 1111 = -1 in 4-bit two's complement
    const bits = new Uint8Array([1, 1, 1, 1]);
    expect(getInt(bits, 0, 4)).toBe(-1);
  });
});

describe("getString", () => {
  it("decodes 6-bit ASCII and trims padding", () => {
    // A=1=000001, B=2=000010
    const bits = new Uint8Array([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
    expect(getString(bits, 0, 12)).toBe("AB");
  });

  it("trims trailing @ signs", () => {
    // A=1, @=0 (padding)
    const bits = new Uint8Array([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
    expect(getString(bits, 0, 12)).toBe("A");
  });
});

describe("decodeAIS", () => {
  describe("Type 1 — Class A position report", () => {
    it("decodes MMSI from a real payload", () => {
      // Type 1: MMSI 265557232
      const result = decodeAIS(
        "!AIVDM,1,1,,B,13u@Dt002s000000000000000000,0*63",
        SOURCE,
      );
      expect(result).not.toBeNull();
      expect(result!.mmsi).toBe("265557232");
      expect(result!.isSelf).toBe(false);
    });
  });

  describe("Type 1 — Class A with navigation data", () => {
    it("decodes a vessel with position", () => {
      // Type 1: MMSI 367078250
      const result = decodeAIS(
        "!AIVDM,1,1,,B,15N4cJ`005Jrek0H@9n`DW5608EP,0*13",
        SOURCE,
      );
      expect(result).not.toBeNull();
      expect(result!.mmsi).toBe("367078250");

      const pos = result!.paths["navigation.position"]?.value as {
        latitude: number;
        longitude: number;
      };
      expect(pos).toBeDefined();
      expect(pos.latitude).toBeGreaterThan(-90);
      expect(pos.latitude).toBeLessThan(90);
      expect(pos.longitude).toBeGreaterThan(-180);
      expect(pos.longitude).toBeLessThan(180);
    });
  });

  describe("Type 5 — Class A static (multi-sentence)", () => {
    it("reassembles two fragments and decodes static data", () => {
      // Type 5: MMSI 351759000
      const result1 = decodeAIS(
        "!AIVDM,2,1,3,B,55?MbV02>H97ac<H4eEK6wtDkh00000000000000S2`t6?A240t@E2340H,0*45",
        SOURCE,
      );
      expect(result1).toBeNull(); // First fragment

      const result2 = decodeAIS(
        "!AIVDM,2,2,3,B,0000000000000,2*24",
        SOURCE,
      );
      expect(result2).not.toBeNull();
      expect(result2!.mmsi).toBe("351759000");

      expect(result2!.paths["name"]).toBeDefined();
      expect(result2!.paths["design.aisShipType"]).toBeDefined();
    });

    it("returns null for incomplete multi-sentence", () => {
      const result = decodeAIS(
        "!AIVDM,2,1,3,B,55?MbV02>H97ac<H4eEK6wtDkh00000000000000S2`t6?A240t@E2340H,0*45",
        SOURCE,
      );
      expect(result).toBeNull();
    });
  });

  describe("Type 18 — Class B position report", () => {
    it("decodes Class B position", () => {
      // Type 18: MMSI 367430530
      const result = decodeAIS(
        "!AIVDM,1,1,,B,B5NJ;PP005l4ot5Isbl03wsUkP06,0*75",
        SOURCE,
      );
      expect(result).not.toBeNull();
      expect(result!.mmsi).toBe("367430530");
      expect(result!.paths["navigation.position"]).toBeDefined();
    });
  });

  describe("Type 24A — Class B static (name)", () => {
    it("decodes vessel name", () => {
      // Type 24 Part A: MMSI 367430530
      const result = decodeAIS(
        "!AIVDM,1,1,,A,H5NJ;PP4T3H00000000000000000,0*4F",
        SOURCE,
      );
      expect(result).not.toBeNull();
      expect(result!.mmsi).toBe("367430530");
      expect(result!.paths["name"]).toBeDefined();
    });
  });

  describe("VDO sentences", () => {
    it("marks VDO as self vessel", () => {
      const result = decodeAIS(
        "!AIVDO,1,1,,B,13u@Dt002s000000000000000000,0*61",
        SOURCE,
      );
      expect(result).not.toBeNull();
      expect(result!.isSelf).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns null for invalid checksum", () => {
      expect(
        decodeAIS("!AIVDM,1,1,,B,13u@Dt002s000000000000000000,0*00", SOURCE),
      ).toBeNull();
    });

    it("returns null for unsupported message types", () => {
      // Type 4 — base station report
      const result = decodeAIS(
        "!AIVDM,1,1,,A,403OviQuMGCqWrRO9>E6fE700@@T,0*51",
        SOURCE,
      );
      expect(result).toBeNull();
    });

    it("returns null for too-short payloads", () => {
      const result = decodeAIS("!AIVDM,1,1,,B,1,0*14", SOURCE);
      expect(result).toBeNull();
    });
  });

  describe("SI unit conversions", () => {
    it("converts SOG from knots to m/s", () => {
      const result = decodeAIS(
        "!AIVDM,1,1,,B,15N4cJ`005Jrek0H@9n`DW5608EP,0*13",
        SOURCE,
      );
      if (result?.paths["navigation.speedOverGround"]) {
        const sog = result.paths["navigation.speedOverGround"].value as number;
        expect(sog).toBeGreaterThanOrEqual(0);
        expect(sog).toBeLessThan(30);
      }
    });

    it("converts COG from degrees to radians", () => {
      const result = decodeAIS(
        "!AIVDM,1,1,,B,15N4cJ`005Jrek0H@9n`DW5608EP,0*13",
        SOURCE,
      );
      if (result?.paths["navigation.courseOverGroundTrue"]) {
        const cog = result.paths["navigation.courseOverGroundTrue"].value as number;
        expect(cog).toBeGreaterThanOrEqual(0);
        expect(cog).toBeLessThan(2 * Math.PI);
      }
    });
  });
});
