import {
  atonState,
  clearAtoN,
  pruneStaleAtoNs,
  updateAtoN,
} from "@/aton/hooks/useAtoN";

beforeEach(() => {
  clearAtoN();
});

describe("useAtoN", () => {
  it("starts with no AtoNs", () => {
    expect(atonState.atons).toEqual({});
  });

  describe("updateAtoN", () => {
    it("creates a new AtoN entry", () => {
      updateAtoN("993661302", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "test",
        },
      });

      const aton = atonState.atons["993661302"];
      expect(aton).toBeDefined();
      expect(aton.id).toBe("993661302");
      expect(aton.data["navigation.position"]?.value).toEqual({
        latitude: 47.6,
        longitude: -122.3,
      });
    });

    it("updates lastSeen on each update", () => {
      const before = Date.now();
      updateAtoN("993661302", {
        "atonType": {
          value: 21,
          timestamp: 1000,
          source: "test",
        },
      });
      const after = Date.now();

      const aton = atonState.atons["993661302"];
      expect(aton.lastSeen).toBeGreaterThanOrEqual(before);
      expect(aton.lastSeen).toBeLessThanOrEqual(after);
    });

    it("merges new paths with existing AtoN data", () => {
      updateAtoN("993661302", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "test",
        },
      });
      updateAtoN("993661302", {
        "atonType": {
          value: 25,
          timestamp: 2000,
          source: "test",
        },
      });

      const aton = atonState.atons["993661302"];
      expect(aton.data["navigation.position"]).toBeDefined();
      expect(aton.data["atonType"]?.value).toBe(25);
    });

    it("tracks multiple AtoNs independently", () => {
      updateAtoN("993661302", {
        "atonType": {
          value: 21,
          timestamp: 1000,
          source: "test",
        },
      });
      updateAtoN("993661303", {
        "atonType": {
          value: 25,
          timestamp: 1000,
          source: "test",
        },
      });

      expect(Object.keys(atonState.atons)).toHaveLength(2);
      expect(atonState.atons["993661302"].data["atonType"]?.value).toBe(21);
      expect(atonState.atons["993661303"].data["atonType"]?.value).toBe(25);
    });
  });

  describe("pruneStaleAtoNs", () => {
    it("removes AtoNs older than maxAge", () => {
      updateAtoN("993661302", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: Date.now(),
          source: "test",
        },
      });

      updateAtoN("993661303", {
        "navigation.position": {
          value: { latitude: 48.0, longitude: -123.0 },
          timestamp: Date.now(),
          source: "test",
        },
      });
      // Manually backdate
      atonState.atons["993661303"].lastSeen = Date.now() - 2 * 60 * 60 * 1000;

      pruneStaleAtoNs(60 * 60 * 1000); // 1 hour threshold

      expect(atonState.atons["993661302"]).toBeDefined();
      expect(atonState.atons["993661303"]).toBeUndefined();
    });

    it("keeps all AtoNs if none are stale", () => {
      updateAtoN("993661302", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: Date.now(),
          source: "test",
        },
      });

      pruneStaleAtoNs(60 * 60 * 1000);
      expect(Object.keys(atonState.atons)).toHaveLength(1);
    });
  });

  describe("clearAtoN", () => {
    it("removes all AtoNs", () => {
      updateAtoN("993661302", {
        "navigation.position": {
          value: { latitude: 47.6, longitude: -122.3 },
          timestamp: 1000,
          source: "test",
        },
      });
      clearAtoN();
      expect(atonState.atons).toEqual({});
    });
  });
});
