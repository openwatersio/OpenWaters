import { smoothCoordinates } from "@/routes/spline";

describe("smoothCoordinates", () => {
  it("returns input unchanged for fewer than 3 points", () => {
    const one: [number, number][] = [[-122, 47]];
    const two: [number, number][] = [[-122, 47], [-122.01, 47.01]];
    expect(smoothCoordinates(one)).toEqual(one);
    expect(smoothCoordinates(two)).toEqual(two);
  });

  it("generates more points than the input", () => {
    const coords: [number, number][] = [
      [-122, 47],
      [-122.01, 47.01],
      [-122.02, 47],
    ];
    const result = smoothCoordinates(coords);
    expect(result.length).toBeGreaterThan(coords.length);
  });

  it("starts at the first input point", () => {
    const coords: [number, number][] = [
      [-122, 47],
      [-122.01, 47.01],
      [-122.02, 47],
    ];
    const result = smoothCoordinates(coords);
    expect(result[0]).toEqual([-122, 47]);
  });

  it("ends near the last input point", () => {
    const coords: [number, number][] = [
      [-122, 47],
      [-122.01, 47.01],
      [-122.02, 47],
    ];
    const result = smoothCoordinates(coords);
    const last = result[result.length - 1];
    expect(last[0]).toBeCloseTo(-122.02, 10);
    expect(last[1]).toBeCloseTo(47, 10);
  });

  it("passes through original waypoints", () => {
    const coords: [number, number][] = [
      [-122, 47],
      [-122.01, 47.01],
      [-122.02, 47],
      [-122.03, 47.01],
    ];
    const result = smoothCoordinates(coords);
    // Each original point (except first) appears at index segments*i
    expect(result[0]).toEqual(coords[0]);
    expect(result[4][0]).toBeCloseTo(coords[1][0], 10);
    expect(result[4][1]).toBeCloseTo(coords[1][1], 10);
    expect(result[8][0]).toBeCloseTo(coords[2][0], 10);
    expect(result[8][1]).toBeCloseTo(coords[2][1], 10);
    expect(result[12][0]).toBeCloseTo(coords[3][0], 10);
    expect(result[12][1]).toBeCloseTo(coords[3][1], 10);
  });

  it("respects custom segment count", () => {
    const coords: [number, number][] = [
      [-122, 47],
      [-122.01, 47.01],
      [-122.02, 47],
    ];
    const result = smoothCoordinates(coords, 8);
    // 1 (start) + 2 segments * 8 points = 17
    expect(result.length).toBe(17);
  });
});
