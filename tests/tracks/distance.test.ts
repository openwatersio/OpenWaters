import type { TrackPoint } from "@/database";
import { computeDistance, segmentDistance } from "@/tracks/distance";

let nextId = 1;

function point(
  latitude: number,
  longitude: number,
  timestampSec: number,
  accuracy: number | null = 5,
  speed: number | null = 4,
): TrackPoint {
  const id = nextId++;
  return {
    id,
    track_id: 1,
    sequence: id - 1,
    latitude,
    longitude,
    speed,
    heading: null,
    accuracy,
    timestamp: new Date(timestampSec * 1000).toISOString(),
  };
}

beforeEach(() => {
  nextId = 1;
});

describe("computeDistance", () => {
  it("returns 0 for empty input", () => {
    expect(computeDistance([])).toBe(0);
  });

  it("returns 0 for a single point", () => {
    expect(computeDistance([point(47.6, -122.3, 0)])).toBe(0);
  });

  it("sums real movement between fixes", () => {
    // Two points ~100m apart at 4 m/s, well above the noise floor.
    const points = [
      point(47.6, -122.3, 0),
      point(47.6, -122.2987, 25), // ~97m east at 47.6° lat
    ];
    const d = computeDistance(points);
    expect(d).toBeGreaterThan(85);
    expect(d).toBeLessThan(110);
  });

  it("drops segments below the noise floor", () => {
    // 5m segment with 10m+10m combined accuracy → noise floor = 20m → drop.
    const points = [
      point(47.6, -122.3, 0, 10),
      point(47.60004, -122.3, 5, 10), // ~4-5m north
    ];
    expect(computeDistance(points)).toBe(0);
  });

  it("drops physically impossible segments (>20 m/s)", () => {
    // 1 km in 1 second = 1000 m/s
    const points = [
      point(47.6, -122.3, 0, 5),
      point(47.609, -122.3, 1, 5),
    ];
    expect(computeDistance(points)).toBe(0);
  });

  it("does not inflate when GPS jitter pads otherwise-straight motion", () => {
    // Boat is moving steadily east at 4 m/s with ±3m of orthogonal jitter.
    // Real distance over 100s ≈ 400m. Jitter-padded sum should not exceed
    // it by more than a few percent once the noise floor is applied.
    const seed = 0.42;
    const rng = mulberry32(Math.floor(seed * 1e9));
    const points: TrackPoint[] = [];
    for (let t = 0; t <= 100; t += 5) {
      const eastMeters = 4 * t;
      const lon = -122.3 + eastMeters / (111_320 * Math.cos((47.6 * Math.PI) / 180));
      const jitterLat = ((rng() - 0.5) * 6) / 111_320; // ±3m N/S
      points.push(point(47.6 + jitterLat, lon, t, 5));
    }
    const d = computeDistance(points);
    // Real distance ≈ 400m; allow up to 10% inflation.
    expect(d).toBeGreaterThan(380);
    expect(d).toBeLessThan(440);
  });

  it("ignores stationary jitter (boat moored)", () => {
    // Boat tied to a dock; all fixes within 4m of each other, accuracy ~5m.
    const seed = 0.13;
    const rng = mulberry32(Math.floor(seed * 1e9));
    const points: TrackPoint[] = [];
    for (let t = 0; t < 600; t += 10) {
      const jitterLat = ((rng() - 0.5) * 8) / 111_320;
      const jitterLon = ((rng() - 0.5) * 8) / (111_320 * Math.cos((47.6 * Math.PI) / 180));
      points.push(point(47.6 + jitterLat, -122.3 + jitterLon, t, 5));
    }
    expect(computeDistance(points)).toBe(0);
  });

  it("computeDistance equals incremental sum of segmentDistance", () => {
    const points = [
      point(47.6, -122.3, 0),
      point(47.6, -122.298, 30),
      point(47.601, -122.298, 60),
      point(47.601, -122.296, 90),
    ];
    let incremental = 0;
    for (let i = 1; i < points.length; i++) {
      incremental += segmentDistance({ previous: points[i - 1], current: points[i] });
    }
    expect(computeDistance(points)).toBeCloseTo(incremental, 6);
  });
});

// Deterministic PRNG so tests aren't flaky.
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
