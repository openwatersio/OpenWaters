import { bearingDegrees, distanceMeters, formatBearing, headingDelta } from "@/lib/geo";

describe("distanceMeters", () => {
  it("returns 0 for the same point", () => {
    expect(distanceMeters(47.6, -122.3, 47.6, -122.3)).toBe(0);
  });

  it("computes known distance (Seattle to Portland ~233km)", () => {
    const d = distanceMeters(47.6062, -122.3321, 45.5152, -122.6784);
    expect(d).toBeGreaterThan(232_000);
    expect(d).toBeLessThan(235_000);
  });

  it("computes short distance accurately", () => {
    // ~111m per degree of latitude at equator
    const d = distanceMeters(0, 0, 0.001, 0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

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

describe("bearingDegrees", () => {
  it("returns ~0 for due north", () => {
    // Point directly north: same longitude, higher latitude
    const b = bearingDegrees(47.0, -122.0, 48.0, -122.0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("returns ~90 for due east at equator", () => {
    const b = bearingDegrees(0, 0, 0, 1);
    expect(b).toBeCloseTo(90, 0);
  });

  it("returns ~180 for due south", () => {
    const b = bearingDegrees(48.0, -122.0, 47.0, -122.0);
    expect(b).toBeCloseTo(180, 0);
  });

  it("returns ~270 for due west at equator", () => {
    const b = bearingDegrees(0, 1, 0, 0);
    expect(b).toBeCloseTo(270, 0);
  });

  it("returns known bearing (Seattle to Portland ~187°)", () => {
    // Portland is south-southwest of Seattle
    const b = bearingDegrees(47.6062, -122.3321, 45.5152, -122.6784);
    expect(b).toBeGreaterThan(183);
    expect(b).toBeLessThan(190);
  });
});

describe("formatBearing", () => {
  it("pads single-digit bearings", () => {
    expect(formatBearing(5)).toBe("005°T");
  });

  it("pads two-digit bearings", () => {
    expect(formatBearing(45)).toBe("045°T");
  });

  it("formats three-digit bearings", () => {
    expect(formatBearing(270)).toBe("270°T");
  });

  it("rounds decimal values", () => {
    expect(formatBearing(44.7)).toBe("045°T");
  });

  it("normalizes 360 to 000", () => {
    expect(formatBearing(360)).toBe("000°T");
  });
});
