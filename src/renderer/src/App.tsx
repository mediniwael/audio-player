import { JSX, useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { play } from './controllers/mediaController';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { basename, formatDuration } from './utils/format';
import MediaSurface from './components/MediaSurface';
import PlayerBar from './components/PlayerBar';
import PlaylistsSidebar from './components/PlaylistsSidebar';
import PlaylistView from './components/PlaylistView';
import ContextMenu from './components/ContextMenu';
import type { Track } from '../../shared/api';

export default function App(): JSX.Element {
  useKeyboardShortcuts();

  const [foldersExpanded, setFoldersExpanded] = useState(false);

  // ---------- State ----------
  const folders = useStore((s) => s.folders);
  const libraryTracks = useStore((s) => s.libraryTracks);
  const libraryLoading = useStore((s) => s.libraryLoading);
  const libraryLoaded = useStore((s) => s.libraryLoaded);
  const libraryError = useStore((s) => s.libraryError);
  const libraryFolderFilter = useStore((s) => s.libraryFolderFilter);
  const libraryMediaFilter = useStore((s) => s.libraryMediaFilter);
  const libraryCursorTrackId = useStore((s) => s.libraryCursorTrackId);
  const currentTrackId = useStore((s) => s.currentTrack?.id ?? null);
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
  const setLibraryFolderFilter = useStore((s) => s.setLibraryFolderFilter);
  const setLibraryMediaFilter = useStore((s) => s.setLibraryMediaFilter);

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

  // The track the Continue banner would resume.
  const continueTrack = useMemo<Track | null>(() => {
    if (libraryCursorTrackId === null) return null;
    return libraryTracks.find((t) => t.id === libraryCursorTrackId) ?? null;
  }, [libraryTracks, libraryCursorTrackId]);

  // The library, filtered by folder and media type.
  const filteredTracks = useMemo<Track[]>(() => {
    let result = libraryTracks;

    if (libraryFolderFilter !== null) {
      result = result.filter((t) => t.folder_id === libraryFolderFilter);
    }

    if (libraryMediaFilter !== 'all') {
      result = result.filter((t) => t.media_type === libraryMediaFilter);
    }

    return result;
  }, [libraryTracks, libraryFolderFilter, libraryMediaFilter]);

  // The folder object for the active folder filter, if any.
  const filteredFolder = useMemo(() => {
    if (libraryFolderFilter === null) return null;
    return folders.find((f) => f.id === libraryFolderFilter) ?? null;
  }, [folders, libraryFolderFilter]);

  // Short display name for the filtered folder.
  const filteredFolderName = useMemo(() => {
    if (!filteredFolder) return '';
    const segments = filteredFolder.path.split(/[/\\]/).filter(Boolean);
    return segments[segments.length - 1] ?? filteredFolder.path;
  }, [filteredFolder]);

  // Whether any filter is active — used to decide if the "Clear filter"
  // link should appear.
  const hasActiveFilter =
    libraryFolderFilter !== null || libraryMediaFilter !== 'all';

  // ---------- Handlers ----------
  function handlePlay(track: Track): void {
    void play(track, { kind: 'library' });
  }

  function handleContinue(): void {
    if (continueTrack) {
      void play(continueTrack, { kind: 'library' });
    }
  }

  function toggleFolderFilter(folderId: number): void {
    setLibraryFolderFilter(
      libraryFolderFilter === folderId ? null : folderId
    );
  }

  function clearAllFilters(): void {
    setLibraryFolderFilter(null);
    setLibraryMediaFilter('all');
  }

  // ---------- Render ----------
  return (
    <div className="app">
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
            <button
              type="button"
              className="sidebar-section-header collapsible"
              onClick={() => setFoldersExpanded((v) => !v)}
              aria-expanded={foldersExpanded}
            >
              <span className="collapse-chevron" aria-hidden="true">
                {foldersExpanded ? '▾' : '▸'}
              </span>
              <span className="section-title">Folders</span>
              <span className="section-count">{folders.length}</span>
              {libraryFolderFilter !== null && (
                <span
                  className="filter-indicator"
                  title="Folder filter active"
                  aria-label="Folder filter active"
                />
              )}
            </button>

            {foldersExpanded && (
              <>
                {folders.length === 0 ? (
                  <p className="empty-hint small">
                    No folders yet. Click "Add folder" to get started.
                  </p>
                ) : (
                  <ul className="folder-list">
                    {folders.map((f) => {
                      const isActiveFilter = libraryFolderFilter === f.id;
                      return (
                        <li
                          key={f.id}
                          className={`folder-item ${isActiveFilter ? 'active' : ''
                            }`}
                          onClick={() => toggleFolderFilter(f.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            openContextMenu({
                              kind: 'folder',
                              id: f.id,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          title={
                            isActiveFilter
                              ? 'Click to show all tracks'
                              : 'Click to filter library by this folder'
                          }
                        >
                          <span className="folder-path" title={f.path}>
                            {f.path}
                          </span>
                          <button
                            className="icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFolder(f.id);
                            }}
                            title="Remove folder"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>

          <PlaylistsSidebar />
        </aside>

        <main className="main-pane">
          <MediaSurface />

          {activePlaylist ? (
            <PlaylistView />
          ) : (
            <>
              {continueTrack && (
                <div className="continue-banner">
                  <div className="continue-info">
                    <span className="continue-label">
                      Continue listening
                    </span>
                    <span className="continue-title">
                      {basename(continueTrack.path)}
                    </span>
                  </div>
                  <button className="continue-btn" onClick={handleContinue}>
                    ▶ Resume
                  </button>
                </div>
              )}

              <div className="library-header">
                <h2>
                  {filteredFolder ? (
                    <>
                      Library —{' '}
                      <span className="filtered-folder-name">
                        {filteredFolderName}
                      </span>{' '}
                      ({filteredTracks.length} of {libraryTracks.length})
                    </>
                  ) : (
                    <>Library ({filteredTracks.length})</>
                  )}
                </h2>

                <div className="media-filter">
                  {(['all', 'audio', 'video'] as const).map((f) => (
                    <button
                      key={f}
                      className={libraryMediaFilter === f ? 'active' : ''}
                      onClick={() => setLibraryMediaFilter(f)}
                    >
                      {f === 'all' ? 'All' : f === 'audio' ? 'Audio' : 'Video'}
                    </button>
                  ))}
                </div>

                {hasActiveFilter && (
                  <button className="link-btn" onClick={clearAllFilters}>
                    Clear filters
                  </button>
                )}
              </div>

              {libraryError ? (
                <p className="error-hint">
                  Failed to load library: {libraryError}
                  <button className="link-btn" onClick={loadLibrary}>
                    Retry
                  </button>
                </p>
              ) : libraryLoading && !libraryLoaded ? (
                <p className="empty-hint">Loading library…</p>
              ) : libraryTracks.length === 0 ? (
                <p className="empty-hint">
                  No tracks yet. Add a folder and rescan the library.
                </p>
              ) : filteredTracks.length === 0 ? (
                <p className="empty-hint">
                  No tracks match the current filters.
                </p>
              ) : (
                <ul className="track-list">
                  {filteredTracks.map((t) => (
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
                      <div className="track-main">
                        <div className="track-title">
                          {t.media_type === 'video' && (
                            <span className="video-badge">▶</span>
                          )}
                          {basename(t.path)}
                        </div>
                        <div className="track-meta">
                          {t.artist ?? ''}
                          {t.artist && t.album ? ' — ' : ''}
                          {t.album ?? ''}
                        </div>
                      </div>
                      <div className="track-duration">
                        {formatDuration(t.duration)}
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