import { checkWaypointArrival } from "@/lib/waypointArrival";

// Waypoint B at a known location (off the coast of Rhode Island).
const B = { latitude: 41.5, longitude: -71.3 };

// Helper: approximate lat/lon offset from a point (local flat-earth, OK for
// a few hundred meters). +north / +east in meters.
function offset(
  point: { latitude: number; longitude: number },
  northMeters: number,
  eastMeters: number,
) {
  const latRad = (point.latitude * Math.PI) / 180;
  return {
    latitude: point.latitude + northMeters / 110540,
    longitude: point.longitude + eastMeters / (111320 * Math.cos(latRad)),
  };
}

describe("checkWaypointArrival", () => {
  describe("arrival circle", () => {
    it("fires when inside the default 50m radius regardless of heading", () => {
      // 20m north of B, heading north (away from the approach).
      const result = checkWaypointArrival({
        position: offset(B, 20, 0),
        previousWaypoint: offset(B, -1000, 0), // 1 km south
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("circle");
    });

    it("does not fire when outside the radius", () => {
      const result = checkWaypointArrival({
        position: offset(B, -500, 0), // 500m south, still approaching
        previousWaypoint: offset(B, -1000, 0),
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.arrived).toBe(false);
    });

    it("caps the effective radius at 10% of leg length", () => {
      // Leg is only 200m long, so effective radius should be 20m, not 50m.
      // Position 30m before B along the leg → NOT inside 20m but would be inside 50m.
      const A = offset(B, -200, 0);
      const result = checkWaypointArrival({
        position: offset(B, -30, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.effectiveRadius).toBeCloseTo(20, 0);
      expect(result.arrived).toBe(false);
    });

    it("honors a custom arrival radius", () => {
      const result = checkWaypointArrival({
        position: offset(B, -80, 0),
        previousWaypoint: offset(B, -5000, 0), // long leg, no cap
        activeWaypoint: B,
        nextWaypoint: null,
        arrivalRadius: 100,
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("circle");
    });
  });

  describe("perpendicular (terminal leg, no next waypoint)", () => {
    const A = offset(B, -1000, 0); // 1 km south of B

    it("fires when the vessel has crossed the plane at B on-track", () => {
      // 80 m north of B, still on the A→B line (no lateral offset).
      const result = checkWaypointArrival({
        position: offset(B, 80, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("perpendicular");
    });

    it("does not fire before crossing the plane", () => {
      const result = checkWaypointArrival({
        position: offset(B, -300, 0), // still south of B
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.arrived).toBe(false);
    });

    it("does not fire when the vessel passes wide (cross-track gate)", () => {
      // 80 m past B but 500 m east (wide miss).
      const result = checkWaypointArrival({
        position: offset(B, 80, 500),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.arrived).toBe(false);
    });
  });

  describe("bisector (interior waypoints)", () => {
    // 90° right turn at B: A is 1 km south, C is 1 km east.
    const A = offset(B, -1000, 0);
    const C = offset(B, 0, 1000);

    it("fires on the bisector before reaching B", () => {
      // Vessel rounding the corner: 50 m before B along AB, 100 m east.
      // Projection onto the 45° bisector direction is positive → past the
      // arrival line. Not yet past B on the AB axis.
      const result = checkWaypointArrival({
        position: offset(B, -50, 100),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("bisector");
    });

    it("does not fire before the bisector", () => {
      // 200 m before B, only slightly toward C.
      const result = checkWaypointArrival({
        position: offset(B, -200, 20),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
      });
      expect(result.arrived).toBe(false);
    });

    it("does not fire when cross-track is too wide", () => {
      // Past the bisector but 500 m off-track.
      const result = checkWaypointArrival({
        position: offset(B, -50, 500),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
      });
      expect(result.arrived).toBe(false);
    });
  });

  describe("straight route (bisector ≈ perpendicular)", () => {
    const A = offset(B, -1000, 0);
    const C = offset(B, 1000, 0); // same bearing — essentially straight

    it("behaves like perpendicular", () => {
      const result = checkWaypointArrival({
        position: offset(B, 80, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
      });
      expect(result.arrived).toBe(true);
    });
  });

  describe("U-turn at B", () => {
    const A = offset(B, -1000, 0); // south
    const C = offset(B, -1000, 10); // also south (near U-turn)

    it("falls back to circle only — does not fire on overshoot", () => {
      // 80 m past B on the AB line: perpendicular would fire, but U-turn
      // should suppress it.
      const result = checkWaypointArrival({
        position: offset(B, 80, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
      });
      expect(result.arrived).toBe(false);
    });

    it("still fires on the arrival circle", () => {
      const result = checkWaypointArrival({
        position: offset(B, 20, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("circle");
    });
  });

  describe("first leg (no previous waypoint)", () => {
    it("only the circle can trigger", () => {
      // 80 m past B with no previous — perpendicular would fire if it could.
      const result = checkWaypointArrival({
        position: offset(B, 80, 0),
        previousWaypoint: null,
        activeWaypoint: B,
        nextWaypoint: offset(B, 1000, 0),
      });
      expect(result.arrived).toBe(false);
    });

    it("fires inside the circle", () => {
      const result = checkWaypointArrival({
        position: offset(B, 20, 0),
        previousWaypoint: null,
        activeWaypoint: B,
        nextWaypoint: offset(B, 1000, 0),
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("circle");
    });
  });

  describe("arriveOnCircleOnly", () => {
    const A = offset(B, -1000, 0);
    const C = offset(B, 0, 1000);

    it("suppresses the bisector trigger", () => {
      const result = checkWaypointArrival({
        position: offset(B, -100, 100), // would fire bisector normally
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
        arriveOnCircleOnly: true,
      });
      expect(result.arrived).toBe(false);
    });

    it("suppresses the perpendicular trigger", () => {
      const result = checkWaypointArrival({
        position: offset(B, 80, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: null,
        arriveOnCircleOnly: true,
      });
      expect(result.arrived).toBe(false);
    });

    it("still fires on the circle", () => {
      const result = checkWaypointArrival({
        position: offset(B, 20, 0),
        previousWaypoint: A,
        activeWaypoint: B,
        nextWaypoint: C,
        arriveOnCircleOnly: true,
      });
      expect(result.arrived).toBe(true);
      expect(result.trigger).toBe("circle");
    });
  });

  describe("geometry output", () => {
    it("returns null along/cross-track on the first leg", () => {
      const result = checkWaypointArrival({
        position: offset(B, -500, 0),
        previousWaypoint: null,
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.geometry.alongTrackPastB).toBeNull();
      expect(result.geometry.crossTrack).toBeNull();
      expect(result.geometry.rangeToB).toBeGreaterThan(400);
    });

    it("returns along/cross-track when a previous waypoint is given", () => {
      const result = checkWaypointArrival({
        position: offset(B, -500, 100),
        previousWaypoint: offset(B, -1000, 0),
        activeWaypoint: B,
        nextWaypoint: null,
      });
      expect(result.geometry.alongTrackPastB).not.toBeNull();
      expect(result.geometry.crossTrack).not.toBeNull();
      expect(Math.abs(result.geometry.crossTrack!)).toBeGreaterThan(50);
    });
  });
});
