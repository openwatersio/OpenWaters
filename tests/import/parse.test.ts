import { parseGpx, parseNavionicsMarker } from "@/import/parse";

describe("parseGpx", () => {
  it("parses waypoints", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="47.6" lon="-122.3">
    <name>Home</name>
    <desc>Favorite spot</desc>
    <sym>anchor</sym>
    <time>2025-01-01T00:00:00Z</time>
  </wpt>
  <wpt lat="48.0" lon="-123.0">
    <name>Other</name>
  </wpt>
</gpx>`;
    const result = parseGpx(xml);
    expect(result.waypoints).toHaveLength(2);
    expect(result.waypoints[0]).toMatchObject({
      latitude: 47.6,
      longitude: -122.3,
      name: "Home",
      notes: "Favorite spot",
      icon: "anchor",
    });
    expect(result.waypoints[1].name).toBe("Other");
  });

  it("parses routes", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>Harbor to Island</name>
    <rtept lat="47.6" lon="-122.3"/>
    <rtept lat="47.7" lon="-122.4"/>
    <rtept lat="47.8" lon="-122.5"/>
  </rte>
</gpx>`;
    const { routes } = parseGpx(xml);
    expect(routes).toHaveLength(1);
    expect(routes[0].name).toBe("Harbor to Island");
    expect(routes[0].points).toHaveLength(3);
    expect(routes[0].points[0]).toEqual({ latitude: 47.6, longitude: -122.3 });
  });

  it("parses tracks with timestamps", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Morning sail</name>
    <trkseg>
      <trkpt lat="47.6" lon="-122.3"><time>2025-01-01T00:00:00Z</time></trkpt>
      <trkpt lat="47.61" lon="-122.31"><time>2025-01-01T00:00:05Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;
    const { tracks } = parseGpx(xml);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].name).toBe("Morning sail");
    expect(tracks[0].started_at).toBe("2025-01-01T00:00:00Z");
    expect(tracks[0].ended_at).toBe("2025-01-01T00:00:05Z");
    expect(tracks[0].points).toHaveLength(2);
  });

  it("accepts tracks without <time> elements", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="47.6" lon="-122.3"/>
      <trkpt lat="47.7" lon="-122.4"/>
    </trkseg>
  </trk>
</gpx>`;
    const { tracks } = parseGpx(xml);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].started_at).toBeNull();
    expect(tracks[0].ended_at).toBeNull();
    expect(tracks[0].points).toHaveLength(2);
    expect(tracks[0].points[0].timestamp).toBeNull();
  });

  it("flattens multiple <trkseg> into one track", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="47.6" lon="-122.3"/>
    </trkseg>
    <trkseg>
      <trkpt lat="47.7" lon="-122.4"/>
      <trkpt lat="47.8" lon="-122.5"/>
    </trkseg>
  </trk>
</gpx>`;
    const { tracks } = parseGpx(xml);
    expect(tracks[0].points).toHaveLength(3);
  });

  it("reads speed/course from extensions", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="47.6" lon="-122.3">
      <extensions><speed>2.5</speed><course>180</course></extensions>
    </trkpt>
  </trkseg></trk>
</gpx>`;
    const { tracks } = parseGpx(xml);
    expect(tracks[0].points[0].speed).toBe(2.5);
    expect(tracks[0].points[0].heading).toBe(180);
  });

  it("skips points with invalid coordinates", () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="91" lon="0"><name>Bad</name></wpt>
  <wpt lat="47.6" lon="-122.3"><name>Good</name></wpt>
</gpx>`;
    const { waypoints } = parseGpx(xml);
    expect(waypoints).toHaveLength(1);
    expect(waypoints[0].name).toBe("Good");
  });

  it("returns empty result for malformed input", () => {
    const result = parseGpx("<notgpx/>");
    expect(result).toEqual({ waypoints: [], routes: [], tracks: [] });
  });
});

describe("parseNavionicsMarker", () => {
  it("parses a valid Navionics marker", () => {
    const json = JSON.stringify({
      name: "Possible anchorage?",
      lat: 41.246022,
      lon: -73.959573,
      description: null,
    });
    const result = parseNavionicsMarker(json);
    expect(result).toEqual({
      latitude: 41.246022,
      longitude: -73.959573,
      name: "Possible anchorage?",
      notes: null,
    });
  });

  it("maps description to notes", () => {
    const json = JSON.stringify({
      name: "Fuel dock",
      lat: 42.0,
      lon: -71.0,
      description: "Open 9-5 daily",
    });
    expect(parseNavionicsMarker(json)?.notes).toBe("Open 9-5 daily");
  });

  it("returns null for missing coordinates", () => {
    expect(parseNavionicsMarker(JSON.stringify({ name: "No coords" }))).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseNavionicsMarker("not json")).toBeNull();
  });

  it("handles missing name gracefully", () => {
    const json = JSON.stringify({ lat: 42.0, lon: -71.0 });
    const result = parseNavionicsMarker(json);
    expect(result?.name).toBeNull();
    expect(result?.latitude).toBe(42.0);
  });
});
