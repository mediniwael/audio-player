import fs from 'fs/promises';
import path from 'path';
import type { BrowserWindow } from 'electron';
import * as db from './db';
import type { MediaType, ScanResult } from '../shared/api';

const AUDIO_RE = /\.(mp3|flac|m4a|aac|ogg|opus|wav|wma|aiff)$/i;
const VIDEO_RE = /\.(mp4|m4v|webm|mkv)$/i;
const MEDIA_RE = /\.(mp3|flac|m4a|aac|ogg|opus|wav|wma|aiff|mp4|m4v|webm|mkv)$/i;

const BATCH_SIZE = 100;
const PROGRESS_EVERY = 50;

function classify(name: string): MediaType | null {
  if (AUDIO_RE.test(name)) return 'audio';
  if (VIDEO_RE.test(name)) return 'video';
  return null;
}

async function walk(
  dir: string,
  onFile: (fullPath: string) => Promise<void>
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    console.warn('[scanner] skipping unreadable directory:', dir);
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, onFile);
    } else if (entry.isFile() && MEDIA_RE.test(entry.name)) {
      await onFile(full);
    }
  }
}

export async function scanFolder(
  folderId: number,
  folderPath: string,
  win: BrowserWindow | null
): Promise<ScanResult> {
  const send = (channel: string, data: unknown): void => {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  };

  send('scan:start', { folderId, path: folderPath });

  // music-metadata is ESM-only; load lazily inside the async function.
  const mm = await import('music-metadata');

  const existing = db.tracksInFolderAsMap(folderId);
  const seen = new Set<string>();
  const pending: db.TrackInsert[] = [];
  let processed = 0;

  const flushPending = (): void => {
    if (pending.length > 0) {
      db.upsertTracks(pending.splice(0));
    }
  };

  await walk(folderPath, async (full) => {
    seen.add(full);
    processed++;

    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      return;
    }

    const mtime = Math.floor(stat.mtimeMs);

    // Skip parsing if the file hasn't changed.
    if (existing.get(full) === mtime) {
      if (processed % PROGRESS_EVERY === 0) {
        send('scan:progress', { folderId, processed });
      }
      return;
    }

    const mediaType = classify(full);
    if (!mediaType) return;

    try {
      const meta = await mm.parseFile(full);
      const baseName = path.basename(full, path.extname(full));

      pending.push({
        path: full,
        folder_id: folderId,
        media_type: mediaType,
        title: meta.common.title ?? baseName,
        artist: meta.common.artist ?? null,
        album: meta.common.album ?? null,
        duration: meta.format.duration ?? null,
        mtime
      });

      if (pending.length >= BATCH_SIZE) {
        flushPending();
      }
    } catch (err) {
      console.warn(
        '[scanner] failed to parse:',
        full,
        (err as Error).message
      );
    }

    if (processed % PROGRESS_EVERY === 0) {
      send('scan:progress', { folderId, processed });
    }
  });

  flushPending();

  // Delete rows whose paths weren't seen on disk this pass.
  const toDelete: string[] = [];
  for (const p of existing.keys()) {
    if (!seen.has(p)) toDelete.push(p);
  }
  if (toDelete.length > 0) {
    db.deleteTracksByPath(folderId, toDelete);
  }

  await db.flush();

  const result: ScanResult = {
    folderId,
    processed,
    deleted: toDelete.length
  };
  send('scan:done', result);
  return result;
}

export async function scanLibrary(
  win: BrowserWindow | null
): Promise<ScanResult[]> {
  const folders = db.listFolders();
  const results: ScanResult[] = [];
  for (const folder of folders) {
    const result = await scanFolder(folder.id, folder.path, win);
    results.push(result);
  }
  return results;
}