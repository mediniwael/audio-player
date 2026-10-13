import { JSX, useEffect, useMemo } from 'react';
import { useStore } from './store';
import { play } from './controllers/mediaController';
import MediaSurface from './components/MediaSurface';
import PlayerBar from './components/PlayerBar';
import type { Track } from '../../shared/api';

export default function App(): JSX.Element {
  const folders = useStore((s) => s.folders);
  const tracks = useStore((s) => s.libraryTracks);
  const currentTrackId = useStore((s) => s.currentTrack?.id ?? null);
  const libraryCursorTrackId = useStore((s) => s.libraryCursorTrackId);
  const isScanning = useStore((s) => s.isScanning);
  const scanFolderPath = useStore((s) => s.scanFolderPath);
  const scanProcessed = useStore((s) => s.scanProcessed);

  const loadFolders = useStore((s) => s.loadFolders);
  const addFolder = useStore((s) => s.addFolder);
  const removeFolder = useStore((s) => s.removeFolder);
  const loadLibrary = useStore((s) => s.loadLibrary);
  const loadLibraryCursor = useStore((s) => s.loadLibraryCursor);
  const startScan = useStore((s) => s.startScan);
  const loadSettings = useStore((s) => s.loadSettings);

  useEffect(() => {
    loadFolders();
    loadLibrary();
    loadLibraryCursor();
    loadSettings();
  }, [loadFolders, loadLibrary, loadLibraryCursor, loadSettings]);

  // The track the Continue button would resume, if any.
  const continueTrack = useMemo<Track | null>(() => {
    if (libraryCursorTrackId === null) return null;
    return tracks.find((t) => t.id === libraryCursorTrackId) ?? null;
  }, [tracks, libraryCursorTrackId]);

  function handlePlay(track: Track): void {
    void play(track, { kind: 'library' });
  }

  function handleContinue(): void {
    if (continueTrack) {
      void play(continueTrack, { kind: 'library' });
    }
  }

  return (
    <div className="app">
      <MediaSurface />

      <header className="app-header">
        <button onClick={addFolder}>Add folder</button>
        <button onClick={startScan} disabled={isScanning}>
          {isScanning ? `Scanning (${scanProcessed})…` : 'Rescan library'}
        </button>
        {isScanning && scanFolderPath && (
          <span className="scan-status">{scanFolderPath}</span>
        )}
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <h2>Folders</h2>
          <ul className="folder-list">
            {folders.map((f) => (
              <li key={f.id}>
                <span className="folder-path" title={f.path}>{f.path}</span>
                <button
                  className="folder-remove"
                  onClick={() => removeFolder(f.id)}
                  title="Remove folder"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-pane">
          {continueTrack && (
            <div className="continue-banner">
              <div className="continue-info">
                <span className="continue-label">Continue listening</span>
                <span className="continue-title">
                  {continueTrack.title ?? '(untitled)'}
                </span>
              </div>
              <button className="continue-btn" onClick={handleContinue}>
                ▶ Resume
              </button>
            </div>
          )}

          <h2>Library ({tracks.length})</h2>
          <ul className="track-list">
            {tracks.map((t) => (
              <li
                key={t.id}
                className={`track-row ${t.id === currentTrackId ? 'active' : ''}`}
                onClick={() => handlePlay(t)}
              >
                <div className="track-title">{t.title ?? '(untitled)'}</div>
                <div className="track-meta">
                  {t.artist ?? ''}
                  {t.artist && t.album ? ' — ' : ''}
                  {t.album ?? ''}
                </div>
              </li>
            ))}
          </ul>
        </main>
      </div>

      <PlayerBar />
    </div>
  );
}