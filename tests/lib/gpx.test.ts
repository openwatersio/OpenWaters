import { toGPX, routeToGPX } from "@/lib/gpx";
import type { Track, TrackPoint, Route, RoutePoint } from "@/lib/database";

const track: Track = {
  id: 1,
  name: "Morning sail",
  started_at: "2025-06-15T08:00:00Z",
  ended_at: "2025-06-15T10:00:00Z",
  distance: 5000,
  color: null,
};

const points: TrackPoint[] = [
  {
    id: 1,
    track_id: 1,
    latitude: 47.6062,
    longitude: -122.3321,
    speed: 2.5,
    heading: 180.0,
    accuracy: 5,
    timestamp: "2025-06-15T08:00:00Z",
  },
  {
    id: 2,
    track_id: 1,
    latitude: 47.607,
    longitude: -122.333,
    speed: 3.0,
    heading: 185.5,
    accuracy: 4,
    timestamp: "2025-06-15T08:05:00Z",
  },
];

describe("toGPX", () => {
  it("produces valid GPX 1.1 XML", () => {
    const gpx = toGPX(track, points);

    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain('version="1.1"');
    expect(gpx).toContain("creator=\"Open Waters\"");
    expect(gpx).toContain("<name>Morning sail</name>");
  });

  it("includes track points with coordinates", () => {
    const gpx = toGPX(track, points);

    expect(gpx).toContain('lat="47.6062" lon="-122.3321"');
    expect(gpx).toContain('lat="47.607" lon="-122.333"');
  });

  it("includes timestamps in track points", () => {
    const gpx = toGPX(track, points);

    expect(gpx).toContain("<time>2025-06-15T08:00:00Z</time>");
    expect(gpx).toContain("<time>2025-06-15T08:05:00Z</time>");
  });

  it("includes speed and heading in extensions", () => {
    const gpx = toGPX(track, points);

    expect(gpx).toContain("<speed>2.5</speed>");
    expect(gpx).toContain("<course>180</course>");
    expect(gpx).toContain("<speed>3</speed>");
    expect(gpx).toContain("<course>185.5</course>");
  });

  it("escapes XML special characters in track name", () => {
    const specialTrack = { ...track, name: 'Test & <"run">' };
    const gpx = toGPX(specialTrack, points);

    expect(gpx).toContain("Test &amp; &lt;&quot;run&quot;&gt;");
    expect(gpx).not.toContain("Test & <");
  });

  it("handles points with null speed and heading", () => {
    const nullPoints: TrackPoint[] = [
      {
        id: 1,
        track_id: 1,
        latitude: 47.6,
        longitude: -122.3,
        speed: null,
        heading: null,
        accuracy: null,
        timestamp: "2025-06-15T08:00:00Z",
      },
    ];
    const gpx = toGPX(track, nullPoints);

    expect(gpx).toContain('lat="47.6"');
    expect(gpx).not.toContain("<speed>");
    expect(gpx).not.toContain("<course>");
    expect(gpx).not.toContain("<extensions>");
  });

  it("uses started_at as fallback name", () => {
    const unnamed = { ...track, name: null };
    const gpx = toGPX(unnamed, points);

    expect(gpx).toContain(`<name>Track ${track.started_at}</name>`);
  });
});

const route: Route = {
  id: 1,
  name: "Harbor to Island",
  created_at: "2025-06-15T08:00:00Z",
  updated_at: "2025-06-15T08:00:00Z",
  distance: 0,
};

const routePoints: RoutePoint[] = [
  { id: 1, route_id: 1, order: 0, latitude: 41.123, longitude: -71.456 },
  { id: 2, route_id: 1, order: 1, latitude: 41.200, longitude: -71.500 },
  { id: 3, route_id: 1, order: 2, latitude: 41.300, longitude: -71.550 },
];

describe("routeToGPX", () => {
  it("produces valid GPX 1.1 XML with rte element", () => {
    const gpx = routeToGPX(route, routePoints);

    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain('version="1.1"');
    expect(gpx).toContain("<rte>");
    expect(gpx).toContain("<name>Harbor to Island</name>");
  });

  it("includes route points with coordinates", () => {
    const gpx = routeToGPX(route, routePoints);

    expect(gpx).toContain('lat="41.123" lon="-71.456"');
    expect(gpx).toContain('lat="41.3" lon="-71.55"');
  });

  it("does not include name elements in route points", () => {
    const gpx = routeToGPX(route, routePoints);

    // Route-level name exists, but rtept should not have nested name elements
    expect(gpx).not.toMatch(/<rtept[^/]*>[\s\S]*<name>/);
  });

  it("uses route id as fallback name", () => {
    const unnamed = { ...route, name: null };
    const gpx = routeToGPX(unnamed, routePoints);

    expect(gpx).toContain("<name>Route 1</name>");
  });
});
