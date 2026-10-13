import { app, shell, BrowserWindow,  protocol } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import * as db from './db';
import icon from '../../resources/icon.png?asset';
import { registerIpcHandlers } from './ipc';
import fs from 'fs/promises';
import { extname } from 'path';

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wma': 'audio/x-ms-wma',
  '.aiff': 'audio/aiff',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska'
};

function mimeFor(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

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

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
]);

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  await db.open(app.getPath('userData'));
  registerIpcHandlers();

  protocol.handle('media', async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.slice(1));

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return new Response('Not found', { status: 404 });
    }

    const total = stat.size;
    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      // Format: "bytes=START-END", or "bytes=START-", or "bytes=-SUFFIX"
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        return new Response('Invalid range', { status: 416 });
      }

      let start: number;
      let end: number;

      if (match[1] === '' && match[2] !== '') {
        // Suffix range: last N bytes
        const suffix = parseInt(match[2], 10);
        start = Math.max(0, total - suffix);
        end = total - 1;
      } else {
        start = parseInt(match[1], 10);
        end = match[2] !== '' ? parseInt(match[2], 10) : total - 1;
      }

      if (start >= total || end >= total || start > end) {
        return new Response('Range not satisfiable', {
          status: 416,
          headers: { 'Content-Range': `bytes */${total}` }
        });
      }

      const chunkSize = end - start + 1;
      const handle = await fs.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(chunkSize);
        await handle.read(buffer, 0, chunkSize, start);

        return new Response(buffer, {
          status: 206,
          headers: {
            'Content-Type': mimeFor(filePath),
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes'
          }
        });
      } finally {
        await handle.close();
      }
    }

    // No Range header — return the whole file with Accept-Ranges advertised
    // so the client knows it can ask for ranges later.
    const data = await fs.readFile(filePath);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeFor(filePath),
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes'
      }
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});


app.on('before-quit', () => {
  try {
    db.closeSync();
  } catch (err) {
    console.error('Failed to close database:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});