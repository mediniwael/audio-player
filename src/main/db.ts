import fs from 'fs';
import path from 'path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type {
  Folder,
  Track,
  Playlist,
  PlaylistEntry,
  PlaylistWithEntries,
  MediaType
} from '../shared/api';

// ---------- Module state ----------

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbPath: string | null = null;

let saveTimer: NodeJS.Timeout | null = null;
let saving = false;
let dirty = false;

const SAVE_DEBOUNCE_MS = 500;
const CURRENT_SCHEMA_VERSION = 1;

// ---------- URL helper ----------

// The renderer needs URLs it can hand to the media element. Paths on disk
// are converted to `media://file/<encoded>` URLs, which are handled by the
// custom protocol registered in main/index.ts.
function toMediaUrl(absPath: string): string {
  return `media://file/${encodeURIComponent(absPath)}`;
}

// Natural sort collator. `numeric: true` makes "2" come before "10" instead
// of after it, which is what humans expect for numbered files.
const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

// Sort a list of tracks in natural order. Uses title if present, falling
// back to the file path for tracks with no title tag. Path is the tiebreaker
// when two tracks share a title.
function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    const aKey = (a.title ?? a.path).trim();
    const bKey = (b.title ?? b.path).trim();
    const primary = naturalCollator.compare(aKey, bKey);
    if (primary !== 0) return primary;
    return naturalCollator.compare(a.path, b.path);
  });
}

// ---------- Lifecycle ----------

export async function open(userDataDir: string): Promise<void> {
  dbPath = path.join(userDataDir, 'library.db');

  const sqlJsDir = path.dirname(require.resolve('sql.js'));
  const wasmBuffer = fs.readFileSync(path.join(sqlJsDir, 'sql-wasm.wasm'));
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer;

  SQL = await initSqlJs({ wasmBinary });

  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  db.run('PRAGMA foreign_keys = ON;');

  const fkRow = db.exec('PRAGMA foreign_keys;');
  console.log('[db] foreign_keys =', fkRow);
  migrate();
}

export async function close(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await save();
  if (db) {
    db.close();
    db = null;
  }
}

// Synchronous flush for `app.on('before-quit')`. Electron does not await
// async handlers during shutdown, so this must complete inline.
export function closeSync(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (db && dbPath) {
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
    db.close();
    db = null;
  }
}

// ---------- Persistence ----------

function markDirty(): void {
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    save().catch((err) => console.error('[db] save failed:', err));
  }, SAVE_DEBOUNCE_MS);
}

async function save(): Promise<void> {
  if (!dirty || saving || !db || !dbPath) return;
  saving = true;
  dirty = false;
  try {
    const data = db.export();
    const tmp = dbPath + '.tmp';
    await fs.promises.writeFile(tmp, Buffer.from(data));
    await fs.promises.rename(tmp, dbPath); // atomic replace
  } catch (err) {
    console.error('[db] save failed:', err);
    dirty = true; // retry on next mutation
  } finally {
    saving = false;
  }
}

// Force an immediate flush. Call after bulk operations (a scan finishes,
// a playlist is reordered) to guarantee the changes are on disk.
export async function flush(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await save();
}

// ---------- Query helpers ----------

type SqlParam = string | number | null | Uint8Array;

function requireDb(): Database {
  if (!db) throw new Error('Database not open');
  return db;
}

function queryAll<T extends object>(
  sql: string,
  params: SqlParam[] = []
): T[] {
  const stmt = requireDb().prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function queryOne<T extends object>(
  sql: string,
  params: SqlParam[] = []
): T | null {
  const rows = queryAll<T>(sql, params);
  return rows[0] ?? null;
}

function run(sql: string, params: SqlParam[] = []): void {
  requireDb().run(sql, params);
  markDirty();
}

// ---------- Migrations ----------

function migrate(): void {
  const database = requireDb();

  database.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `);

  const row = queryOne<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion >= CURRENT_SCHEMA_VERSION) return;

  const migrations: Array<{ version: number; apply: (d: Database) => void }> = [
    {
      version: 1,
      apply: (d) => {
        d.run(`
          CREATE TABLE folders (
            id   INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL
          );

          CREATE TABLE tracks (
            id                INTEGER PRIMARY KEY,
            path              TEXT UNIQUE NOT NULL,
            folder_id         INTEGER NOT NULL,
            media_type        TEXT    NOT NULL DEFAULT 'audio',
            title             TEXT,
            artist            TEXT,
            album             TEXT,
            duration          REAL,
            mtime             INTEGER,
            position          REAL    NOT NULL DEFAULT 0,
            position_updated  INTEGER,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
          );

          -- No FK to playlist_tracks here; forward references in SQLite
          -- circular FKs are fragile. The trigger below handles cursor
          -- cleanup when an entry is deleted.
          CREATE TABLE playlists (
            id               INTEGER PRIMARY KEY,
            name             TEXT NOT NULL,
            current_entry_id INTEGER,
            created_at       INTEGER,
            updated_at       INTEGER
          );

          CREATE TABLE playlist_tracks (
            id           INTEGER PRIMARY KEY,
            playlist_id  INTEGER NOT NULL,
            track_id     INTEGER NOT NULL,
            sort_order   INTEGER NOT NULL,
            added_at     INTEGER,
            UNIQUE (playlist_id, track_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (track_id)    REFERENCES tracks(id)    ON DELETE CASCADE
          );

          CREATE TABLE settings (
            key   TEXT PRIMARY KEY,
            value TEXT
          );

          CREATE INDEX idx_tracks_folder      ON tracks(folder_id);
          CREATE INDEX idx_tracks_media_type  ON tracks(media_type);
          CREATE INDEX idx_pt_playlist        ON playlist_tracks(playlist_id, sort_order);
          CREATE INDEX idx_pt_track           ON playlist_tracks(track_id);

          -- When a playlist entry is deleted (manually or via cascade from
          -- a track removal), clear any playlist whose cursor pointed at it.
          CREATE TRIGGER clear_cursor_on_entry_delete
          AFTER DELETE ON playlist_tracks
          BEGIN
            UPDATE playlists
              SET current_entry_id = NULL
              WHERE current_entry_id = OLD.id;
          END;
        `);
      }
    }
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      migration.apply(database);
      database.run('INSERT INTO schema_version (version) VALUES (?)', [
        migration.version
      ]);
      markDirty();
    }
  }
}

// ---------- Settings ----------

export function getSetting(key: string): string | null {
  const row = queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// ---------- Folders ----------

export function listFolders(): Folder[] {
  return queryAll<Folder>('SELECT id, path FROM folders ORDER BY path');
}

export function addFolders(paths: string[]): Folder[] {
  const database = requireDb();
  let changed = false;

  database.run('BEGIN');
  try {
    const stmt = database.prepare('INSERT OR IGNORE INTO folders (path) VALUES (?)');
    for (const p of paths) {
      stmt.run([p]);
      if (database.getRowsModified() > 0) changed = true;
    }
    stmt.free();
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }

  if (changed) markDirty();
  return listFolders();
}

export function removeFolder(id: number): void {
  const database = requireDb();
  database.run('BEGIN');
  try {
    // Find the tracks in this folder so we can clean up their playlist
    // entries explicitly.
    const trackRows = queryAll<{ id: number }>(
      'SELECT id FROM tracks WHERE folder_id = ?',
      [id]
    );
    if (trackRows.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < trackRows.length; i += CHUNK) {
        const chunk = trackRows.slice(i, i + CHUNK).map((r) => r.id);
        const placeholders = chunk.map(() => '?').join(',');
        database.run(
          `DELETE FROM playlist_tracks WHERE track_id IN (${placeholders})`,
          chunk
        );
      }
    }
    database.run('DELETE FROM tracks WHERE folder_id = ?', [id]);
    database.run('DELETE FROM folders WHERE id = ?', [id]);
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }
  markDirty();
}

// ---------- Tracks ----------

interface TrackRow {
  id: number;
  path: string;
  folder_id: number;
  media_type: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  position: number;
}

function rowToTrack(row: TrackRow): Track {
  return {
    id: row.id,
    path: row.path,
    folder_id: row.folder_id,
    media_type: row.media_type as MediaType,
    title: row.title,
    artist: row.artist,
    album: row.album,
    duration: row.duration,
    position: row.position,
    url: toMediaUrl(row.path)
  };
}

const TRACK_COLUMNS = `
  id, path, folder_id, media_type, title, artist, album, duration, position
`;

export function listTracks(): Track[] {
  const rows = queryAll<TrackRow>(`
    SELECT ${TRACK_COLUMNS}
    FROM tracks
    WHERE media_type = 'audio'
    ORDER BY path
  `);
  return sortTracks(rows.map(rowToTrack));
}

export function listTracksInFolder(folderId: number): Track[] {
  const rows = queryAll<TrackRow>(
    `SELECT ${TRACK_COLUMNS}
     FROM tracks
     WHERE folder_id = ? AND media_type = 'audio'
     ORDER BY path`,
    [folderId]
  );
  return sortTracks(rows.map(rowToTrack));
}

export function getTrackPosition(id: number): number {
  const row = queryOne<{ position: number }>(
    'SELECT position FROM tracks WHERE id = ?',
    [id]
  );
  return row?.position ?? 0;
}

export function saveTrackPosition(id: number, seconds: number): void {
  run(
    'UPDATE tracks SET position = ?, position_updated = ? WHERE id = ?',
    [seconds, Date.now(), id]
  );
}

// Used by the scanner to build a set of "known" files for the folder.
export function tracksInFolderAsMap(folderId: number): Map<string, number> {
  const rows = queryAll<{ path: string; mtime: number | null }>(
    'SELECT path, mtime FROM tracks WHERE folder_id = ?',
    [folderId]
  );
  return new Map(rows.map((r) => [r.path, r.mtime ?? 0]));
}

export interface TrackInsert {
  path: string;
  folder_id: number;
  media_type: MediaType;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  mtime: number;
}

export function upsertTracks(rows: TrackInsert[]): void {
  if (rows.length === 0) return;
  const database = requireDb();

  database.run('BEGIN');
  try {
    // CRITICAL: `position` and `position_updated` are absent from the
    // DO UPDATE SET list. This preserves resume state across rescans.
    const stmt = database.prepare(`
      INSERT INTO tracks
        (path, folder_id, media_type, title, artist, album, duration, mtime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        folder_id  = excluded.folder_id,
        media_type = excluded.media_type,
        title      = excluded.title,
        artist     = excluded.artist,
        album      = excluded.album,
        duration   = excluded.duration,
        mtime      = excluded.mtime
    `);
    for (const r of rows) {
      stmt.run([
        r.path,
        r.folder_id,
        r.media_type,
        r.title,
        r.artist,
        r.album,
        r.duration,
        r.mtime
      ]);
    }
    stmt.free();
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }

  markDirty();
}

export function deleteTracksByPath(folderId: number, paths: string[]): void {
  if (paths.length === 0) return;
  const database = requireDb();

  const CHUNK = 500;
  database.run('BEGIN');
  try {
    for (let i = 0; i < paths.length; i += CHUNK) {
      const chunk = paths.slice(i, i + CHUNK);

      // Find track ids for these paths.
      const placeholders = chunk.map(() => '?').join(',');
      const trackRows = queryAll<{ id: number }>(
        `SELECT id FROM tracks
         WHERE folder_id = ? AND path IN (${placeholders})`,
        [folderId, ...chunk]
      );

      // Clean up playlist entries for those tracks.
      if (trackRows.length > 0) {
        const trackIds = trackRows.map((r) => r.id);
        const trackPlaceholders = trackIds.map(() => '?').join(',');
        database.run(
          `DELETE FROM playlist_tracks WHERE track_id IN (${trackPlaceholders})`,
          trackIds
        );
      }

      // Delete the tracks themselves.
      database.run(
        `DELETE FROM tracks WHERE folder_id = ? AND path IN (${placeholders})`,
        [folderId, ...chunk]
      );
    }
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }

  markDirty();
}

// ---------- Playlists ----------

interface PlaylistRow {
  id: number;
  name: string;
  current_entry_id: number | null;
}

export function listPlaylists(): Playlist[] {
  return queryAll<PlaylistRow & { trackCount: number }>(`
    SELECT p.id, p.name, p.current_entry_id,
           COUNT(pt.id) AS trackCount
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `);
}

export function createPlaylist(name: string): Playlist {
  const database = requireDb();
  const now = Date.now();
  database.run(
    'INSERT INTO playlists (name, current_entry_id, created_at, updated_at) VALUES (?, NULL, ?, ?)',
    [name, now, now]
  );
  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() AS id');
  markDirty();
  return {
    id: row!.id,
    name,
    current_entry_id: null,
    trackCount: 0
  };
}

export function renamePlaylist(id: number, name: string): void {
  run('UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?', [
    name,
    Date.now(),
    id
  ]);
}

export function removePlaylist(id: number): void {
  const database = requireDb();
  database.run('BEGIN');
  try {
    // Explicit cascade. The FK cascade should handle this, but SQLite's
    // PRAGMA foreign_keys is connection-scoped and can be reset by tools
    // or driver quirks. Doing it by hand guarantees correctness.
    database.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [id]);
    database.run('DELETE FROM playlists WHERE id = ?', [id]);
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }
  markDirty();
}

interface PlaylistEntryRow {
  entry_id: number;
  playlist_id: number;
  track_id: number;
  sort_order: number;
  track_path: string;
  folder_id: number;
  media_type: string;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  position: number;
}

export function getPlaylist(id: number): PlaylistWithEntries | null {
  const playlist = queryOne<PlaylistRow>(
    'SELECT id, name, current_entry_id FROM playlists WHERE id = ?',
    [id]
  );
  if (!playlist) return null;

  const rows = queryAll<PlaylistEntryRow>(
    `SELECT
       pt.id AS entry_id,
       pt.playlist_id,
       pt.track_id,
       pt.sort_order,
       t.path AS track_path,
       t.folder_id,
       t.media_type,
       t.title, t.artist, t.album, t.duration, t.position
     FROM playlist_tracks pt
     JOIN tracks t ON t.id = pt.track_id
     WHERE pt.playlist_id = ?
     ORDER BY pt.sort_order`,
    [id]
  );

  const entries: PlaylistEntry[] = rows.map((r) => ({
    id: r.entry_id,
    playlist_id: r.playlist_id,
    track_id: r.track_id,
    sort_order: r.sort_order,
    track: rowToTrack({
      id: r.track_id,
      path: r.track_path,
      folder_id: r.folder_id,
      media_type: r.media_type,
      title: r.title,
      artist: r.artist,
      album: r.album,
      duration: r.duration,
      position: r.position
    })
  }));

  return {
    playlist: {
      id: playlist.id,
      name: playlist.name,
      current_entry_id: playlist.current_entry_id,
      trackCount: entries.length
    },
    entries
  };
}

export function addTracksToPlaylist(playlistId: number, trackIds: number[]): void {
  if (trackIds.length === 0) return;
  const database = requireDb();
  const now = Date.now();

  const maxRow = queryOne<{ max: number | null }>(
    'SELECT MAX(sort_order) AS max FROM playlist_tracks WHERE playlist_id = ?',
    [playlistId]
  );
  let nextOrder = (maxRow?.max ?? -1) + 1;

  database.run('BEGIN');
  try {
    const stmt = database.prepare(`
      INSERT OR IGNORE INTO playlist_tracks
        (playlist_id, track_id, sort_order, added_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const trackId of trackIds) {
      stmt.run([playlistId, trackId, nextOrder, now]);
      if (database.getRowsModified() > 0) {
        nextOrder++;
      }
      // If the track was already in the playlist, INSERT OR IGNORE
      // modified 0 rows and nextOrder stays where it was.
    }
    stmt.free();
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }

  markDirty();
}

export function removePlaylistEntry(entryId: number): void {
  // The trigger clear_cursor_on_entry_delete handles the cursor.
  run('DELETE FROM playlist_tracks WHERE id = ?', [entryId]);
}

export function reorderPlaylist(playlistId: number, entryIds: number[]): void {
  if (entryIds.length === 0) return;
  const database = requireDb();

  database.run('BEGIN');
  try {
    const stmt = database.prepare(
      'UPDATE playlist_tracks SET sort_order = ? WHERE id = ? AND playlist_id = ?'
    );
    entryIds.forEach((entryId, index) => {
      stmt.run([index, entryId, playlistId]);
    });
    stmt.free();
    database.run('COMMIT');
  } catch (err) {
    database.run('ROLLBACK');
    throw err;
  }

  markDirty();
}

export function setPlaylistCurrent(
  playlistId: number,
  entryId: number | null
): void {
  run(
    'UPDATE playlists SET current_entry_id = ?, updated_at = ? WHERE id = ?',
    [entryId, Date.now(), playlistId]
  );
}

export function getPlaylistCurrent(playlistId: number): number | null {
  const row = queryOne<{ current_entry_id: number | null }>(
    'SELECT current_entry_id FROM playlists WHERE id = ?',
    [playlistId]
  );
  return row?.current_entry_id ?? null;
}