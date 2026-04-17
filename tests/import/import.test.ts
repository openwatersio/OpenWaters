/**
 * Importer tests. Uses the same in-memory SQLite mock pattern as
 * tests/database.test.ts, but lighter — we only care that the importer
 * reaches the right helpers with the right counts.
 */
import { emptySummary, importGpxText } from "@/import";
import { toGPX, routeToGPX, markerToGPX } from "@/tracks/gpx";

const rows: Record<string, any[]> = {
  tracks: [],
  track_points: [],
  markers: [],
  routes: [],
  route_points: [],
};
let auto: Record<string, number> = {
  tracks: 0,
  track_points: 0,
  markers: 0,
  routes: 0,
  route_points: 0,
};
let userVersion = 8; // skip migrations

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb: any = {
  execAsync: jest.fn(async (sql: string) => {
    const m = sql.match(/PRAGMA user_version = (\d+)/);
    if (m) userVersion = parseInt(m[1]);
  }),
  getFirstAsync: jest.fn(async (sql: string, ...args: any[]) => {
    if (sql.includes("PRAGMA user_version"))
      return { user_version: userVersion };
    if (sql.includes("MAX(sequence)")) {
      const trackId = args[0];
      const pts = rows.track_points.filter((p) => p.track_id === trackId);
      const max = pts.reduce((m, p) => Math.max(m, p.sequence ?? -1), -1);
      return { next: max + 1 };
    }
    if (sql.includes("FROM tracks WHERE id"))
      return rows.tracks.find((t) => t.id === args[0]) ?? null;
    if (sql.includes("FROM routes WHERE id"))
      return rows.routes.find((r) => r.id === args[0]) ?? null;
    if (sql.includes("FROM markers WHERE id"))
      return rows.markers.find((m) => m.id === args[0]) ?? null;
    return null;
  }),
  getAllAsync: jest.fn(async () => []),
  runAsync: jest.fn(async (sql: string, ...rawArgs: any[]) => {
    // Handle both spread params (runAsync(sql, v1, v2)) and array params
    // (runAsync(sql, [v1, v2])) — the latter is used by insertTrackPoints
    // for the remainder chunk to avoid call-stack overflow from spreading
    // 32000+ values.
    const args = rawArgs.length === 1 && Array.isArray(rawArgs[0]) ? rawArgs[0] : rawArgs;
    if (sql.includes("INSERT INTO tracks (name,")) {
      const id = ++auto.tracks;
      rows.tracks.push({
        id,
        name: args[0],
        started_at: args[1],
        ended_at: args[2],
        distance: args[3] ?? 0,
      });
      return { lastInsertRowId: id };
    }
    if (sql.includes("INSERT INTO track_points")) {
      // Multi-row INSERT: 8 args per row.
      let lastId = 0;
      for (let i = 0; i < args.length; i += 8) {
        const id = ++auto.track_points;
        lastId = id;
        rows.track_points.push({
          id,
          track_id: args[i + 0],
          sequence: args[i + 1],
          latitude: args[i + 2],
          longitude: args[i + 3],
          speed: args[i + 4],
          heading: args[i + 5],
          accuracy: args[i + 6],
          timestamp: args[i + 7],
        });
      }
      return { lastInsertRowId: lastId };
    }
    if (sql.includes("INSERT INTO markers")) {
      const id = ++auto.markers;
      rows.markers.push({
        id,
        latitude: args[0],
        longitude: args[1],
        name: args[2],
        notes: args[3],
        color: args[4],
        icon: args[5],
        created_at: args[6],
      });
      return { lastInsertRowId: id };
    }
    if (sql.includes("INSERT INTO routes")) {
      const id = ++auto.routes;
      rows.routes.push({
        id,
        name: args[0],
        created_at: args[1],
        updated_at: args[2],
        distance: 0,
      });
      return { lastInsertRowId: id };
    }
    if (sql.includes("INSERT INTO route_points")) {
      const id = ++auto.route_points;
      rows.route_points.push({
        id,
        route_id: args[0],
        order: args[1],
        latitude: args[2],
        longitude: args[3],
      });
      return { lastInsertRowId: id };
    }
    if (sql.match(/UPDATE routes SET .+ WHERE id/)) {
      const id = args[args.length - 1];
      const route = rows.routes.find((r) => r.id === id);
      if (route) {
        const setMatch = sql.match(/SET (.+) WHERE/);
        if (setMatch) {
          const keys = setMatch[1]
            .split(", ")
            .map((s) => s.replace(" = ?", "").trim());
          keys.forEach((key, i) => {
            route[key] = args[i];
          });
        }
      }
      return { changes: route ? 1 : 0 };
    }
    if (sql.includes("DELETE FROM route_points")) {
      rows.route_points = rows.route_points.filter(
        (p) => p.route_id !== args[0],
      );
      return { changes: 0 };
    }
    if (sql.match(/UPDATE tracks SET distance = \?, max_speed = \? WHERE id/)) {
      const track = rows.tracks.find((t) => t.id === args[2]);
      if (track) {
        track.distance = args[0];
        track.max_speed = args[1];
      }
      return { changes: track ? 1 : 0 };
    }
    if (sql.match(/UPDATE tracks SET distance = \? WHERE id/)) {
      const track = rows.tracks.find((t) => t.id === args[1]);
      if (track) track.distance = args[0];
      return { changes: track ? 1 : 0 };
    }
    return { lastInsertRowId: 0, changes: 0 };
  }),
  prepareAsync: jest.fn(async (sql: string) => ({
    executeAsync: jest.fn(async (params: any) => {
      const values = Array.isArray(params) ? params : [params];
      return mockDb.runAsync(sql, values);
    }),
    finalizeAsync: jest.fn(async () => {}),
  })),
  withTransactionAsync: jest.fn(async (task: () => Promise<void>) => {
    await task();
  }),
  closeAsync: jest.fn(async () => {}),
};

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

beforeEach(() => {
  rows.tracks = [];
  rows.track_points = [];
  rows.markers = [];
  rows.routes = [];
  rows.route_points = [];
  auto = {
    tracks: 0,
    track_points: 0,
    markers: 0,
    routes: 0,
    route_points: 0,
  };
});

describe("importGpxText", () => {
  it("marks the file as done and adds feature records for each wpt/rte/trk", async () => {
    const summary = emptySummary();
    const fileEntry = {
      name: "foo.gpx",
      status: "pending" as const,
    };
    summary.files.push(fileEntry);

    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="47.6" lon="-122.3"><name>A</name></wpt>
  <trk><trkseg><trkpt lat="47.6" lon="-122.3"/></trkseg></trk>
</gpx>`;
    await importGpxText(xml, { summary, file: fileEntry });

    expect(fileEntry.status).toBe("done");
    expect(summary.records).toHaveLength(2);
    expect(summary.records.every((r) => r.status === "done")).toBe(true);
    expect(summary.records.every((r) => r.file === "foo.gpx")).toBe(true);
  });

  it("falls back to the filename when a record has no name", async () => {
    const summary = emptySummary();
    const fileEntry = {
      name: "nameless.gpx",
      status: "pending" as const,
    };
    summary.files.push(fileEntry);

    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="47.6" lon="-122.3"/>
</gpx>`;
    await importGpxText(xml, { summary, file: fileEntry });

    const marker = summary.records.find((r) => r.type === "marker");
    expect(marker?.name).toBe("nameless.gpx");
  });

  it("mutates an externally-supplied summary in place", async () => {
    const summary = emptySummary();
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <wpt lat="47.6" lon="-122.3"><name>A</name></wpt>
  <wpt lat="47.7" lon="-122.4"><name>B</name></wpt>
</gpx>`;
    const returned = await importGpxText(xml, { summary });
    expect(returned).toBe(summary); // same reference
    const markers = summary.records.filter((r) => r.type === "marker");
    expect(markers).toHaveLength(2);
    expect(markers.every((r) => r.status === "done")).toBe(true);
  });

  it("imports waypoints as markers", async () => {
    const xml = markerToGPX({
      id: 1,
      name: "Home",
      latitude: 47.6,
      longitude: -122.3,
      notes: "Good spot",
      color: null,
      icon: "anchor",
      created_at: "2025-01-01T00:00:00Z",
    });
    const summary = await importGpxText(xml);
    const markers = summary.records.filter((r) => r.type === "marker");
    expect(markers).toHaveLength(1);
    expect(markers[0].status).toBe("done");
    expect(markers[0].id).toBe(1);
    expect(rows.markers[0]).toMatchObject({
      name: "Home",
      latitude: 47.6,
      longitude: -122.3,
      icon: "anchor",
    });
  });

  it("imports routes and writes points + distance", async () => {
    const xml = routeToGPX(
      {
        id: 1,
        name: "Test route",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        distance: 0,
      },
      [
        { id: 1, route_id: 1, order: 0, latitude: 47.6, longitude: -122.3 },
        { id: 2, route_id: 1, order: 1, latitude: 47.61, longitude: -122.31 },
      ],
    );
    const summary = await importGpxText(xml);
    const routes = summary.records.filter((r) => r.type === "route");
    expect(routes).toHaveLength(1);
    expect(routes[0].status).toBe("done");
    expect(rows.routes[0].name).toBe("Test route");
    expect(rows.route_points).toHaveLength(2);
    expect(rows.routes[0].distance).toBeGreaterThan(0);
  });

  it("round-trips a track through export and import", async () => {
    const xml = toGPX(
      {
        id: 1,
        name: "Morning sail",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T00:10:00Z",
        distance: 0,
        color: null,
        max_speed: null,
      },
      [
        {
          id: 1,
          track_id: 1,
          sequence: 0,
          latitude: 47.6,
          longitude: -122.3,
          speed: 2.5,
          heading: 180,
          accuracy: null,
          timestamp: "2025-01-01T00:00:00Z",
        },
        {
          id: 2,
          track_id: 1,
          sequence: 1,
          latitude: 47.605,
          longitude: -122.305,
          speed: 2.6,
          heading: 182,
          accuracy: null,
          timestamp: "2025-01-01T00:00:30Z",
        },
      ],
    );
    const summary = await importGpxText(xml);
    const tracks = summary.records.filter((r) => r.type === "track");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].status).toBe("done");
    expect(tracks[0].id).toBe(1);
    expect(rows.tracks[0].name).toBe("Morning sail");
    expect(rows.tracks[0].started_at).toBe("2025-01-01T00:00:00Z");
    expect(rows.track_points).toHaveLength(2);
    expect(rows.track_points[0].sequence).toBe(0);
    expect(rows.track_points[1].sequence).toBe(1);
  });

  it("imports a timestamp-less track", async () => {
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Hand-drawn</name><trkseg>
    <trkpt lat="47.6" lon="-122.3"/>
    <trkpt lat="47.7" lon="-122.4"/>
  </trkseg></trk>
</gpx>`;
    const summary = await importGpxText(xml);
    const tracks = summary.records.filter((r) => r.type === "track");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].status).toBe("done");
    expect(rows.tracks[0].ended_at).toBeNull();
    expect(rows.track_points[0].timestamp).toBeNull();
    expect(rows.track_points[0].sequence).toBe(0);
    expect(rows.track_points[1].sequence).toBe(1);
  });

  it("handles tracks with >4000 points (exercises prepared-statement bulk path)", async () => {
    const N = 4500;
    const trkpts = Array.from({ length: N }, (_, i) => {
      const lat = (47 + i * 0.0001).toFixed(6);
      const lon = (-122 - i * 0.0001).toFixed(6);
      return `<trkpt lat="${lat}" lon="${lon}"/>`;
    }).join("\n");
    const xml = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Big track</name><trkseg>
${trkpts}
  </trkseg></trk>
</gpx>`;
    const summary = await importGpxText(xml);
    const tracks = summary.records.filter((r) => r.type === "track");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].status).toBe("done");
    expect(rows.track_points).toHaveLength(N);
    expect(rows.track_points[0].sequence).toBe(0);
    expect(rows.track_points[N - 1].sequence).toBe(N - 1);
  });
});
