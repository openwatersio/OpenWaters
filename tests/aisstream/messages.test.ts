import type { DataPoint } from "@/instruments/hooks/useInstruments";
import {
  type AISStreamDecodeResult,
  AISSTREAM_SOURCE,
  decodeAISStreamMessage,
} from "@/aisstream/messages";

const TIME = "2022-12-29 18:22:32.318353 +0000 UTC";
const TIME_MS = Date.parse("2022-12-29 18:22:32.318353 +0000");

function expectVessel(
  result: AISStreamDecodeResult,
): asserts result is {
  kind: "vessel";
  mmsi: string;
  paths: Record<string, DataPoint>;
} {
  if (result?.kind !== "vessel") {
    throw new Error(`expected vessel result, got ${result?.kind ?? "null"}`);
  }
}

function expectAton(
  result: AISStreamDecodeResult,
): asserts result is {
  kind: "aton";
  id: string;
  paths: Record<string, DataPoint>;
} {
  if (result?.kind !== "aton") {
    throw new Error(`expected aton result, got ${result?.kind ?? "null"}`);
  }
}

describe("decodeAISStreamMessage", () => {
  it("decodes a Class A PositionReport", () => {
    const result = decodeAISStreamMessage({
      MessageType: "PositionReport",
      MetaData: {
        MMSI: 245473000,
        ShipName: "TEST VESSEL",
        time_utc: TIME,
      },
      Message: {
        PositionReport: {
          Latitude: 51.4445,
          Longitude: 3.5908,
          Cog: 180,
          Sog: 10,
          TrueHeading: 175,
          NavigationalStatus: 0,
        },
      },
    });

    expectVessel(result);
    expect(result.mmsi).toBe("245473000");
    const paths = result.paths;

    expect(paths["navigation.position"]?.value).toEqual({
      latitude: 51.4445,
      longitude: 3.5908,
    });
    expect(paths["navigation.position"]?.timestamp).toBe(TIME_MS);
    expect(paths["navigation.position"]?.source).toBe(AISSTREAM_SOURCE);

    expect(paths["navigation.courseOverGroundTrue"]?.value).toBeCloseTo(Math.PI);
    expect(paths["navigation.speedOverGround"]?.value).toBeCloseTo(5.14444, 4);
    expect(paths["navigation.headingTrue"]?.value).toBeCloseTo(
      (175 * Math.PI) / 180,
    );
    expect(paths["navigation.state"]?.value).toBe(0);
    expect(paths["name"]?.value).toBe("TEST VESSEL");
  });

  it("drops TrueHeading sentinel 511", () => {
    const result = decodeAISStreamMessage({
      MessageType: "StandardClassBPositionReport",
      MetaData: { MMSI: 367000980, time_utc: TIME },
      Message: {
        StandardClassBPositionReport: {
          Latitude: 39.5,
          Longitude: 2.6,
          Cog: 210,
          Sog: 0,
          TrueHeading: 511,
        },
      },
    });
    expect(result?.paths["navigation.headingTrue"]).toBeUndefined();
    expect(result?.paths["navigation.courseOverGroundTrue"]).toBeDefined();
  });

  it("decodes Class B with no static data", () => {
    const result = decodeAISStreamMessage({
      MessageType: "StandardClassBPositionReport",
      MetaData: { MMSI: 367000980, ShipName: "B-VESSEL", time_utc: TIME },
      Message: {
        StandardClassBPositionReport: {
          Latitude: 39.5,
          Longitude: 2.6,
          Cog: 0,
          Sog: 0,
        },
      },
    });
    expectVessel(result);
    expect(result.mmsi).toBe("367000980");
    expect(result.paths["name"]?.value).toBe("B-VESSEL");
    expect(result.paths["design.length"]).toBeUndefined();
  });

  it("decodes ExtendedClassBPositionReport with dimensions", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ExtendedClassBPositionReport",
      MetaData: { MMSI: 225111802, time_utc: TIME },
      Message: {
        ExtendedClassBPositionReport: {
          Latitude: 22.31,
          Longitude: 114.51,
          Cog: 234.5,
          Sog: 0,
          TrueHeading: 511,
          Type: 60,
          Name: "EXT-B",
          Dimension: { A: 10, B: 20, C: 3, D: 4 },
        },
      },
    });
    expect(result?.paths["design.length"]?.value).toBe(30);
    expect(result?.paths["design.beam"]?.value).toBe(7);
    expect(result?.paths["design.aisShipType"]?.value).toBe(60);
    expect(result?.paths["name"]?.value).toBe("EXT-B");
  });

  it("decodes ShipStaticData with all fields", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 257069200, ShipName: "KV FARM", time_utc: TIME },
      Message: {
        ShipStaticData: {
          Type: 55,
          CallSign: "LBHF",
          Destination: "ROTTERDAM@@@@@@@@@",
          ImoNumber: 9353333,
          MaximumStaticDraught: 4.5,
          Dimension: { A: 20, B: 27, C: 7, D: 7 },
        },
      },
    });

    const paths = result!.paths;
    expect(paths["design.aisShipType"]?.value).toBe(55);
    expect(paths["communication.callsignVhf"]?.value).toBe("LBHF");
    expect(paths["navigation.destination"]?.value).toBe("ROTTERDAM");
    expect(paths["registrations.imo"]?.value).toBe("9353333");
    expect(paths["design.draft"]?.value).toBe(4.5);
    expect(paths["design.length"]?.value).toBe(47);
    expect(paths["design.beam"]?.value).toBe(14);
  });

  it("falls back to Date.now() when time_utc is unparseable", () => {
    const before = Date.now();
    const result = decodeAISStreamMessage({
      MessageType: "PositionReport",
      MetaData: { MMSI: 211234567, time_utc: "garbage" },
      Message: {
        PositionReport: { Latitude: 47.6, Longitude: -122.3 },
      },
    });
    const after = Date.now();
    const ts = result!.paths["navigation.position"]!.timestamp;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("returns null when MMSI is missing", () => {
    expect(
      decodeAISStreamMessage({
        MessageType: "PositionReport",
        MetaData: {},
        Message: { PositionReport: { Latitude: 47.6, Longitude: -122.3 } },
      }),
    ).toBeNull();
  });

  it("returns null when no decodable fields are present", () => {
    expect(
      decodeAISStreamMessage({
        MessageType: "BaseStationReport",
        MetaData: { MMSI: 211234567, time_utc: TIME },
        Message: {},
      }),
    ).toBeNull();
  });

  it("ignores ImoNumber when zero", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 211234567, time_utc: TIME },
      Message: {
        ShipStaticData: { Type: 70, ImoNumber: 0 },
      },
    });
    expect(result?.paths["registrations.imo"]).toBeUndefined();
  });

  it("extracts RateOfTurn as rad/s", () => {
    // 60 deg/min → 1 deg/s → π/180 rad/s
    const result = decodeAISStreamMessage({
      MessageType: "PositionReport",
      MetaData: { MMSI: 211234567, time_utc: TIME },
      Message: {
        PositionReport: {
          Latitude: 47.6,
          Longitude: -122.3,
          RateOfTurn: 60,
        },
      },
    });
    expect(result?.paths["navigation.rateOfTurn"]?.value).toBeCloseTo(
      Math.PI / 180,
      6,
    );
  });

  it("drops RateOfTurn sentinel -128", () => {
    const result = decodeAISStreamMessage({
      MessageType: "PositionReport",
      MetaData: { MMSI: 211234567, time_utc: TIME },
      Message: {
        PositionReport: {
          Latitude: 47.6,
          Longitude: -122.3,
          RateOfTurn: -128,
        },
      },
    });
    expect(result?.paths["navigation.rateOfTurn"]).toBeUndefined();
  });

  it("formats ETA as MM-DDTHH:MM with zero-padding", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 211234567, time_utc: TIME },
      Message: {
        ShipStaticData: {
          Type: 70,
          Eta: { Month: 3, Day: 7, Hour: 14, Minute: 5 },
        },
      },
    });
    expect(result?.paths["navigation.eta"]?.value).toBe("03-07T14:05");
  });

  it("drops ETA when Month or Day is zero (AIS 'not available')", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 211234567, time_utc: TIME },
      Message: {
        ShipStaticData: {
          Type: 70,
          Eta: { Month: 0, Day: 0, Hour: 0, Minute: 0 },
        },
      },
    });
    expect(result?.paths["navigation.eta"]).toBeUndefined();
  });

  it("falls back to MetaData position when inner message lacks one", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: {
        MMSI: 211234567,
        latitude: 47.6,
        longitude: -122.3,
        time_utc: TIME,
      },
      Message: {
        ShipStaticData: { Type: 70, CallSign: "WDA1234" },
      },
    });
    expect(result?.paths["navigation.position"]?.value).toEqual({
      latitude: 47.6,
      longitude: -122.3,
    });
  });

  it("does not overwrite inner-message position with MetaData", () => {
    // PositionReport has Lat/Lng; MetaData also has them. Inner wins.
    const result = decodeAISStreamMessage({
      MessageType: "PositionReport",
      MetaData: {
        MMSI: 211234567,
        latitude: 0,
        longitude: 0,
        time_utc: TIME,
      },
      Message: {
        PositionReport: { Latitude: 47.6, Longitude: -122.3 },
      },
    });
    expect(result?.paths["navigation.position"]?.value).toEqual({
      latitude: 47.6,
      longitude: -122.3,
    });
  });

  it("ignores MetaData (0, 0) null-island sentinel", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 211234567, latitude: 0, longitude: 0, time_utc: TIME },
      Message: { ShipStaticData: { Type: 70 } },
    });
    expect(result?.paths["navigation.position"]).toBeUndefined();
  });

  it("drops empty trimmed strings", () => {
    const result = decodeAISStreamMessage({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 211234567, ShipName: "@@@@@@@@@@", time_utc: TIME },
      Message: { ShipStaticData: { Type: 70, Destination: "@@@@@" } },
    });
    expect(result?.paths["name"]).toBeUndefined();
    expect(result?.paths["navigation.destination"]).toBeUndefined();
  });

  describe("StaticDataReport (Type 24)", () => {
    it("decodes Part A (name only)", () => {
      const result = decodeAISStreamMessage({
        MessageType: "StaticDataReport",
        MetaData: { MMSI: 367000980, time_utc: TIME },
        Message: {
          StaticDataReport: {
            PartNumber: false,
            ReportA: { Name: "CLASS B BOAT@@" },
          },
        },
      });
      expectVessel(result);
      expect(result.paths["name"]?.value).toBe("CLASS B BOAT");
    });

    it("decodes Part B (ship type, call sign, dimensions)", () => {
      const result = decodeAISStreamMessage({
        MessageType: "StaticDataReport",
        MetaData: { MMSI: 367000980, time_utc: TIME },
        Message: {
          StaticDataReport: {
            PartNumber: true,
            ReportB: {
              ShipType: 37,
              CallSign: "WDF1234",
              Dimension: { A: 4, B: 6, C: 1, D: 2 },
            },
          },
        },
      });
      expectVessel(result);
      expect(result.paths["design.aisShipType"]?.value).toBe(37);
      expect(result.paths["communication.callsignVhf"]?.value).toBe("WDF1234");
      expect(result.paths["design.length"]?.value).toBe(10);
      expect(result.paths["design.beam"]?.value).toBe(3);
    });
  });

  describe("AidsToNavigationReport (Type 21)", () => {
    it("decodes AtoN with all fields and routes to the AtoN store", () => {
      const result = decodeAISStreamMessage({
        MessageType: "AidsToNavigationReport",
        MetaData: { MMSI: 993661302, time_utc: TIME },
        Message: {
          AidsToNavigationReport: {
            Type: 5,
            Name: "BUOY 12",
            Latitude: 47.6,
            Longitude: -122.3,
            OffPosition: false,
            VirtualAtoN: true,
          },
        },
      });
      expectAton(result);
      expect(result.id).toBe("993661302");
      expect(result.paths["mmsi"]?.value).toBe("993661302");
      expect(result.paths["atonType"]?.value).toBe(5);
      expect(result.paths["name"]?.value).toBe("BUOY 12");
      expect(result.paths["navigation.position"]?.value).toEqual({
        latitude: 47.6,
        longitude: -122.3,
      });
      // Encoded as 1/0 since DataPoint.value doesn't include boolean today.
      expect(result.paths["offPosition"]?.value).toBe(0);
      expect(result.paths["virtual"]?.value).toBe(1);
    });

    it("concatenates Name + NameExtension before trimming", () => {
      // Type 21 Name is 14 chars + an optional NameExtension. If the base name
      // is exactly 14 chars and the extension carries the rest, trimming the
      // base alone would lose the extension.
      const result = decodeAISStreamMessage({
        MessageType: "AidsToNavigationReport",
        MetaData: { MMSI: 993661302, time_utc: TIME },
        Message: {
          AidsToNavigationReport: {
            Type: 5,
            Name: "LIGHTHOUSE TIL",
            NameExtension: "LAMOOK HEAD",
            Latitude: 45.94,
            Longitude: -123.97,
          },
        },
      });
      expectAton(result);
      expect(result.paths["name"]?.value).toBe("LIGHTHOUSE TILLAMOOK HEAD");
    });

    it("falls back to MetaData position when inner lacks one", () => {
      const result = decodeAISStreamMessage({
        MessageType: "AidsToNavigationReport",
        MetaData: {
          MMSI: 993661302,
          latitude: 47.6,
          longitude: -122.3,
          time_utc: TIME,
        },
        Message: {
          AidsToNavigationReport: { Type: 5, Name: "BUOY 12" },
        },
      });
      expectAton(result);
      expect(result.paths["navigation.position"]?.value).toEqual({
        latitude: 47.6,
        longitude: -122.3,
      });
    });
  });

  describe("LongRangeAisBroadcastMessage (Type 27)", () => {
    it("decodes via the same paths as PositionReport", () => {
      const result = decodeAISStreamMessage({
        MessageType: "LongRangeAisBroadcastMessage",
        MetaData: { MMSI: 211234567, time_utc: TIME },
        Message: {
          LongRangeAisBroadcastMessage: {
            Latitude: -34.5,
            Longitude: 18.4,
            Cog: 90,
            Sog: 12,
            NavigationalStatus: 0,
          },
        },
      });
      expectVessel(result);
      expect(result.paths["navigation.position"]?.value).toEqual({
        latitude: -34.5,
        longitude: 18.4,
      });
      expect(result.paths["navigation.courseOverGroundTrue"]?.value).toBeCloseTo(
        Math.PI / 2,
      );
      expect(result.paths["navigation.speedOverGround"]?.value).toBeCloseTo(
        12 * 0.514444,
        4,
      );
      expect(result.paths["navigation.state"]?.value).toBe(0);
    });
  });

  describe("StandardSearchAndRescueAircraftReport (Type 9)", () => {
    it("decodes SAR aircraft position", () => {
      const result = decodeAISStreamMessage({
        MessageType: "StandardSearchAndRescueAircraftReport",
        MetaData: {
          MMSI: 111232450,
          ShipName: "USCG HELO",
          time_utc: TIME,
        },
        Message: {
          StandardSearchAndRescueAircraftReport: {
            Latitude: 36.5,
            Longitude: -75.0,
            Cog: 180,
            Sog: 120,
          },
        },
      });
      expectVessel(result);
      expect(result.mmsi).toBe("111232450");
      expect(result.paths["name"]?.value).toBe("USCG HELO");
      expect(result.paths["navigation.position"]?.value).toEqual({
        latitude: 36.5,
        longitude: -75.0,
      });
      expect(result.paths["navigation.speedOverGround"]?.value).toBeCloseTo(
        120 * 0.514444,
        3,
      );
    });
  });
});
