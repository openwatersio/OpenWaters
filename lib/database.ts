import { LocationObject } from "expo-location";
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "app.db";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const { user_version: currentVersion } = (await db.getFirstAsync<{
    user_version: number;
  }>("PRAGMA user_version")) ?? { user_version: 0 };

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        distance REAL NOT NULL DEFAULT 0,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS track_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        speed REAL,
        heading REAL,
        accuracy REAL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_track_points_track_id
        ON track_points(track_id);

      CREATE TABLE IF NOT EXISTS markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        notes TEXT,
        color TEXT,
        icon TEXT,
        created_at TEXT NOT NULL
      );

      PRAGMA user_version = 1;
    `);
  }

  if (currentVersion < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS route_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        name TEXT,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_route_points_route_id
        ON route_points(route_id);

      PRAGMA user_version = 2;
    `);
  }
}

// -- Track operations --

export type Track = {
  id: number;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  distance: number;
  color: string | null;
};

export type TrackPoint = {
  id: number;
  track_id: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  timestamp: string;
};

export async function startTrack(): Promise<Track> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO tracks (started_at) VALUES (?)",
    new Date().toISOString(),
  );
  const track = await db.getFirstAsync<Track>(
    "SELECT * FROM tracks WHERE id = ?",
    result.lastInsertRowId,
  );
  return track!;
}

export async function endTrack(
  trackId: number,
  distance: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE tracks SET ended_at = ?, distance = ? WHERE id = ?",
    new Date().toISOString(),
    distance,
    trackId,
  );
}

export async function insertTrackPoint(
  trackId: number,
  { coords, timestamp }: LocationObject,
): Promise<void> {
  const { latitude, longitude, speed, heading, accuracy } = coords;
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO track_points (track_id, latitude, longitude, speed, heading, accuracy, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    trackId,
    latitude,
    longitude,
    speed,
    heading,
    accuracy,
    new Date(timestamp).toISOString(),
  );
}

export async function getTrack(trackId: number): Promise<Track | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Track>("SELECT * FROM tracks WHERE id = ?", trackId);
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await getDatabase();
  return db.getAllAsync<Track>("SELECT * FROM tracks ORDER BY started_at DESC");
}

export type TrackWithStats = Track & {
  avg_speed: number | null; // m/s
  max_speed: number | null; // m/s
};

export async function getTrackDistances(
  lat: number,
  lng: number,
): Promise<Map<number, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ track_id: number; dist_sq: number }>(
    `SELECT track_id,
       MIN((latitude - ?) * (latitude - ?) + (longitude - ?) * (longitude - ?)) as dist_sq
     FROM track_points
     GROUP BY track_id`,
    lat,
    lat,
    lng,
    lng,
  );
  return new Map(rows.map((r) => [r.track_id, r.dist_sq]));
}

export async function getAllTracksWithStats(): Promise<TrackWithStats[]> {
  const db = await getDatabase();
  return db.getAllAsync<TrackWithStats>(`
    SELECT t.*,
      AVG(tp.speed) as avg_speed,
      MAX(tp.speed) as max_speed
    FROM tracks t
    LEFT JOIN track_points tp ON tp.track_id = t.id AND tp.speed IS NOT NULL
    GROUP BY t.id
    ORDER BY t.started_at DESC
  `);
}

export async function getTrackPoints(trackId: number): Promise<TrackPoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<TrackPoint>(
    "SELECT * FROM track_points WHERE track_id = ? ORDER BY timestamp ASC",
    trackId,
  );
}

export async function deleteTrack(trackId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM track_points WHERE track_id = ?", trackId);
  await db.runAsync("DELETE FROM tracks WHERE id = ?", trackId);
}

export async function renameTrack(
  trackId: number,
  name: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE tracks SET name = ? WHERE id = ?", name, trackId);
}

export type SpeedStats = {
  avgSpeed: number;
  maxSpeed: number;
};

// -- Marker operations --

export type Marker = {
  id: number;
  name: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
};

export type MarkerFields = {
  latitude: number;
  longitude: number;
  name?: string | null;
  notes?: string | null;
  color?: string | null;
  icon?: string | null;
};

export async function insertMarker(fields: MarkerFields): Promise<Marker> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO markers (latitude, longitude, name, notes, color, icon, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    fields.latitude,
    fields.longitude,
    fields.name ?? null,
    fields.notes ?? null,
    fields.color ?? null,
    fields.icon ?? null,
    new Date().toISOString(),
  );
  const marker = await db.getFirstAsync<Marker>(
    "SELECT * FROM markers WHERE id = ?",
    result.lastInsertRowId,
  );
  return marker!;
}

export async function getMarker(id: number): Promise<Marker | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Marker>("SELECT * FROM markers WHERE id = ?", id);
}

export async function getAllMarkers(): Promise<Marker[]> {
  const db = await getDatabase();
  return db.getAllAsync<Marker>(
    "SELECT * FROM markers ORDER BY created_at DESC",
  );
}

export async function updateMarker(
  id: number,
  fields: Partial<
    Pick<Marker, "name" | "notes" | "color" | "icon" | "latitude" | "longitude">
  >,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClauses = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE markers SET ${setClauses} WHERE id = ?`,
    ...values,
    id,
  );
}

export async function deleteMarker(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM markers WHERE id = ?", id);
}

// -- Route operations --

export type Route = {
  id: number;
  name: string | null;
  created_at: string;
  updated_at: string;
};

export type RoutePoint = {
  id: number;
  route_id: number;
  position: number;
  latitude: number;
  longitude: number;
};

export type RouteWithStats = Route & {
  point_count: number;
  total_distance: number; // meters, computed from point positions in store
};

export async function insertRoute(name?: string): Promise<Route> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    "INSERT INTO routes (name, created_at, updated_at) VALUES (?, ?, ?)",
    name ?? null,
    now,
    now,
  );
  const route = await db.getFirstAsync<Route>(
    "SELECT * FROM routes WHERE id = ?",
    result.lastInsertRowId,
  );
  return route!;
}

export async function getRoute(id: number): Promise<Route | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Route>("SELECT * FROM routes WHERE id = ?", id);
}

export async function getAllRoutes(): Promise<Route[]> {
  const db = await getDatabase();
  return db.getAllAsync<Route>(
    "SELECT * FROM routes ORDER BY updated_at DESC",
  );
}

export async function getAllRoutesWithStats(): Promise<RouteWithStats[]> {
  const db = await getDatabase();
  return db.getAllAsync<RouteWithStats>(`
    SELECT r.*, COUNT(rp.id) as point_count, 0 as total_distance
    FROM routes r
    LEFT JOIN route_points rp ON rp.route_id = r.id
    GROUP BY r.id
    ORDER BY r.updated_at DESC
  `);
}

export async function updateRoute(
  id: number,
  fields: Partial<Pick<Route, "name">>,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClauses = [...entries.map(([k]) => `${k} = ?`), "updated_at = ?"].join(", ");
  const values = entries.map(([, v]) => v);
  await db.runAsync(
    `UPDATE routes SET ${setClauses} WHERE id = ?`,
    ...values,
    new Date().toISOString(),
    id,
  );
}

export async function deleteRoute(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM route_points WHERE route_id = ?", id);
  await db.runAsync("DELETE FROM routes WHERE id = ?", id);
}

export async function getRoutePoints(routeId: number): Promise<RoutePoint[]> {
  const db = await getDatabase();
  return db.getAllAsync<RoutePoint>(
    "SELECT * FROM route_points WHERE route_id = ? ORDER BY position ASC",
    routeId,
  );
}

export async function insertRoutePoint(
  routeId: number,
  fields: { latitude: number; longitude: number; position: number },
): Promise<RoutePoint> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO route_points (route_id, position, latitude, longitude)
     VALUES (?, ?, ?, ?)`,
    routeId,
    fields.position,
    fields.latitude,
    fields.longitude,
  );
  await db.runAsync(
    "UPDATE routes SET updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    routeId,
  );
  const point = await db.getFirstAsync<RoutePoint>(
    "SELECT * FROM route_points WHERE id = ?",
    result.lastInsertRowId,
  );
  return point!;
}

export async function updateRoutePoint(
  id: number,
  fields: Partial<Pick<RoutePoint, "latitude" | "longitude">>,
): Promise<void> {
  const db = await getDatabase();
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClauses = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v as number);
  await db.runAsync(
    `UPDATE route_points SET ${setClauses} WHERE id = ?`,
    ...values,
    id,
  );
}

export async function deleteRoutePoint(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM route_points WHERE id = ?", id);
}

export async function reorderRoutePoints(
  routeId: number,
  pointIds: number[],
): Promise<void> {
  const db = await getDatabase();
  for (let i = 0; i < pointIds.length; i++) {
    await db.runAsync(
      "UPDATE route_points SET position = ? WHERE id = ? AND route_id = ?",
      i,
      pointIds[i],
      routeId,
    );
  }
  await db.runAsync(
    "UPDATE routes SET updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    routeId,
  );
}

export async function getAllTimeSpeedStats(): Promise<SpeedStats> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ avg_speed: number; max_speed: number }>(
    `SELECT COALESCE(AVG(speed), 0) as avg_speed, COALESCE(MAX(speed), 0) as max_speed
     FROM track_points tp
     JOIN tracks t ON tp.track_id = t.id
     WHERE tp.speed IS NOT NULL AND t.ended_at IS NOT NULL`,
  );
  return {
    avgSpeed: row?.avg_speed ?? 0,
    maxSpeed: row?.max_speed ?? 0,
  };
}
