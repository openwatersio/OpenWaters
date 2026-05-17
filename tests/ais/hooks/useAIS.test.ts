import {
  aisState,
  clearAIS,
  flushAIS,
  pruneStaleVessels,
  shouldAccept,
  updateAISVessel,
  vesselPrimarySource,
} from "@/ais/hooks/useAIS";

beforeEach(() => {
  clearAIS();
});

describe("useAIS", () => {
  it("starts with no vessels", () => {
    expect(aisState.vessels).toEqual({});
  });

  describe("updateAISVessel", () => {
    it("creates a new vessel entry", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "test",
        },
      });
      flushAIS();

      const vessel = aisState.vessels["211234567"];
      expect(vessel).toBeDefined();
      expect(vessel.mmsi).toBe("211234567");
      expect(vessel.data["navigation.position"]?.value).toEqual({
        latitude: 47.6,
        longitude: -122.3,
      });
    });

    it("updates lastSeen on each update", () => {
      const before = Date.now();
      updateAISVessel("211234567", {
        "navigation.speedOverGround": {
          value: 3.5,
          timestamp: 1000,
          source: "test",
        },
      });
      flushAIS();
      const after = Date.now();

      const vessel = aisState.vessels["211234567"];
      expect(vessel.lastSeen).toBeGreaterThanOrEqual(before);
      expect(vessel.lastSeen).toBeLessThanOrEqual(after);
    });

    it("merges new paths with existing vessel data", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "test",
        },
      });
      updateAISVessel("211234567", {
        "navigation.speedOverGround": {
          value: 3.5,
          timestamp: 2000,
          source: "test",
        },
      });
      flushAIS();

      const vessel = aisState.vessels["211234567"];
      expect(vessel.data["navigation.position"]).toBeDefined();
      expect(vessel.data["navigation.speedOverGround"]?.value).toBe(3.5);
    });

    it("tracks multiple vessels independently", () => {
      updateAISVessel("211234567", {
        "navigation.speedOverGround": {
          value: 3.5,
          timestamp: 1000,
          source: "test",
        },
      });
      updateAISVessel("311234567", {
        "navigation.speedOverGround": {
          value: 5.0,
          timestamp: 1000,
          source: "test",
        },
      });
      flushAIS();

      expect(Object.keys(aisState.vessels)).toHaveLength(2);
      expect(aisState.vessels["211234567"].data["navigation.speedOverGround"]?.value).toBe(3.5);
      expect(aisState.vessels["311234567"].data["navigation.speedOverGround"]?.value).toBe(5.0);
    });
  });

  describe("pruneStaleVessels", () => {
    it("removes vessels older than maxAge", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: Date.now(),
          source: "test",
        },
      });
      updateAISVessel("311234567", {
        "navigation.position": {
          value: { latitude: 48.0, longitude: -123.0 },
          timestamp: Date.now(),
          source: "test",
        },
      });
      flushAIS();

      // Manually backdate
      aisState.vessels["311234567"].lastSeen = Date.now() - 15 * 60 * 1000;

      pruneStaleVessels(10 * 60 * 1000); // 10 min threshold

      expect(aisState.vessels["211234567"]).toBeDefined();
      expect(aisState.vessels["311234567"]).toBeUndefined();
    });

    it("keeps all vessels if none are stale", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: Date.now(),
          source: "test",
        },
      });
      flushAIS();

      pruneStaleVessels(10 * 60 * 1000);
      expect(Object.keys(aisState.vessels)).toHaveLength(1);
    });
  });

  describe("clearAIS", () => {
    it("removes all vessels", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "test",
        },
      });
      flushAIS();
      clearAIS();
      expect(aisState.vessels).toEqual({});
    });
  });

  describe("shouldAccept", () => {
    it("accepts when nothing exists yet", () => {
      expect(
        shouldAccept(undefined, { value: 1, timestamp: 100, source: "x" }),
      ).toBe(true);
    });

    it("accepts strictly-newer timestamps", () => {
      expect(
        shouldAccept(
          { value: 1, timestamp: 100, source: "a" },
          { value: 2, timestamp: 101, source: "b" },
        ),
      ).toBe(true);
    });

    it("drops older timestamps", () => {
      expect(
        shouldAccept(
          { value: 1, timestamp: 100, source: "a" },
          { value: 2, timestamp: 99, source: "b" },
        ),
      ).toBe(false);
    });

    it("drops equal timestamps", () => {
      // Same broadcast received via two pipes — first writer wins, no overwrite.
      expect(
        shouldAccept(
          { value: 1, timestamp: 100, source: "a" },
          { value: 2, timestamp: 100, source: "b" },
        ),
      ).toBe(false);
    });
  });

  describe("merge gate in updateAISVessel", () => {
    it("drops older-timestamp updates for an existing path", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 2000,
          source: "signalk.local",
        },
      });
      flushAIS();
      // Older timestamp from another source — should not overwrite.
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 0, longitude: 0 },
          timestamp: 1000,
          source: "aisstream",
        },
      });
      flushAIS();

      const dp = aisState.vessels["211234567"].data["navigation.position"];
      expect(dp?.value).toEqual({ latitude: 47.6, longitude: -122.3 });
      expect(dp?.source).toBe("signalk.local");
    });

    it("accepts newer-timestamp updates from any source", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "aisstream",
        },
      });
      flushAIS();
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 48.0, longitude: -123.0 },
          timestamp: 2000,
          source: "signalk.local",
        },
      });
      flushAIS();

      const dp = aisState.vessels["211234567"].data["navigation.position"];
      expect(dp?.value).toEqual({ latitude: 48.0, longitude: -123.0 });
      expect(dp?.source).toBe("signalk.local");
    });

    it("merges different paths from different sources", () => {
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "signalk.local",
        },
      });
      updateAISVessel("211234567", {
        "design.aisShipType": {
          value: 70,
          timestamp: 2000,
          source: "aisstream",
        },
      });
      flushAIS();

      const vessel = aisState.vessels["211234567"];
      expect(vessel.data["navigation.position"]?.source).toBe("signalk.local");
      expect(vessel.data["design.aisShipType"]?.source).toBe("aisstream");
    });

    it("collapses older-then-newer within a single flush window", () => {
      // First call: queue an older value into the buffer.
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 0, longitude: 0 },
          timestamp: 1000,
          source: "aisstream",
        },
      });
      // Second call before flush: newer value should replace the buffered one.
      updateAISVessel("211234567", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 2000,
          source: "signalk.local",
        },
      });
      flushAIS();

      const dp = aisState.vessels["211234567"].data["navigation.position"];
      expect(dp?.value).toEqual({ latitude: 47.6, longitude: -122.3 });
      expect(dp?.source).toBe("signalk.local");
    });
  });

  describe("vesselPrimarySource", () => {
    it("returns 'unknown' when the vessel has no data", () => {
      expect(
        vesselPrimarySource({ mmsi: "211234567", data: {}, lastSeen: 0 }),
      ).toBe("unknown");
    });

    it("identifies signalk family by prefix", () => {
      expect(
        vesselPrimarySource({
          mmsi: "211234567",
          lastSeen: 0,
          data: {
            "navigation.position": {
              value: { latitude: 0, longitude: 0 },
              timestamp: 100,
              source: "signalk.signalk-abc",
            },
          },
        }),
      ).toBe("signalk");
    });

    it("identifies nmea family by prefix", () => {
      expect(
        vesselPrimarySource({
          mmsi: "211234567",
          lastSeen: 0,
          data: {
            "navigation.position": {
              value: { latitude: 0, longitude: 0 },
              timestamp: 100,
              source: "nmea.nmea-tcp-xyz",
            },
          },
        }),
      ).toBe("nmea");
    });

    it("identifies aisstream by exact match", () => {
      expect(
        vesselPrimarySource({
          mmsi: "211234567",
          lastSeen: 0,
          data: {
            "navigation.position": {
              value: { latitude: 0, longitude: 0 },
              timestamp: 100,
              source: "aisstream",
            },
          },
        }),
      ).toBe("aisstream");
    });

    it("returns the family of the most-recent timestamp when sources mix", () => {
      // Old AIS Stream + newer Signal K → Signal K wins.
      expect(
        vesselPrimarySource({
          mmsi: "211234567",
          lastSeen: 0,
          data: {
            "design.aisShipType": {
              value: 70,
              timestamp: 100,
              source: "aisstream",
            },
            "navigation.position": {
              value: { latitude: 0, longitude: 0 },
              timestamp: 200,
              source: "signalk.local",
            },
          },
        }),
      ).toBe("signalk");
    });
  });
});
