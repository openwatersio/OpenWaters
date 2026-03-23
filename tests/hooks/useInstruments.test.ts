import {
  clearInstruments,
  getInstrumentData,
  isStale,
  resetInstrumentStore,
  updatePath,
  updatePaths,
} from "@/hooks/useInstruments";

beforeEach(() => {
  resetInstrumentStore();
});

describe("useInstruments", () => {
  it("starts with empty data", () => {
    expect(getInstrumentData()).toEqual({});
  });

  describe("updatePath", () => {
    it("writes a single data point", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: 1000,
        source: "test",
      });

      const point = getInstrumentData()["environment.depth.belowTransducer"];
      expect(point).toBeDefined();
      expect(point.value).toBe(8.7);
      expect(point.timestamp).toBe(1000);
      expect(point.source).toBe("test");
    });

    it("overwrites an existing path", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: 1000,
        source: "test",
      });
      updatePath("environment.depth.belowTransducer", {
        value: 12.3,
        timestamp: 2000,
        source: "test",
      });

      const point = getInstrumentData()["environment.depth.belowTransducer"];
      expect(point.value).toBe(12.3);
      expect(point.timestamp).toBe(2000);
    });

    it("preserves other paths when updating one", () => {
      updatePath("navigation.speedOverGround", {
        value: 3.5,
        timestamp: 1000,
        source: "test",
      });
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: 1000,
        source: "test",
      });

      expect(getInstrumentData()["navigation.speedOverGround"]).toBeDefined();
      expect(
        getInstrumentData()["environment.depth.belowTransducer"],
      ).toBeDefined();
    });

    it("stores metadata when provided", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: 1000,
        source: "nmea.tcp.192.168.1.1:10110",
        meta: { sentence: "DBT", talker: "SD" },
      });

      const point = getInstrumentData()["environment.depth.belowTransducer"];
      expect(point.meta?.sentence).toBe("DBT");
      expect(point.meta?.talker).toBe("SD");
    });
  });

  describe("updatePaths", () => {
    it("writes multiple paths at once", () => {
      updatePaths({
        "navigation.speedOverGround": {
          value: 3.5,
          timestamp: 1000,
          source: "test",
        },
        "navigation.courseOverGroundTrue": {
          value: 1.57,
          timestamp: 1000,
          source: "test",
        },
      });

      const data = getInstrumentData();
      expect(data["navigation.speedOverGround"]?.value).toBe(3.5);
      expect(data["navigation.courseOverGroundTrue"]?.value).toBe(1.57);
    });

    it("preserves existing paths not in the update", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: 1000,
        source: "test",
      });
      updatePaths({
        "navigation.speedOverGround": {
          value: 3.5,
          timestamp: 2000,
          source: "test",
        },
      });

      expect(
        getInstrumentData()["environment.depth.belowTransducer"]?.value,
      ).toBe(8.7);
    });
  });

  describe("isStale", () => {
    it("returns true for missing paths", () => {
      expect(isStale("nonexistent.path", 10_000)).toBe(true);
    });

    it("returns false for fresh data", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: Date.now(),
        source: "test",
      });
      expect(isStale("environment.depth.belowTransducer", 10_000)).toBe(false);
    });

    it("returns true for old data", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: Date.now() - 20_000,
        source: "test",
      });
      expect(isStale("environment.depth.belowTransducer", 10_000)).toBe(true);
    });
  });

  describe("clearInstruments", () => {
    it("removes all data", () => {
      updatePath("environment.depth.belowTransducer", {
        value: 8.7,
        timestamp: 1000,
        source: "test",
      });
      clearInstruments();
      expect(getInstrumentData()).toEqual({});
    });
  });
});
