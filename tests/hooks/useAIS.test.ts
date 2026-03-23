import {
  clearAIS,
  flushAIS,
  pruneStaleVessels,
  updateAISVessel,
  useAIS,
} from "@/hooks/useAIS";

const initialState = useAIS.getState();

beforeEach(() => {
  useAIS.setState(initialState, true);
});

describe("useAIS", () => {
  it("starts with no vessels", () => {
    expect(useAIS.getState().vessels).toEqual({});
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

      const vessel = useAIS.getState().vessels["211234567"];
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

      const vessel = useAIS.getState().vessels["211234567"];
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

      const vessel = useAIS.getState().vessels["211234567"];
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

      const vessels = useAIS.getState().vessels;
      expect(Object.keys(vessels)).toHaveLength(2);
      expect(vessels["211234567"].data["navigation.speedOverGround"]?.value).toBe(3.5);
      expect(vessels["311234567"].data["navigation.speedOverGround"]?.value).toBe(5.0);
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
      useAIS.setState((s) => ({
        vessels: {
          ...s.vessels,
          "311234567": {
            ...s.vessels["311234567"],
            lastSeen: Date.now() - 15 * 60 * 1000, // 15 min ago
          },
        },
      }));

      pruneStaleVessels(10 * 60 * 1000); // 10 min threshold

      const vessels = useAIS.getState().vessels;
      expect(vessels["211234567"]).toBeDefined();
      expect(vessels["311234567"]).toBeUndefined();
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
      expect(Object.keys(useAIS.getState().vessels)).toHaveLength(1);
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
      expect(useAIS.getState().vessels).toEqual({});
    });
  });
});
