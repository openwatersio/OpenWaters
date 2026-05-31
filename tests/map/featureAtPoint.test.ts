import { chartFeatureIdAtCoordinate } from "@/map/featureAtPoint";
import type { Feature } from "geojson";

const COORD: [number, number] = [-70.95, 42.33];
const TAP = { latitude: 42.33, longitude: -70.95 };
const ZOOM = 14;

function point(
  lnam: string,
  objl: number,
  coord: [number, number] = COORD,
  extra: Record<string, unknown> = {},
): Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coord },
    properties: { LNAM: lnam, OBJL: objl, ...extra },
  };
}

function line(lnam: string, objl: number): Feature {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        [-70.951, 42.33],
        [-70.949, 42.33],
      ],
    },
    properties: { LNAM: lnam, OBJL: objl },
  };
}

function polygon(lnam: string, objl: number): Feature {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-71, 42.3],
          [-70.9, 42.3],
          [-70.9, 42.4],
          [-71, 42.4],
          [-71, 42.3],
        ],
      ],
    },
    properties: { LNAM: lnam, OBJL: objl },
  };
}

describe("chartFeatureIdAtCoordinate", () => {
  it("returns the id of a point chart feature at the coordinate", () => {
    const id = chartFeatureIdAtCoordinate([point("BUOY", 17)], TAP, ZOOM);
    expect(id).toBe(`${COORD[0]},${COORD[1]},BUOY`);
  });

  it("collapses a buoy + light into the structure's id", () => {
    const buoy = point("BUOY", 17, COORD, {
      OBJNAM: "Buoy 1",
      LNAM_REFS: '["LIGHT"]',
    });
    const light = point("LIGHT", 75, COORD);
    const id = chartFeatureIdAtCoordinate([light, buoy], TAP, ZOOM);
    expect(id).toBe(`${COORD[0]},${COORD[1]},BUOY`);
  });

  it("prefers a point over a co-incident line", () => {
    const id = chartFeatureIdAtCoordinate(
      [line("CONTOUR", 43), point("BUOY", 17)],
      TAP,
      ZOOM,
    );
    expect(id).toBe(`${COORD[0]},${COORD[1]},BUOY`);
  });

  it("returns a line's id (vertex centroid) when only a line is present", () => {
    const id = chartFeatureIdAtCoordinate([line("CONTOUR", 43)], TAP, ZOOM);
    const lon = (-70.951 + -70.949) / 2; // centroid; keep exact float repr
    expect(id).toBe(`${lon},42.33,CONTOUR`);
  });

  it("ignores area-only taps (open water → LocationDetail)", () => {
    const id = chartFeatureIdAtCoordinate([polygon("SEA", 42)], TAP, ZOOM);
    expect(id).toBeNull();
  });

  it("ignores app overlays without an OBJL", () => {
    const vessel: Feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: COORD },
      properties: { mmsi: "123" },
    };
    const id = chartFeatureIdAtCoordinate([vessel], TAP, ZOOM);
    expect(id).toBeNull();
  });

  it("returns null when nothing is nearby", () => {
    expect(chartFeatureIdAtCoordinate([], TAP, ZOOM)).toBeNull();
  });

  it("ignores features beyond the zoom-scaled tolerance", () => {
    // ~1 km away — outside the tap slop at zoom 14.
    const far = point("BUOY", 17, [-70.94, 42.33]);
    expect(chartFeatureIdAtCoordinate([far], TAP, ZOOM)).toBeNull();
  });
});
