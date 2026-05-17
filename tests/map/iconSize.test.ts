import { iconSize, vesselMppFactor, vesselScaleAt, vesselScaleDamped } from "@/map/iconSize";
import config from "@/assets/map/icon-config.json";
import { createPropertyExpression, v8 } from "@maplibre/maplibre-gl-style-spec";

const ICON_PX = config.icon;
const METERS_PER_PIXEL_Z0 = 156543.03392;

describe("vesselMppFactor", () => {
  it("equals length at the equator (cos 0 = 1)", () => {
    expect(vesselMppFactor(100, 0)).toBeCloseTo(100, 5);
  });

  it("scales by 1/cos(latitude) for Web Mercator stretching", () => {
    expect(vesselMppFactor(100, 45)).toBeCloseTo(100 / Math.cos(Math.PI / 4), 5);
    expect(vesselMppFactor(100, 60)).toBeCloseTo(200, 3); // cos(60) = 0.5
  });

  it("is symmetric across the equator", () => {
    expect(vesselMppFactor(100, 30)).toBeCloseTo(vesselMppFactor(100, -30), 5);
  });

  it("does not divide by zero at the poles", () => {
    expect(Number.isFinite(vesselMppFactor(100, 90))).toBe(true);
  });
});

describe("vesselScaleAt", () => {
  // Replays the MapLibre stop-value math in JS so we can verify what each
  // stop evaluates to for a vessel of known LOA, latitude, and effective zoom.
  function evaluateAsPx(
    effectiveZoom: number,
    loaMeters: number,
    latitudeDegrees: number,
  ): number {
    const expr = vesselScaleAt(effectiveZoom) as ["*", unknown, number];
    const k = expr[2];
    const mppFactor = vesselMppFactor(loaMeters, latitudeDegrees);
    return mppFactor * k * ICON_PX;
  }

  it("matches the closed-form on-chart length at the equator", () => {
    // screenPx = LOA * 2^z / METERS_PER_PIXEL_Z0 (at the equator)
    const expected = (100 * 2 ** 18) / METERS_PER_PIXEL_Z0;
    expect(evaluateAsPx(18, 100, 0)).toBeCloseTo(expected, 3);
  });

  it("doubles per zoom level", () => {
    const z16 = evaluateAsPx(16, 300, 0);
    const z17 = evaluateAsPx(17, 300, 0);
    expect(z17).toBeCloseTo(z16 * 2, 3);
  });

  it("stretches with latitude per Web Mercator", () => {
    const equator = evaluateAsPx(18, 100, 0);
    const lat60 = evaluateAsPx(18, 100, 60);
    expect(lat60).toBeCloseTo(equator * 2, 3); // cos(60) = 0.5
  });

  it("preserves length proportions between vessels at every zoom", () => {
    // A 300 m vessel should always be 25× the size of a 12 m vessel.
    for (const z of [10, 14, 18, 22]) {
      const small = evaluateAsPx(z, 12, 0);
      const large = evaluateAsPx(z, 300, 0);
      expect(large / small).toBeCloseTo(25, 5);
    }
  });
});

describe("vesselScaleDamped", () => {
  function evaluateAsPx(
    referenceLengthMeters: number,
    referenceCssPx: number,
    power: number,
    loaMeters: number,
  ): number {
    const expr = vesselScaleDamped(referenceLengthMeters, referenceCssPx, power) as
      ["*", number, ["^", unknown, number]];
    const multiplier = expr[1];
    const pow = expr[2][2];
    const mppFactor = vesselMppFactor(loaMeters, 0);
    return multiplier * mppFactor ** pow * ICON_PX;
  }

  it("anchors the reference vessel at the requested CSS-pixel size", () => {
    expect(evaluateAsPx(100, 24, 1 / 3, 100)).toBeCloseTo(24, 5);
  });

  it("compresses 30:1 length ratios to ~3:1 size ratios with cube-root power", () => {
    const small = evaluateAsPx(100, 24, 1 / 3, 10);
    const large = evaluateAsPx(100, 24, 1 / 3, 300);
    expect(large / small).toBeCloseTo(30 ** (1 / 3), 3); // ≈ 3.1
  });

  it("matches linear scaling when power=1", () => {
    const small = evaluateAsPx(100, 24, 1, 10);
    const large = evaluateAsPx(100, 24, 1, 300);
    expect(large / small).toBeCloseTo(30, 5);
  });
});

describe("iconSize", () => {
  it("returns the expected icon-size factor for a CSS-pixel value", () => {
    expect(iconSize(ICON_PX)).toBe(1);
    expect(iconSize(ICON_PX / 2)).toBe(0.5);
  });
});

describe("icon-size expression validation", () => {
  // Guard against the constraint that crashed v0: MapLibre forbids `["zoom"]`
  // anywhere but as the input of a top-level step/interpolate. The native
  // SDK throws an NSException during style load if violated.
  const iconSizeSpec = v8.layout_symbol["icon-size"];

  function validate(expression: unknown): string[] {
    const result = createPropertyExpression(expression, iconSizeSpec);
    return result.result === "success" ? [] : result.value.map((e) => e.message);
  }

  it("accepts a top-level interpolate with vesselScaleAt values", () => {
    expect(validate([
      "interpolate", ["exponential", 2], ["zoom"],
      0, vesselScaleAt(0),
      22, vesselScaleAt(22),
    ])).toEqual([]);
  });

  it("accepts the production interpolate mixing damped low-zoom and linear high-zoom stops", () => {
    expect(validate([
      "interpolate", ["exponential", 2], ["zoom"],
      10, vesselScaleDamped(100, 24),
      14, vesselScaleDamped(100, 40),
      18, vesselScaleAt(18),
      22, vesselScaleAt(22),
    ])).toEqual([]);
  });

  it("rejects a zoom expression nested inside another expression", () => {
    // This is the structure that crashed v0 — interpolate(zoom) inside max().
    expect(validate([
      "max",
      iconSize(10),
      ["interpolate", ["exponential", 2], ["zoom"], 0, 1, 22, 1024],
    ]).length).toBeGreaterThan(0);
  });
});
