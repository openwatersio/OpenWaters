import {
  calculateCPA,
  calculateDestinationProgress,
  calculateRouteLegs,
  calculateVMG,
  calculateWaypointProgress,
  formatBearing,
  headingDelta,
  legProgress,
} from "@/lib/geo";

// Local flat-earth offset helper used by legProgress tests.
function offsetPoint(
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

describe("headingDelta", () => {
  it("returns 0 for equal headings", () => {
    expect(headingDelta(90, 90)).toBe(0);
  });

  it("handles simple difference", () => {
    expect(headingDelta(10, 20)).toBe(10);
  });

  it("wraps around 360", () => {
    expect(headingDelta(350, 10)).toBe(20);
  });

  it("returns max 180", () => {
    expect(headingDelta(0, 180)).toBe(180);
  });
});

describe("calculateCPA", () => {
  const DEG = Math.PI / 180;

  it("returns null when both vessels are stationary", () => {
    expect(calculateCPA(
      { latitude: 47.6, longitude: -122.3, sog: 0, cog: 0 },
      { latitude: 47.61, longitude: -122.3, sog: 0, cog: 0 },
    )).toBeNull();
  });

  it("returns null when CPA is in the past (vessels diverging)", () => {
    const result = calculateCPA(
      { latitude: 47.6, longitude: -122.3, sog: 5, cog: 0 },
      { latitude: 47.65, longitude: -122.3, sog: 10, cog: 0 },
    );
    expect(result).toBeNull();
  });

  it("calculates CPA for head-on vessels", () => {
    const result = calculateCPA(
      { latitude: 47.0, longitude: -122.0, sog: 5, cog: 0 },
      { latitude: 47.1, longitude: -122.0, sog: 5, cog: 180 * DEG },
    );
    expect(result).not.toBeNull();
    expect(result!.distance).toBeLessThan(100);
    expect(result!.time).toBeGreaterThan(0);
  });

  it("calculates CPA for crossing vessels", () => {
    const result = calculateCPA(
      { latitude: 47.0, longitude: -122.0, sog: 5, cog: 0 },
      { latitude: 47.05, longitude: -121.95, sog: 5, cog: 270 * DEG },
    );
    expect(result).not.toBeNull();
    expect(result!.distance).toBeGreaterThan(0);
    expect(result!.time).toBeGreaterThan(0);
  });

  it("calculates reasonable TCPA for known scenario", () => {
    // Two vessels ~5.5km apart, closing at ~10 m/s combined
    const result = calculateCPA(
      { latitude: 47.0, longitude: -122.0, sog: 5, cog: 0 },
      { latitude: 47.05, longitude: -122.0, sog: 5, cog: 180 * DEG },
    );
    expect(result).not.toBeNull();
    expect(result!.time).toBeGreaterThan(400);
    expect(result!.time).toBeLessThan(700);
  });

  it("returns null for parallel vessels with same speed", () => {
    const result = calculateCPA(
      { latitude: 47.0, longitude: -122.0, sog: 5, cog: 0 },
      { latitude: 47.0, longitude: -121.99, sog: 5, cog: 0 },
    );
    expect(result).toBeNull();
  });

  it("handles one stationary vessel", () => {
    const result = calculateCPA(
      { latitude: 47.0, longitude: -122.0, sog: 5, cog: 0 },
      { latitude: 47.05, longitude: -122.001, sog: 0, cog: 0 },
    );
    expect(result).not.toBeNull();
    expect(result!.time).toBeGreaterThan(0);
    expect(result!.distance).toBeLessThan(200);
  });
});

describe("calculateVMG", () => {
  it("equals SOG when heading directly at target", () => {
    expect(calculateVMG(5, 90, 90)).toBeCloseTo(5, 5);
  });

  it("is zero when heading perpendicular to target", () => {
    expect(calculateVMG(5, 0, 90)).toBeCloseTo(0, 5);
    expect(calculateVMG(5, 180, 90)).toBeCloseTo(0, 5);
  });

  it("is negative (opening) when heading away from target", () => {
    expect(calculateVMG(5, 270, 90)).toBeCloseTo(-5, 5);
  });

  it("is zero when stationary", () => {
    expect(calculateVMG(0, 45, 180)).toBeCloseTo(0, 5);
  });

  it("handles bearings that wrap across 0/360", () => {
    // COG 350, target 10 — 20° off, VMG = 5 * cos(20°)
    expect(calculateVMG(5, 350, 10)).toBeCloseTo(5 * Math.cos((20 * Math.PI) / 180), 5);
  });

  it("scales with SOG at a given off-course angle", () => {
    // 60° off target: VMG = SOG * 0.5
    expect(calculateVMG(10, 30, 90)).toBeCloseTo(5, 5);
  });
});

describe("calculateWaypointProgress", () => {
  // Waypoint ~1km due north of the vessel position
  const position = { latitude: 47.6, longitude: -122.3 };
  const waypointNorth = { latitude: 47.609, longitude: -122.3 };

  it("computes distance and bearing toward a northbound waypoint", () => {
    const result = calculateWaypointProgress(position, 0, 0, waypointNorth);
    expect(result.distance).toBeGreaterThan(900);
    expect(result.distance).toBeLessThan(1100);
    expect(result.bearing).toBeGreaterThanOrEqual(0);
    expect(result.bearing).toBeLessThan(5); // essentially due north
  });

  it("ETA equals distance / SOG when heading directly at target", () => {
    const result = calculateWaypointProgress(position, 5, 0, waypointNorth);
    expect(result.vmg).toBeCloseTo(5, 2);
    expect(result.eta).not.toBeNull();
    expect(result.eta!).toBeCloseTo(result.distance / 5, 2);
  });

  it("ETA is null when VMG is below the minimum threshold", () => {
    // Drifting slowly; SOG below 0.5 m/s
    const result = calculateWaypointProgress(position, 0.2, 0, waypointNorth);
    expect(result.eta).toBeNull();
  });

  it("ETA is null when heading away from the waypoint", () => {
    const result = calculateWaypointProgress(position, 5, 180, waypointNorth);
    expect(result.vmg).toBeLessThan(0);
    expect(result.eta).toBeNull();
  });

  it("ETA is extended when sailing off-course vs. straight on", () => {
    const direct = calculateWaypointProgress(position, 5, 0, waypointNorth);
    // 60° off course: VMG halves, ETA doubles
    const offCourse = calculateWaypointProgress(position, 5, 60, waypointNorth);
    expect(offCourse.eta).not.toBeNull();
    expect(offCourse.eta!).toBeGreaterThan(direct.eta! * 1.9);
    expect(offCourse.eta!).toBeLessThan(direct.eta! * 2.1);
  });

  it("ETA is null when VMG is exactly at the threshold (not strictly greater)", () => {
    // cos(0) = 1, so with sog = 0.5 VMG = 0.5 which is NOT > 0.5
    const result = calculateWaypointProgress(position, 0.5, 0, waypointNorth);
    expect(result.vmg).toBeCloseTo(0.5, 5);
    expect(result.eta).toBeNull();
  });

  describe("with previous waypoint (leg-aligned VMG)", () => {
    // Leg: previous 1 km south of position, waypoint 1 km north of position.
    // Leg bearing is due north (0°).
    const previous = { latitude: 47.591, longitude: -122.3 };

    it("legVmg is null when no previous waypoint is provided", () => {
      const result = calculateWaypointProgress(position, 5, 0, waypointNorth);
      expect(result.legVmg).toBeNull();
    });

    it("legVmg equals SOG when heading along the leg", () => {
      const result = calculateWaypointProgress(position, 5, 0, waypointNorth, previous);
      expect(result.legVmg).not.toBeNull();
      expect(result.legVmg!).toBeCloseTo(5, 1);
    });

    it("direct approach: leg-aligned ETA matches bearing-to-mark ETA", () => {
      const withLeg = calculateWaypointProgress(position, 5, 0, waypointNorth, previous);
      const withoutLeg = calculateWaypointProgress(position, 5, 0, waypointNorth);
      expect(withLeg.eta).not.toBeNull();
      expect(withoutLeg.eta).not.toBeNull();
      expect(withLeg.eta!).toBeCloseTo(withoutLeg.eta!, 0);
    });

    it("layline: leg-aligned ETA is lower (more realistic) than bearing-to-mark ETA", () => {
      // Position sits 200m east of the A→B line; COG is still due north
      // (sailing parallel to the leg, a classic layline). Bearing P→B points
      // northwest, so bearing-to-mark VMG underestimates progress — ETA too
      // high. Leg-aligned VMG is SOG · cos(0°) = SOG — honest.
      const offsetLat = 47.6;
      const offsetLon = -122.3 + 200 / (111320 * Math.cos((offsetLat * Math.PI) / 180));
      const laylinePos = { latitude: offsetLat, longitude: offsetLon };

      const legAligned = calculateWaypointProgress(laylinePos, 5, 0, waypointNorth, previous);
      const markAligned = calculateWaypointProgress(laylinePos, 5, 0, waypointNorth);

      expect(legAligned.eta).not.toBeNull();
      expect(markAligned.eta).not.toBeNull();
      expect(legAligned.eta!).toBeLessThan(markAligned.eta!);
      // Expected ≈ distance / 5 (cos 0 = 1)
      expect(legAligned.eta!).toBeCloseTo(legAligned.distance / 5, 0);
    });

    it("unfavored tack: legVmg near zero → ETA is null", () => {
      // COG 90° (east) against a due-north leg: legVmg = 5 · cos(90°) = 0.
      const result = calculateWaypointProgress(position, 5, 90, waypointNorth, previous);
      expect(Math.abs(result.legVmg!)).toBeLessThan(0.5);
      expect(result.eta).toBeNull();
    });

    it("favored tack: legVmg ≈ SOG · cos(45°), ETA ≈ distance / legVmg", () => {
      // COG 45° to a due-north leg → legVmg = 5 · cos(45°) ≈ 3.535
      const result = calculateWaypointProgress(position, 5, 45, waypointNorth, previous);
      expect(result.legVmg).not.toBeNull();
      expect(result.legVmg!).toBeCloseTo(5 * Math.cos(Math.PI / 4), 2);
      expect(result.eta).not.toBeNull();
      expect(result.eta!).toBeCloseTo(result.distance / result.legVmg!, 0);
    });

    it("first leg (previous = null) still uses bearing-to-mark VMG", () => {
      // Sanity: no regression for the first-leg code path.
      const result = calculateWaypointProgress(position, 5, 0, waypointNorth, null);
      expect(result.legVmg).toBeNull();
      expect(result.eta).not.toBeNull();
      expect(result.eta!).toBeCloseTo(result.distance / 5, 2);
    });
  });
});

describe("calculateRouteLegs", () => {
  const a = { latitude: 47.60, longitude: -122.30 };
  const b = { latitude: 47.61, longitude: -122.30 };
  const c = { latitude: 47.61, longitude: -122.29 };

  it("returns empty for zero points", () => {
    expect(calculateRouteLegs([])).toEqual([]);
  });

  it("returns empty for a single point", () => {
    expect(calculateRouteLegs([a])).toEqual([]);
  });

  it("produces n-1 legs for n points", () => {
    expect(calculateRouteLegs([a, b, c])).toHaveLength(2);
  });

  it("each leg carries from/to/distance/bearing", () => {
    const legs = calculateRouteLegs([a, b]);
    expect(legs[0].from).toEqual(a);
    expect(legs[0].to).toEqual(b);
    expect(legs[0].distance).toBeGreaterThan(0);
    expect(legs[0].bearing).toBeGreaterThanOrEqual(0);
    expect(legs[0].bearing).toBeLessThan(360);
  });
});

describe("calculateDestinationProgress", () => {
  const pos = { latitude: 47.60, longitude: -122.30 };
  // Route: pos → wp1 (~1km N) → wp2 (~2km N total) → wp3 (~3km N total)
  const wp1 = { latitude: 47.609, longitude: -122.30 };
  const wp2 = { latitude: 47.618, longitude: -122.30 };
  const wp3 = { latitude: 47.627, longitude: -122.30 };
  const points = [wp1, wp2, wp3];

  it("equals next-waypoint progress when active is the last point", () => {
    // Pretend pos is heading straight at wp3 (the final point) at 5 m/s
    const nextProgress = calculateWaypointProgress(pos, 5, 0, wp3);
    const result = calculateDestinationProgress(nextProgress, points, 2, 5);
    expect(result.distance).toBeCloseTo(nextProgress.distance, 5);
    expect(result.eta).toBeCloseTo(nextProgress.eta!, 5);
  });

  it("sums remaining leg distances beyond the active waypoint", () => {
    const nextProgress = calculateWaypointProgress(pos, 5, 0, wp1);
    const result = calculateDestinationProgress(nextProgress, points, 0, 5);
    // distance = dist(pos→wp1) + dist(wp1→wp2) + dist(wp2→wp3)
    const leg1 = calculateRouteLegs([wp1, wp2])[0].distance;
    const leg2 = calculateRouteLegs([wp2, wp3])[0].distance;
    expect(result.distance).toBeCloseTo(nextProgress.distance + leg1 + leg2, 0);
  });

  it("ETA combines VMG-based next ETA with SOG-based remainder", () => {
    const sog = 5;
    const nextProgress = calculateWaypointProgress(pos, sog, 0, wp1);
    const result = calculateDestinationProgress(nextProgress, points, 0, sog);
    const leg1 = calculateRouteLegs([wp1, wp2])[0].distance;
    const leg2 = calculateRouteLegs([wp2, wp3])[0].distance;
    const expected = nextProgress.eta! + (leg1 + leg2) / sog;
    expect(result.eta).not.toBeNull();
    expect(result.eta!).toBeCloseTo(expected, 2);
  });

  it("ETA is null when next-waypoint ETA is null (heading away)", () => {
    const nextProgress = calculateWaypointProgress(pos, 5, 180, wp1);
    expect(nextProgress.eta).toBeNull();
    const result = calculateDestinationProgress(nextProgress, points, 0, 5);
    expect(result.eta).toBeNull();
  });

  it("ETA is null when SOG is below threshold and there are remaining legs", () => {
    // Force a positive VMG on the next leg by using a tiny artificial progress
    const nextProgress = calculateWaypointProgress(pos, 1, 0, wp1);
    expect(nextProgress.eta).not.toBeNull();
    // But overall SOG for remainder estimate is below threshold
    const result = calculateDestinationProgress(nextProgress, points, 0, 0.1);
    expect(result.eta).toBeNull();
  });

  it("distance still correct even when ETA is null", () => {
    const nextProgress = calculateWaypointProgress(pos, 5, 180, wp1);
    const result = calculateDestinationProgress(nextProgress, points, 0, 5);
    expect(result.distance).toBeGreaterThan(0);
    expect(result.eta).toBeNull();
  });
});

describe("formatBearing", () => {
  it("formats single-digit bearings", () => {
    expect(formatBearing(5)).toBe("5°");
  });

  it("formats two-digit bearings", () => {
    expect(formatBearing(45)).toBe("45°");
  });

  it("formats three-digit bearings", () => {
    expect(formatBearing(270)).toBe("270°");
  });

  it("rounds decimal values", () => {
    expect(formatBearing(44.7)).toBe("45°");
  });

  it("normalizes 360 to 0", () => {
    expect(formatBearing(360)).toBe("0°");
  });
});

describe("legProgress", () => {
  // Leg from A (south) to B (north), 1 km long, off Rhode Island.
  const B = { latitude: 41.5, longitude: -71.3 };
  const A = offsetPoint(B, -1000, 0);

  it("returns legLength ≈ d(A,B) and legBearing ≈ 000° for a northbound leg", () => {
    const p = legProgress(A, B, A);
    // offsetPoint is flat-earth, geolib is spherical → ~1% discrepancy.
    expect(p.legLength).toBeGreaterThan(990);
    expect(p.legLength).toBeLessThan(1020);
    expect(p.legBearing).toBeCloseTo(0, 0);
  });

  it("P at A → alongTrackPastB ≈ -legLength, crossTrack ≈ 0", () => {
    const p = legProgress(A, B, A);
    expect(p.alongTrackPastB).toBeCloseTo(-p.legLength, 0);
    expect(Math.abs(p.crossTrack)).toBeLessThan(1);
  });

  it("P at B → alongTrackPastB ≈ 0, rangeToB ≈ 0", () => {
    const p = legProgress(A, B, B);
    expect(p.alongTrackPastB).toBeCloseTo(0, -1);
    expect(p.rangeToB).toBeLessThan(1);
    expect(Math.abs(p.crossTrack)).toBeLessThan(1);
  });

  it("P past B on the same bearing → alongTrackPastB > 0, crossTrack ≈ 0", () => {
    const p = legProgress(A, B, offsetPoint(B, 200, 0));
    expect(p.alongTrackPastB).toBeGreaterThan(150);
    expect(p.alongTrackPastB).toBeLessThan(250);
    expect(Math.abs(p.crossTrack)).toBeLessThan(1);
  });

  it("P at the midpoint, offset 100 m east → along ≈ legLength/2, cross ≈ +100", () => {
    const midpoint = offsetPoint(A, 500, 0);
    const p = legProgress(A, B, offsetPoint(midpoint, 0, 100));
    // along-track from A is ~500m, so alongTrackPastB ≈ 500 - 1000 = -500.
    expect(p.alongTrackPastB).toBeCloseTo(-500, -1);
    expect(p.crossTrack).toBeGreaterThan(90);
    expect(p.crossTrack).toBeLessThan(110);
  });

  it("cross-track sign: right of track is positive, left is negative", () => {
    const right = legProgress(A, B, offsetPoint(B, -500, 100));
    const left = legProgress(A, B, offsetPoint(B, -500, -100));
    expect(right.crossTrack).toBeGreaterThan(0);
    expect(left.crossTrack).toBeLessThan(0);
  });

  it("degenerate leg (A == B) returns sane values without NaN", () => {
    const p = legProgress(B, B, offsetPoint(B, 50, 0));
    expect(Number.isFinite(p.rangeToB)).toBe(true);
    expect(Number.isFinite(p.alongTrackPastB)).toBe(true);
    expect(Number.isFinite(p.crossTrack)).toBe(true);
    expect(p.legLength).toBe(0);
  });

  it("very short leg does not produce NaN", () => {
    const near = offsetPoint(B, -30, 0);
    const p = legProgress(near, B, offsetPoint(B, -10, 5));
    expect(Number.isFinite(p.rangeToB)).toBe(true);
    expect(Number.isFinite(p.alongTrackPastB)).toBe(true);
    expect(Number.isFinite(p.crossTrack)).toBe(true);
  });
});
