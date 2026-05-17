import { boundsToSubscription, padBounds } from "@/aisstream/client";

describe("boundsToSubscription", () => {
  it("emits a single box for non-crossing bounds", () => {
    // West Coast US: [-130, 30, -110, 50]
    const boxes = boundsToSubscription([-130, 30, -110, 50]);
    expect(boxes).toEqual([[[30, -130], [50, -110]]]);
  });

  it("splits at the antimeridian (west > east)", () => {
    // Aleutians-ish viewport: west=170, east=-170 → crosses 180°
    const boxes = boundsToSubscription([170, 50, -170, 60]);
    expect(boxes).toEqual([
      [[50, 170], [60, 180]],
      [[50, -180], [60, -170]],
    ]);
  });

  it("clamps latitudes to ±90", () => {
    const boxes = boundsToSubscription([-10, -95, 10, 95]);
    expect(boxes[0][0][0]).toBe(-90);
    expect(boxes[0][1][0]).toBe(90);
  });
});

describe("padBounds", () => {
  it("pads each side by factor × span", () => {
    // 20°-wide, 10°-tall box; factor=0.5 → +10° lon, +5° lat each side.
    const padded = padBounds([-10, 0, 10, 10], 0.5);
    expect(padded[0]).toBeCloseTo(-20);
    expect(padded[1]).toBeCloseTo(-5);
    expect(padded[2]).toBeCloseTo(20);
    expect(padded[3]).toBeCloseTo(15);
  });

  it("clamps latitudes at ±90", () => {
    const padded = padBounds([0, 85, 10, 89], 1);
    expect(padded[1]).toBe(-90 < 85 - 4 ? 85 - 4 : -90); // 81
    expect(padded[3]).toBe(90); // clamped
  });

  it("wraps longitude when padding crosses the antimeridian", () => {
    // Box near 170°E, pad pushes west of -180°.
    const padded = padBounds([170, 0, 175, 10], 1);
    // Original west=170, span=5, pad=5 → west=165 (no wrap), east=180 (wrap to 180)
    expect(padded[0]).toBe(165);
    expect(padded[2]).toBe(180);
  });
});
