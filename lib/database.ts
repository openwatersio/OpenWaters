import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "seascape.db";
const DATABASE_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const { user_version: currentVersion } =
    (await db.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    )) ?? { user_version: 0 };

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
    `);
  }

  if (currentVersion < DATABASE_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
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

export async function startTrack(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO tracks (started_at) VALUES (?)",
    new Date().toISOString(),
  );
  return result.lastInsertRowId;
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
  point: Omit<TrackPoint, "id" | "track_id">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO track_points (track_id, latitude, longitude, speed, heading, accuracy, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    trackId,
    point.latitude,
    point.longitude,
    point.speed,
    point.heading,
    point.accuracy,
    point.timestamp,
  );
}

export async function getTrack(trackId: number): Promise<Track | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Track>("SELECT * FROM tracks WHERE id = ?", trackId);
}

export async function getAllTracks(): Promise<Track[]> {
  const db = await getDatabase();
  return db.getAllAsync<Track>(
    "SELECT * FROM tracks ORDER BY started_at DESC",
  );
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
    lat, lat, lng, lng,
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
