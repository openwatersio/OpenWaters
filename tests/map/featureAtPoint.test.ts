import { chartFeatureIdAtPoint } from "@/map/featureAtPoint";
import type { Feature } from "geojson";

const COORD: [number, number] = [-70.95, 42.33];
const TAP = { latitude: 42.33, longitude: -70.95 };

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

/** Mock MapRef whose query returns the given features regardless of bbox. */
function mapWith(features: Feature[]) {
  return { queryRenderedFeatures: async () => features } as never;
}

describe("chartFeatureIdAtPoint", () => {
  it("returns the id of a tapped point chart feature", async () => {
    const id = await chartFeatureIdAtPoint(
      mapWith([point("BUOY", 17)]),
      [200, 200],
      TAP,
    );
    expect(id).toBe(`${COORD[0]},${COORD[1]},BUOY`);
  });

  it("collapses a buoy + light into the structure's id", async () => {
    const buoy = point("BUOY", 17, COORD, {
      OBJNAM: "Buoy 1",
      LNAM_REFS: '["LIGHT"]',
    });
    const light = point("LIGHT", 75, COORD);
    const id = await chartFeatureIdAtPoint(mapWith([light, buoy]), [200, 200], TAP);
    expect(id).toBe(`${COORD[0]},${COORD[1]},BUOY`);
  });

  it("prefers a point over a co-incident line", async () => {
    const id = await chartFeatureIdAtPoint(
      mapWith([line("CONTOUR", 43), point("BUOY", 17)]),
      [200, 200],
      TAP,
    );
    expect(id).toBe(`${COORD[0]},${COORD[1]},BUOY`);
  });

  it("returns a line's id (vertex centroid) when only a line is present", async () => {
    const id = await chartFeatureIdAtPoint(mapWith([line("CONTOUR", 43)]), [200, 200], TAP);
    const lon = (-70.951 + -70.949) / 2; // centroid; keep exact float repr
    expect(id).toBe(`${lon},42.33,CONTOUR`);
  });

  it("ignores area-only taps (open water → LocationDetail)", async () => {
    const id = await chartFeatureIdAtPoint(mapWith([polygon("SEA", 42)]), [200, 200], TAP);
    expect(id).toBeNull();
  });

  it("ignores app overlays without an OBJL", async () => {
    const vessel: Feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: COORD },
      properties: { mmsi: "123" },
    };
    const id = await chartFeatureIdAtPoint(mapWith([vessel]), [200, 200], TAP);
    expect(id).toBeNull();
  });

  it("returns null when nothing is under the tap", async () => {
    expect(await chartFeatureIdAtPoint(mapWith([]), [200, 200], TAP)).toBeNull();
  });
});
