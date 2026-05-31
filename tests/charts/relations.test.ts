import { groupFeatures } from "@/charts/s57/relations";
import type { Feature, Point } from "geojson";

/**
 * Fixtures mirror real OpenENC (njord) feature shapes decoded from live tiles:
 * a structure carries `LNAM_REFS` (JSON-string list) pointing at its equipment,
 * and equipment shares the structure's exact coordinate. See the njord
 * feature-shape notes for provenance.
 */
function pt(
  lnam: string,
  objl: number,
  coord: [number, number],
  extra: Record<string, unknown> = {},
): Feature<Point> {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coord },
    properties: { LNAM: lnam, OBJL: objl, ...extra },
  };
}

const BUOY_COORD: [number, number] = [-70.958741, 42.332574];

describe("groupFeatures", () => {
  it("groups a buoy with its light via LNAM_REFS, promoting the named structure", () => {
    const buoy = pt("BUOY", 17, BUOY_COORD, {
      OBJNAM: "Long Island Head Lighted Buoy 17",
      LNAM_REFS: '["LIGHT"]',
      FFPT_RIND: "[2]",
    });
    const light = pt("LIGHT", 75, BUOY_COORD, { LITCHR: 2 });

    const group = groupFeatures("BUOY", [buoy, light]);
    expect(group?.primary.properties?.LNAM).toBe("BUOY");
    expect(group?.related.map((f) => f.properties?.LNAM)).toEqual(["LIGHT"]);
  });

  it("promotes the structure even when entered from the light (one-sided ref)", () => {
    // The light has no LNAM_REFS back to the buoy — only co-location + the
    // buoy's forward ref connect them.
    const buoy = pt("BUOY", 17, BUOY_COORD, {
      OBJNAM: "Buoy 17",
      LNAM_REFS: '["LIGHT"]',
    });
    const light = pt("LIGHT", 75, BUOY_COORD);

    const group = groupFeatures("LIGHT", [buoy, light]);
    expect(group?.primary.properties?.LNAM).toBe("BUOY");
    expect(group?.related.map((f) => f.properties?.LNAM)).toEqual(["LIGHT"]);
  });

  it("groups sectored lights by co-location when no link exists", () => {
    const buoy = pt("BUOY", 17, BUOY_COORD, { OBJNAM: "Buoy" });
    const light1 = pt("L1", 75, BUOY_COORD, { COLOUR: '["3"]' });
    const light2 = pt("L2", 75, BUOY_COORD, { COLOUR: '["4"]' });

    const group = groupFeatures("BUOY", [buoy, light1, light2]);
    expect(group?.primary.properties?.LNAM).toBe("BUOY");
    expect(group?.related.map((f) => f.properties?.LNAM).sort()).toEqual([
      "L1",
      "L2",
    ]);
  });

  it("does NOT merge two distinct structures sharing a pixel (neither is equipment)", () => {
    const buoyA = pt("A", 17, BUOY_COORD, { OBJNAM: "A" });
    const buoyB = pt("B", 17, BUOY_COORD, { OBJNAM: "B" });

    const group = groupFeatures("A", [buoyA, buoyB]);
    expect(group?.primary.properties?.LNAM).toBe("A");
    expect(group?.related).toEqual([]);
  });

  it("dedups the same feature repeated across style layers", () => {
    const buoy = pt("BUOY", 17, BUOY_COORD, { OBJNAM: "Buoy", LNAM_REFS: '["LIGHT"]' });
    const light = pt("LIGHT", 75, BUOY_COORD);
    // queryRenderedFeatures returns each feature once per layer that draws it.
    const group = groupFeatures("BUOY", [buoy, buoy, light, light, light]);
    expect(group?.related.map((f) => f.properties?.LNAM)).toEqual(["LIGHT"]);
  });

  it("ignores app-overlay features without an OBJL", () => {
    const buoy = pt("BUOY", 17, BUOY_COORD, { OBJNAM: "Buoy" });
    const vessel: Feature = {
      type: "Feature",
      geometry: { type: "Point", coordinates: BUOY_COORD },
      properties: { mmsi: "123", state: "underway" }, // no OBJL
    };
    const group = groupFeatures("BUOY", [buoy, vessel]);
    expect(group?.related).toEqual([]);
  });

  it("returns null when the lnam is not present", () => {
    expect(groupFeatures("MISSING", [pt("OTHER", 17, BUOY_COORD)])).toBeNull();
  });

  it("keeps a standalone light as its own primary", () => {
    const light = pt("LIGHT", 75, BUOY_COORD, { OBJNAM: "Cape Light" });
    const group = groupFeatures("LIGHT", [light]);
    expect(group?.primary.properties?.LNAM).toBe("LIGHT");
    expect(group?.related).toEqual([]);
  });
});
