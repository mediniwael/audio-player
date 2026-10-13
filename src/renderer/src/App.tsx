import { JSX, useEffect } from 'react';
import { useStore } from './store';

export default function App(): JSX.Element {
  const folders = useStore((s) => s.folders);
  const tracks = useStore((s) => s.libraryTracks);
  const isScanning = useStore((s) => s.isScanning);
  const scanFolderPath = useStore((s) => s.scanFolderPath);
  const scanProcessed = useStore((s) => s.scanProcessed);

  const loadFolders = useStore((s) => s.loadFolders);
  const addFolder = useStore((s) => s.addFolder);
  const removeFolder = useStore((s) => s.removeFolder);
  const loadLibrary = useStore((s) => s.loadLibrary);
  const startScan = useStore((s) => s.startScan);

  useEffect(() => {
    loadFolders();
    loadLibrary();
  }, [loadFolders, loadLibrary]);

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Session 3 test</h1>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button onClick={addFolder}>Add folder</button>
        <button onClick={startScan} disabled={isScanning}>
          {isScanning ? 'Scanning…' : 'Rescan library'}
        </button>
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2>Folders ({folders.length})</h2>
        <ul>
          {folders.map((f) => (
            <li key={f.id}>
              {f.path}{' '}
              <button onClick={() => removeFolder(f.id)}>remove</button>
            </li>
          ))}
        </ul>
      </section>

      {isScanning && (
        <section style={{ marginBottom: 24 }}>
          <h2>Scanning</h2>
          <p>
            {scanFolderPath ?? '…'} — {scanProcessed} files processed
          </p>
        </section>
      )}

      <section>
        <h2>Tracks ({tracks.length})</h2>
        <ul>
          {tracks.map((t) => (
            <li key={t.id}>
              {t.title ?? '(untitled)'}
              {t.artist ? ` — ${t.artist}` : ''}
              {t.album ? ` — ${t.album}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}