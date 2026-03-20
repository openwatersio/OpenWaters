import {
  describeUnit,
  getDistanceUnits,
  getSpeedUnits,
  setPreferredUnits,
  toDistance,
  toSpeed,
  usePreferredUnits,
} from "@/hooks/usePreferredUnits";

const initialState = usePreferredUnits.getState();

beforeEach(() => {
  usePreferredUnits.setState(initialState, true);
});

describe("usePreferredUnits", () => {
  it("defaults to knots", () => {
    expect(usePreferredUnits.getState().speed).toBe("knot");
  });

  it("defaults to nautical miles", () => {
    expect(usePreferredUnits.getState().distance).toBe("nm");
  });

  describe("toSpeed", () => {
    it("converts m/s to knots", () => {
      const result = toSpeed(1);
      expect(result.value).toBe("1.9"); // 1 m/s ≈ 1.944 knots
      expect(result.abbr).toBe("kn");
    });

    it("converts zero correctly", () => {
      const result = toSpeed(0);
      expect(result.value).toBe("0.0");
    });

    it("respects the decimals option", () => {
      const result = toSpeed(1, { decimals: 2 });
      expect(result.value).toBe("1.94");
    });

    it("uses the preferred unit after set()", () => {
      setPreferredUnits({ speed: "km/h" });
      const result = toSpeed(1);
      expect(result.value).toBe("3.6"); // 1 m/s = 3.6 km/h
      expect(result.abbr).toBe("km/h");
    });
  });

  describe("speedUnits", () => {
    it("returns available speed units", () => {
      const units = getSpeedUnits();
      expect(units).toContain("knot");
      expect(units).toContain("km/h");
      expect(units).toContain("mph");
      expect(units).toHaveLength(3);
    });
  });

  describe("toDistance", () => {
    it("converts meters to nautical miles by default", () => {
      const result = toDistance(1852);
      expect(result.value).toBe("1.0");
      expect(result.abbr).toBe("nm");
    });

    it("converts meters to km when preferred", () => {
      setPreferredUnits({ distance: "km" });
      const result = toDistance(1000);
      expect(result.value).toBe("1.0");
      expect(result.abbr).toBe("km");
    });

    it("converts meters to miles when preferred", () => {
      setPreferredUnits({ distance: "mi" });
      const result = toDistance(1609.344);
      expect(result.value).toBe("1.0");
      expect(result.abbr).toBe("mi");
    });

    it("respects the decimals option", () => {
      const result = toDistance(1000, { decimals: 2 });
      expect(result.value).toBe("0.54");
    });
  });

  describe("distanceUnits", () => {
    it("returns nm, mi, and km", () => {
      const units = getDistanceUnits();
      expect(units).toContain("nm");
      expect(units).toContain("mi");
      expect(units).toContain("km");
      expect(units).toHaveLength(3);
    });
  });

  describe("describe", () => {
    it("returns description for knot", () => {
      const desc = describeUnit("knot");
      expect(desc.abbr).toBe("kn");
      expect(desc.singular).toBe("Knot");
    });

    it("returns description for nm", () => {
      const desc = describeUnit("nm");
      expect(desc.abbr).toBe("nm");
      expect(desc.plural).toBe("Nautical Miles");
    });
  });
});
