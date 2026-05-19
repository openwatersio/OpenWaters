import { niceDistance, ringCoords } from "@/measurements/units";
import { getDistance } from "geolib";

describe("niceDistance", () => {
  describe("nautical miles", () => {
    it("snaps down to the largest ladder entry that fits", () => {
      // 3000 m ≈ 1.62 nm → snaps to 1 nm
      const result = niceDistance(3000, "nm");
      expect(result.value).toBe(1);
      expect(result.unit).toBe("nm");
      expect(result.meters).toBeCloseTo(1852, 0);
    });

    it("snaps to 0.25 nm at sub-mile distances", () => {
      // 600 m ≈ 0.324 nm → snaps to 0.25 nm
      const result = niceDistance(600, "nm");
      expect(result.value).toBe(0.25);
      expect(result.meters).toBeCloseTo(463, 0);
    });

    it("snaps to large values at low zoom", () => {
      // 50_000 m ≈ 27 nm → snaps to 25 nm
      const result = niceDistance(50000, "nm");
      expect(result.value).toBe(25);
    });

    it("returns the smallest entry rather than failing at extreme zoom", () => {
      // 1 m is far below the smallest ladder entry of 0.005 nm
      const result = niceDistance(1, "nm");
      expect(result.value).toBe(0.005);
    });
  });

  describe("kilometers", () => {
    it("snaps to round km values", () => {
      // 3500 m → 3.5 km → snaps to 3 km
      const result = niceDistance(3500, "km");
      expect(result.value).toBe(3);
      expect(result.meters).toBe(3000);
    });

    it("snaps to sub-km values", () => {
      // 800 m → 0.8 km → snaps to 0.5 km
      const result = niceDistance(800, "km");
      expect(result.value).toBe(0.5);
      expect(result.meters).toBe(500);
    });
  });

  describe("statute miles", () => {
    it("snaps to round mi values", () => {
      // 5000 m ≈ 3.107 mi → snaps to 3 mi
      const result = niceDistance(5000, "mi");
      expect(result.value).toBe(3);
      expect(result.meters).toBeCloseTo(4828, 0);
    });
  });

  it("snapped meters are always ≤ the input", () => {
    for (const meters of [10, 100, 500, 1234, 9999, 100000]) {
      for (const unit of ["nm", "mi", "km"] as const) {
        const result = niceDistance(meters, unit);
        // The exception is the floor case (raw smaller than smallest ladder
        // entry), where we return the smallest. Skip when result.meters > meters
        // and only the floor case applies.
        if (result.value === 0.005) continue;
        expect(result.meters).toBeLessThanOrEqual(meters);
      }
    }
  });
});

describe("ringCoords", () => {
  const center = { latitude: 42.0, longitude: -70.0 };

  it("returns segments+1 coords with the last repeating the first (closed loop)", () => {
    const coords = ringCoords(center, 1000, 32);
    expect(coords).toHaveLength(33);
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });

  it("each coord sits at roughly radiusMeters from center", () => {
    const radius = 1000;
    const coords = ringCoords(center, radius, 16);
    for (const [longitude, latitude] of coords) {
      const distance = getDistance(center, { latitude, longitude });
      // Flat-earth projection drifts on a sphere; allow ~1% tolerance.
      expect(distance).toBeGreaterThan(radius * 0.99);
      expect(distance).toBeLessThan(radius * 1.01);
    }
  });

  it("defaults to 64 segments", () => {
    const coords = ringCoords(center, 500);
    expect(coords).toHaveLength(65);
  });
});
