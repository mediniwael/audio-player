import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as db from './db';
import fs from 'fs/promises';
import { scanLibrary } from './scanner';

export function registerIpcHandlers(): void {
  // ---------- Folders ----------
  ipcMain.handle('folders:list', () => db.listFolders());

  ipcMain.handle('folders:add', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return db.listFolders();
    }
    return db.addFolders(result.filePaths);
  });

  ipcMain.handle('folders:remove', (_e, id: number) => {
    if (typeof id !== 'number') throw new Error('invalid folder id');
    db.removeFolder(id);
    return db.listFolders();
  });

  // ---------- Library ----------
  ipcMain.handle('library:scan', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const results = await scanLibrary(win);
    if (win && !win.isDestroyed()) {
      win.webContents.send('scan:finished', results);
    }
    return results;
  });

  // ---------- Tracks ----------
  ipcMain.handle('tracks:list', () => db.listTracks());

  ipcMain.handle('tracks:inFolder', (_e, folderId: number) => {
    if (typeof folderId !== 'number') throw new Error('invalid folder id');
    return db.listTracksInFolder(folderId);
  });

  ipcMain.handle('tracks:getPosition', (_e, id: number) => {
    if (typeof id !== 'number') throw new Error('invalid track id');
    return db.getTrackPosition(id);
  });

  ipcMain.handle(
    'tracks:savePosition',
    (_e, id: number, seconds: number) => {
      if (typeof id !== 'number' || typeof seconds !== 'number') {
        throw new Error('invalid savePosition args');
      }
      db.saveTrackPosition(id, seconds);
    }
  );

  // ---------- Playlists ----------
  ipcMain.handle('playlists:list', () => db.listPlaylists());

  ipcMain.handle('playlists:create', (_e, name: string) => {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('invalid playlist name');
    }
    return db.createPlaylist(name);
  });

  ipcMain.handle('playlists:rename', (_e, id: number, name: string) => {
    if (typeof id !== 'number' || typeof name !== 'string') {
      throw new Error('invalid rename args');
    }
    db.renamePlaylist(id, name);
  });

  ipcMain.handle('playlists:remove', (_e, id: number) => {
    if (typeof id !== 'number') throw new Error('invalid playlist id');
    db.removePlaylist(id);
  });

  ipcMain.handle('playlists:get', (_e, id: number) => {
    if (typeof id !== 'number') throw new Error('invalid playlist id');
    return db.getPlaylist(id);
  });

  ipcMain.handle(
    'playlists:addTracks',
    (_e, playlistId: number, trackIds: number[]) => {
      if (typeof playlistId !== 'number' || !Array.isArray(trackIds)) {
        throw new Error('invalid addTracks args');
      }
      db.addTracksToPlaylist(playlistId, trackIds);
    }
  );

  ipcMain.handle('playlists:removeEntry', (_e, entryId: number) => {
    if (typeof entryId !== 'number') throw new Error('invalid entry id');
    db.removePlaylistEntry(entryId);
  });

  ipcMain.handle(
    'playlists:reorder',
    (_e, playlistId: number, entryIds: number[]) => {
      if (typeof playlistId !== 'number' || !Array.isArray(entryIds)) {
        throw new Error('invalid reorder args');
      }
      db.reorderPlaylist(playlistId, entryIds);
    }
  );

  ipcMain.handle(
    'playlists:setCurrent',
    (_e, playlistId: number, entryId: number | null) => {
      if (typeof playlistId !== 'number') {
        throw new Error('invalid playlist id');
      }
      if (entryId !== null && typeof entryId !== 'number') {
        throw new Error('invalid entry id');
      }
      db.setPlaylistCurrent(playlistId, entryId);
    }
  );

  ipcMain.handle('playlists:getCurrent', (_e, playlistId: number) => {
    if (typeof playlistId !== 'number') throw new Error('invalid playlist id');
    return db.getPlaylistCurrent(playlistId);
  });

  // ---------- Settings ----------
  ipcMain.handle('settings:get', (_e, key: string) => {
    if (typeof key !== 'string') throw new Error('invalid key');
    return db.getSetting(key);
  });

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new Error('invalid set args');
    }
    db.setSetting(key, value);
  });

  ipcMain.handle(
    'files:saveJson',
    async (_e, defaultName: string, content: string) => {
      if (typeof defaultName !== 'string' || typeof content !== 'string') {
        throw new Error('invalid saveJson args');
      }
      const result = await dialog.showSaveDialog({
        defaultPath: defaultName,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (result.canceled || !result.filePath) return false;
      await fs.writeFile(result.filePath, content, 'utf-8');
      return true;
    }
  );
}