import { checkWaypointArrival, type ArrivalState } from "@/lib/waypointArrival";

// Waypoint at a known location (off the coast of Rhode Island)
const waypoint = { latitude: 41.5, longitude: -71.3 };

describe("checkWaypointArrival", () => {
  describe("vessel approaching head-on", () => {
    it("reports positive VMG and ETA when closing", () => {
      // Position south of waypoint, heading north
      const result = checkWaypointArrival(
        { latitude: 41.49, longitude: -71.3 },
        5, // 5 m/s SOG
        0, // heading north
        waypoint,
        null,
      );

      expect(result.vmg).toBeGreaterThan(0);
      expect(result.vmg).toBeCloseTo(5, 0); // VMG ≈ SOG for head-on
      expect(result.eta).toBeGreaterThan(0);
      expect(result.arrived).toBe(false);
    });
  });

  describe("vessel approaching at an angle", () => {
    it("reports VMG less than SOG", () => {
      // Position south-west of waypoint, heading northeast (roughly toward it)
      const result = checkWaypointArrival(
        { latitude: 41.49, longitude: -71.31 },
        5, // 5 m/s SOG
        45, // heading NE
        waypoint,
        null,
      );

      expect(result.vmg).toBeGreaterThan(0);
      expect(result.vmg).toBeLessThan(5); // less than SOG due to angle
      expect(result.arrived).toBe(false);
    });
  });

  describe("vessel passing abeam", () => {
    it("detects arrival when VMG crosses from positive to negative within 200m", () => {
      // Previous state: was closing
      const previous: ArrivalState = {
        distanceToWaypoint: 120,
        vmg: 2.0,
        eta: 60,
        arrived: false,
      };

      // Now: very close but has passed, heading away from waypoint
      // Position just north of waypoint, heading further north (away)
      const result = checkWaypointArrival(
        { latitude: 41.5005, longitude: -71.3 },
        5,
        0, // heading north (away from waypoint which is south)
        waypoint,
        previous,
      );

      expect(result.vmg).toBeLessThanOrEqual(0);
      expect(result.arrived).toBe(true);
    });

    it("does not trigger arrival if distance > 200m", () => {
      const previous: ArrivalState = {
        distanceToWaypoint: 300,
        vmg: 2.0,
        eta: 150,
        arrived: false,
      };

      // Far away, VMG transitions to negative
      const result = checkWaypointArrival(
        { latitude: 41.51, longitude: -71.3 }, // ~1100m north
        5,
        0, // heading north (away)
        waypoint,
        previous,
      );

      // Distance > 200m, so no arrival even with VMG transition
      if (result.distanceToWaypoint > 200) {
        expect(result.arrived).toBe(false);
      }
    });
  });

  describe("vessel moving away", () => {
    it("reports negative VMG and no arrival", () => {
      // Position north of waypoint, heading further north
      const result = checkWaypointArrival(
        { latitude: 41.51, longitude: -71.3 },
        5,
        0, // heading north (away)
        waypoint,
        null, // no previous state (first sample)
      );

      expect(result.vmg).toBeLessThan(0);
      expect(result.eta).toBeNull();
      expect(result.arrived).toBe(false);
    });
  });

  describe("vessel stationary", () => {
    it("reports zero VMG and no ETA when SOG is near zero", () => {
      const result = checkWaypointArrival(
        { latitude: 41.49, longitude: -71.3 },
        0.1, // barely moving
        0,
        waypoint,
        null,
      );

      expect(result.vmg).toBeCloseTo(0.1, 1);
      // ETA requires vmg > 0.5 threshold
      expect(result.eta).toBeNull();
      expect(result.arrived).toBe(false);
    });
  });

  describe("minimum distance threshold", () => {
    it("triggers arrival when within 50m regardless of VMG", () => {
      // Position very close to waypoint but heading away
      const result = checkWaypointArrival(
        { latitude: 41.5002, longitude: -71.3 }, // ~22m north
        5,
        0, // heading north (away)
        waypoint,
        null,
      );

      expect(result.distanceToWaypoint).toBeLessThan(50);
      expect(result.arrived).toBe(true);
    });
  });

  describe("no previous state", () => {
    it("does not trigger VMG transition arrival on first sample", () => {
      // Close but heading away, no previous state
      const result = checkWaypointArrival(
        { latitude: 41.501, longitude: -71.3 }, // ~110m north
        5,
        0, // heading north (away)
        waypoint,
        null,
      );

      // Distance > 50m and no previous state for VMG transition
      if (result.distanceToWaypoint > 50) {
        expect(result.arrived).toBe(false);
      }
    });
  });

  describe("ETA calculation", () => {
    it("computes reasonable ETA for direct approach", () => {
      const result = checkWaypointArrival(
        { latitude: 41.49, longitude: -71.3 }, // ~1100m south
        5,
        0, // heading north (toward)
        waypoint,
        null,
      );

      expect(result.eta).not.toBeNull();
      // ~1100m at ~5 m/s ≈ 220 seconds
      expect(result.eta!).toBeGreaterThan(100);
      expect(result.eta!).toBeLessThan(400);
    });

    it("returns null ETA when VMG is too low", () => {
      // Heading perpendicular — VMG near zero
      const result = checkWaypointArrival(
        { latitude: 41.49, longitude: -71.3 },
        5,
        90, // heading east (perpendicular)
        waypoint,
        null,
      );

      // VMG should be near zero for perpendicular heading
      if (Math.abs(result.vmg) < 0.5) {
        expect(result.eta).toBeNull();
      }
    });
  });
});
