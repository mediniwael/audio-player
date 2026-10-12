import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import * as db from './db';

// The template imports an icon for Linux; if you don't have one yet,
// delete the next line and the spread below that uses it.
import icon from '../../resources/icon.png?asset';

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Load the Vite dev server in development, or the built HTML in production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// Called once when Electron has finished initializing.
// Some APIs can only be used after this event fires.
app.whenReady().then(async () => {
  // Set app user model id for Windows.
  electronApp.setAppUserModelId('com.electron');

  // Default open/close DevTools by F12 in development,
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  // Open the database before any IPC handlers fire.
  await db.open(app.getPath('userData'));

  // --- IPC handlers ---------------------------------------------------
  ipcMain.handle('ping', () => 'pong from main');

  ipcMain.handle('notes:list', () => db.listNotes());
  ipcMain.handle('notes:add', (_event, text: string) => {
    db.addNote(text);
    return db.listNotes();
  });
  // --------------------------------------------------------------------

  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and
    // there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Flush the database synchronously before the process exits.
// This must be synchronous — Electron does not await async handlers
// during shutdown.
app.on('before-quit', () => {
  try {
    db.closeSync();
  } catch (err) {
    console.error('Failed to close database:', err);
  }
});

// Quit when all windows are closed, except on macOS. There, apps stay
// active until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});