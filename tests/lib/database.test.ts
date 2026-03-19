import {
  startTrack,
  endTrack,
  insertTrackPoint,
  getTrack,
  getAllTracks,
  getTrackPoints,
  deleteTrack,
  renameTrack,
  insertMarker,
  getMarker,
  getAllMarkers,
  updateMarker,
  deleteMarker,
} from "@/lib/database";

// Mock expo-sqlite with an in-memory implementation
const rows: Record<string, any[]> = { tracks: [], track_points: [], markers: [] };
let autoIncrement: Record<string, number> = { tracks: 0, track_points: 0, markers: 0 };
let userVersion = 0;

const mockDb = {
  execAsync: jest.fn(async (sql: string) => {
    // Handle PRAGMA user_version setting
    const versionMatch = sql.match(/PRAGMA user_version = (\d+)/);
    if (versionMatch) {
      userVersion = parseInt(versionMatch[1]);
    }
    // For CREATE TABLE, just succeed
  }),
  getFirstAsync: jest.fn(async (sql: string, ...args: any[]) => {
    if (sql.includes("PRAGMA user_version")) {
      return { user_version: userVersion };
    }
    if (sql.includes("FROM tracks WHERE id")) {
      const id = args[0];
      return rows.tracks.find((t) => t.id === id) ?? null;
    }
    if (sql.includes("FROM markers WHERE id")) {
      const id = args[0];
      return rows.markers.find((m) => m.id === id) ?? null;
    }
    return null;
  }),
  getAllAsync: jest.fn(async (sql: string, ...args: any[]) => {
    if (sql.includes("FROM tracks ORDER BY")) {
      return [...rows.tracks].reverse();
    }
    if (sql.includes("FROM track_points WHERE track_id")) {
      const trackId = args[0];
      return rows.track_points.filter((p) => p.track_id === trackId);
    }
    if (sql.includes("FROM markers ORDER BY")) {
      return [...rows.markers].reverse();
    }
    return [];
  }),
  runAsync: jest.fn(async (sql: string, ...args: any[]) => {
    if (sql.includes("INSERT INTO tracks")) {
      const id = ++autoIncrement.tracks;
      rows.tracks.push({
        id,
        name: null,
        started_at: args[0],
        ended_at: null,
        distance: 0,
        color: null,
      });
      return { lastInsertRowId: id };
    }
    if (sql.includes("INSERT INTO track_points")) {
      const id = ++autoIncrement.track_points;
      rows.track_points.push({
        id,
        track_id: args[0],
        latitude: args[1],
        longitude: args[2],
        speed: args[3],
        heading: args[4],
        accuracy: args[5],
        timestamp: args[6],
      });
      return { lastInsertRowId: id };
    }
    if (sql.includes("INSERT INTO markers")) {
      const id = ++autoIncrement.markers;
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
    if (sql.includes("UPDATE tracks SET ended_at")) {
      const track = rows.tracks.find((t) => t.id === args[2]);
      if (track) {
        track.ended_at = args[0];
        track.distance = args[1];
      }
      return { changes: track ? 1 : 0 };
    }
    if (sql.includes("UPDATE tracks SET name")) {
      const track = rows.tracks.find((t) => t.id === args[1]);
      if (track) track.name = args[0];
      return { changes: track ? 1 : 0 };
    }
    if (sql.match(/UPDATE markers SET .+ WHERE id/)) {
      const id = args[args.length - 1];
      const marker = rows.markers.find((m) => m.id === id);
      if (marker) {
        // Parse SET clause to apply updates
        const setMatch = sql.match(/SET (.+) WHERE/);
        if (setMatch) {
          const keys = setMatch[1].split(", ").map((s) => s.replace(" = ?", "").trim());
          keys.forEach((key, i) => { marker[key] = args[i]; });
        }
      }
      return { changes: marker ? 1 : 0 };
    }
    if (sql.includes("DELETE FROM track_points WHERE track_id")) {
      rows.track_points = rows.track_points.filter(
        (p) => p.track_id !== args[0],
      );
      return { changes: 0 };
    }
    if (sql.includes("DELETE FROM tracks WHERE id")) {
      rows.tracks = rows.tracks.filter((t) => t.id !== args[0]);
      return { changes: 0 };
    }
    if (sql.includes("DELETE FROM markers WHERE id")) {
      rows.markers = rows.markers.filter((m) => m.id !== args[0]);
      return { changes: 0 };
    }
    return { lastInsertRowId: 0, changes: 0 };
  }),
};

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

beforeEach(() => {
  rows.tracks = [];
  rows.track_points = [];
  rows.markers = [];
  autoIncrement = { tracks: 0, track_points: 0, markers: 0 };
});

describe("database", () => {
  describe("tracks", () => {
    it("creates a track and returns the track object", async () => {
      const track = await startTrack();
      expect(track.id).toBe(1);
      expect(track.started_at).toBeTruthy();
      expect(track.ended_at).toBeNull();
    });

    it("ends a track with distance", async () => {
      const { id } = await startTrack();
      await endTrack(id, 1234.5);

      const track = await getTrack(id);
      expect(track!.ended_at).toBeTruthy();
      expect(track!.distance).toBe(1234.5);
    });

    it("lists all tracks in reverse chronological order", async () => {
      const t1 = await startTrack();
      const t2 = await startTrack();

      const tracks = await getAllTracks();
      expect(tracks).toHaveLength(2);
      expect(tracks[0].id).toBe(t2.id);
      expect(tracks[1].id).toBe(t1.id);
    });

    it("renames a track", async () => {
      const { id } = await startTrack();
      await renameTrack(id, "Morning sail");

      const track = await getTrack(id);
      expect(track!.name).toBe("Morning sail");
    });

    it("deletes a track and its points", async () => {
      const { id } = await startTrack();
      await insertTrackPoint(id, {
        coords: { latitude: 47.6, longitude: -122.3, speed: 2.5, heading: 180, accuracy: 5, altitude: null, altitudeAccuracy: null },
        timestamp: Date.now(),
      });

      await deleteTrack(id);

      const track = await getTrack(id);
      expect(track).toBeNull();

      const points = await getTrackPoints(id);
      expect(points).toHaveLength(0);
    });
  });

  describe("track points", () => {
    it("inserts and retrieves points for a track", async () => {
      const { id: trackId } = await startTrack();

      await insertTrackPoint(trackId, {
        coords: { latitude: 47.6062, longitude: -122.3321, speed: 2.5, heading: 180, accuracy: 5, altitude: null, altitudeAccuracy: null },
        timestamp: new Date("2025-01-01T00:00:00Z").getTime(),
      });
      await insertTrackPoint(trackId, {
        coords: { latitude: 47.607, longitude: -122.333, speed: 3.0, heading: 185, accuracy: 4, altitude: null, altitudeAccuracy: null },
        timestamp: new Date("2025-01-01T00:00:05Z").getTime(),
      });

      const points = await getTrackPoints(trackId);
      expect(points).toHaveLength(2);
      expect(points[0].latitude).toBe(47.6062);
      expect(points[1].latitude).toBe(47.607);
    });

    it("handles null speed and heading", async () => {
      const { id: trackId } = await startTrack();

      await insertTrackPoint(trackId, {
        coords: { latitude: 47.6, longitude: -122.3, speed: null, heading: null, accuracy: null, altitude: null, altitudeAccuracy: null },
        timestamp: new Date("2025-01-01T00:00:00Z").getTime(),
      });

      const points = await getTrackPoints(trackId);
      expect(points[0].speed).toBeNull();
      expect(points[0].heading).toBeNull();
    });
  });

  describe("markers", () => {
    it("inserts and retrieves a marker", async () => {
      const marker = await insertMarker({ latitude: 47.6, longitude: -122.3 });
      expect(marker.id).toBe(1);
      expect(marker.latitude).toBe(47.6);
      expect(marker.longitude).toBe(-122.3);
      expect(marker.name).toBeNull();
      expect(marker.created_at).toBeTruthy();
    });

    it("inserts a marker with all fields", async () => {
      const marker = await insertMarker({
        latitude: 47.6,
        longitude: -122.3,
        name: "Home Cove",
        notes: "Great anchorage",
        color: "#FF0000",
        icon: "mappin",
      });
      expect(marker.name).toBe("Home Cove");
      expect(marker.color).toBe("#FF0000");
    });

    it("lists all markers", async () => {
      await insertMarker({ latitude: 47.6, longitude: -122.3 });
      await insertMarker({ latitude: 47.7, longitude: -122.4 });

      const markers = await getAllMarkers();
      expect(markers).toHaveLength(2);
    });

    it("updates marker fields", async () => {
      const { id } = await insertMarker({ latitude: 47.6, longitude: -122.3 });
      await updateMarker(id, { name: "Sunset Cove" });

      const marker = await getMarker(id);
      expect(marker!.name).toBe("Sunset Cove");
    });

    it("deletes a marker", async () => {
      const { id } = await insertMarker({ latitude: 47.6, longitude: -122.3 });
      await deleteMarker(id);

      const marker = await getMarker(id);
      expect(marker).toBeNull();
    });
  });
});
