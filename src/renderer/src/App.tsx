import { JSX, useEffect, useMemo } from 'react';
import { useStore } from './store';
import { play } from './controllers/mediaController';
import MediaSurface from './components/MediaSurface';
import PlayerBar from './components/PlayerBar';
import PlaylistsSidebar from './components/PlaylistsSidebar';
import PlaylistView from './components/PlaylistView';
import ContextMenu from './components/ContextMenu';
import type { Track } from '../../shared/api';

export default function App(): JSX.Element {
  // ---------- State ----------
  const folders = useStore((s) => s.folders);
  const libraryTracks = useStore((s) => s.libraryTracks);
  const currentTrackId = useStore((s) => s.currentTrack?.id ?? null);
  const libraryCursorTrackId = useStore((s) => s.libraryCursorTrackId);
  const activePlaylist = useStore((s) => s.activePlaylist);
  const isScanning = useStore((s) => s.isScanning);
  const scanFolderPath = useStore((s) => s.scanFolderPath);
  const scanProcessed = useStore((s) => s.scanProcessed);

  // ---------- Actions ----------
  const loadFolders = useStore((s) => s.loadFolders);
  const addFolder = useStore((s) => s.addFolder);
  const removeFolder = useStore((s) => s.removeFolder);
  const loadLibrary = useStore((s) => s.loadLibrary);
  const loadLibraryCursor = useStore((s) => s.loadLibraryCursor);
  const loadPlaylists = useStore((s) => s.loadPlaylists);
  const loadLastView = useStore((s) => s.loadLastView);
  const loadSettings = useStore((s) => s.loadSettings);
  const startScan = useStore((s) => s.startScan);
  const openContextMenu = useStore((s) => s.openContextMenu);

  // ---------- Startup ----------
  useEffect(() => {
    loadFolders();
    loadLibrary();
    loadLibraryCursor();
    loadSettings();
    void loadPlaylists().then(() => loadLastView());
  }, [
    loadFolders,
    loadLibrary,
    loadLibraryCursor,
    loadSettings,
    loadPlaylists,
    loadLastView
  ]);

  // ---------- Derived ----------
  // The track that the Continue banner would resume. Null if there's no
  // cursor, or if the cursor points at a track that no longer exists.
  const continueTrack = useMemo<Track | null>(() => {
    if (libraryCursorTrackId === null) return null;
    return libraryTracks.find((t) => t.id === libraryCursorTrackId) ?? null;
  }, [libraryTracks, libraryCursorTrackId]);

  // ---------- Handlers ----------
  function handlePlay(track: Track): void {
    void play(track, { kind: 'library' });
  }

  function handleContinue(): void {
    if (continueTrack) {
      void play(continueTrack, { kind: 'library' });
    }
  }

  // ---------- Render ----------
  return (
    <div className="app">
      <MediaSurface />

      <header className="app-header">
        <button onClick={addFolder}>Add folder</button>
        <button onClick={startScan} disabled={isScanning}>
          {isScanning ? `Scanning (${scanProcessed})…` : 'Rescan library'}
        </button>
        {isScanning && scanFolderPath && (
          <span className="scan-status" title={scanFolderPath}>
            {scanFolderPath}
          </span>
        )}
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <h2>Folders</h2>
            </div>
            {folders.length === 0 ? (
              <p className="empty-hint small">
                No folders yet. Click "Add folder" to get started.
              </p>
            ) : (
              <ul className="folder-list">
                {folders.map((f) => (
                  <li key={f.id}>
                    <span className="folder-path" title={f.path}>
                      {f.path}
                    </span>
                    <button
                      className="icon-btn small"
                      onClick={() => removeFolder(f.id)}
                      title="Remove folder"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <PlaylistsSidebar />
        </aside>

        <main className="main-pane">
          {activePlaylist ? (
            <PlaylistView />
          ) : (
            <>
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

              <h2>Library ({libraryTracks.length})</h2>

              {libraryTracks.length === 0 ? (
                <p className="empty-hint">
                  No tracks yet. Add a folder and rescan the library.
                </p>
              ) : (
                <ul className="track-list">
                  {libraryTracks.map((t) => (
                    <li
                      key={t.id}
                      className={`track-row ${t.id === currentTrackId ? 'active' : ''
                        }`}
                      onClick={() => handlePlay(t)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openContextMenu({
                          kind: 'library-track',
                          id: t.id,
                          x: e.clientX,
                          y: e.clientY
                        });
                      }}
                    >
                      <div className="track-title">
                        {t.title ?? '(untitled)'}
                      </div>
                      <div className="track-meta">
                        {t.artist ?? ''}
                        {t.artist && t.album ? ' — ' : ''}
                        {t.album ?? ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </main>
      </div>

      <PlayerBar />
      <ContextMenu />
    </div>
  );
}