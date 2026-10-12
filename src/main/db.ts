import fs from 'fs';
import path from 'path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let dbPath: string | null = null;

export async function open(userDataDir: string): Promise<void> {
  dbPath = path.join(userDataDir, 'library.db');

  const sqlJsDir = path.dirname(require.resolve('sql.js'));
const wasmBuffer = fs.readFileSync(path.join(sqlJsDir, 'sql-wasm.wasm'));
const wasmBinary = wasmBuffer.buffer.slice(
  wasmBuffer.byteOffset,
  wasmBuffer.byteOffset + wasmBuffer.byteLength
);
  SQL = await initSqlJs({ wasmBinary });

  db = fs.existsSync(dbPath)
    ? new SQL.Database(fs.readFileSync(dbPath))
    : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL
    );
  `);

  persist();
}

function requireDb(): Database {
  if (!db) throw new Error('Database not open');
  return db;
}

export function addNote(text: string): void {
  requireDb().run('INSERT INTO notes (text) VALUES (?)', [text]);
  persist();
}

export function listNotes(): Array<{ id: number; text: string }> {
  const stmt = requireDb().prepare('SELECT * FROM notes ORDER BY id');
  const rows: Array<{ id: number; text: string }> = [];
  try {
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as { id: number; text: string });
    }
  } finally {
    stmt.free();
  }
  return rows;
}

export function closeSync(): void {
  if (db) {
    persist();
    db.close();
    db = null;
  }
}

function persist(): void {
  if (!db || !dbPath) return;
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}