import { MIN_AIS_ZOOM, isAISVisibleAtZoom } from "@/ais/visibility";

describe("isAISVisibleAtZoom", () => {
  it("hides AIS below the threshold", () => {
    expect(isAISVisibleAtZoom(MIN_AIS_ZOOM - 0.01)).toBe(false);
    expect(isAISVisibleAtZoom(0)).toBe(false);
  });

  it("shows AIS at and above the threshold", () => {
    expect(isAISVisibleAtZoom(MIN_AIS_ZOOM)).toBe(true);
    expect(isAISVisibleAtZoom(MIN_AIS_ZOOM + 5)).toBe(true);
  });
});
