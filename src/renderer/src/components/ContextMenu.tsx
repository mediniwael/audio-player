import { JSX, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { play, playFromStart } from '../controllers/mediaController';

export default function ContextMenu(): JSX.Element | null {
    const contextMenu = useStore((s) => s.contextMenu);
    const closeContextMenu = useStore((s) => s.closeContextMenu);

    const playlists = useStore((s) => s.playlists);
    const folders = useStore((s) => s.folders);
    const libraryTracks = useStore((s) => s.libraryTracks);
    const activePlaylist = useStore((s) => s.activePlaylist);

    const createPlaylist = useStore((s) => s.createPlaylist);
    const createPlaylistFromFolder = useStore(
        (s) => s.createPlaylistFromFolder
    );
    const addTracksToPlaylist = useStore((s) => s.addTracksToPlaylist);
    const removePlaylistEntry = useStore((s) => s.removePlaylistEntry);
    const loadActivePlaylist = useStore((s) => s.loadActivePlaylist);

    const ref = useRef<HTMLDivElement>(null);
    const [showPlaylists, setShowPlaylists] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{
        left: number;
        top: number;
    } | null>(null);

    useEffect(() => {
        if (!contextMenu) {
            setShowPlaylists(false);
            return;
        }
        function onDown(e: MouseEvent): void {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                closeContextMenu();
            }
        }
        function onKey(e: KeyboardEvent): void {
            if (e.key === 'Escape') closeContextMenu();
        }
        window.addEventListener('mousedown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [contextMenu, closeContextMenu]);

    useLayoutEffect(() => {
        if (!contextMenu) {
            setMenuPosition(null);
            return;
        }
        const target = contextMenu;

        function updatePosition(): void {
            const menu = ref.current;
            if (!menu) return;

            const { width, height } = menu.getBoundingClientRect();
            const margin = 8;
            const left = Math.max(
                margin,
                Math.min(target.x, window.innerWidth - width - margin)
            );
            const top = Math.max(
                margin,
                Math.min(target.y, window.innerHeight - height - margin)
            );

            setMenuPosition((current) =>
                current?.left === left && current.top === top
                    ? current
                    : { left, top }
            );
        }

        updatePosition();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, [contextMenu, playlists, showPlaylists]);

    if (!contextMenu) return null;

    const menuStyle: React.CSSProperties = {
        left: menuPosition?.left ?? contextMenu.x,
        top: menuPosition?.top ?? contextMenu.y
    };

    // ---------- Folder menu ----------
    if (contextMenu.kind === 'folder') {
        const folder = folders.find((f) => f.id === contextMenu.id);
        if (!folder) return null;

        // Default playlist name: the last path segment.
        const segments = folder.path.split(/[/\\]/).filter(Boolean);
        const defaultName = segments[segments.length - 1] ?? 'Playlist';

        async function handleCreate(): Promise<void> {
            try {
                const playlist = await createPlaylistFromFolder(
                    folder!.id,
                    defaultName
                );
                await loadActivePlaylist(playlist.id);
                void window.api.settings.set(
                    'library.last_view',
                    `playlist:${playlist.id}`
                );
            } catch (err) {
                console.error('[context] create playlist from folder failed:', err);
            }
            closeContextMenu();
        }

        return (
            <div className="context-menu" style={menuStyle} ref={ref}>
                <button className="context-item" onClick={() => void handleCreate()}>
                    Create playlist from folder
                </button>
            </div>
        );
    }

    // ---------- Library track menu ----------
    if (contextMenu.kind === 'library-track') {
        const track = libraryTracks.find((t) => t.id === contextMenu.id);
        if (!track) return null;

        async function handleAdd(playlistId: number): Promise<void> {
            await addTracksToPlaylist(playlistId, [track!.id]);
            closeContextMenu();
        }

        async function handleNewPlaylist(): Promise<void> {
            const name = prompt('Playlist name');
            if (!name || !name.trim()) return;
            const p = await createPlaylist(name.trim());
            await addTracksToPlaylist(p.id, [track!.id]);
            closeContextMenu();
        }

        return (
            <div className="context-menu" style={menuStyle} ref={ref}>
                <button
                    className="context-item"
                    onClick={() => {
                        void play(track, { kind: 'library' });
                        closeContextMenu();
                    }}
                >
                    Play
                </button>
                <button
                    className="context-item"
                    onClick={() => {
                        void playFromStart(track, { kind: 'library' });
                        closeContextMenu();
                    }}
                >
                    Play from start
                </button>
                <div className="context-divider" />
                <button
                    className="context-item"
                    onMouseEnter={() => setShowPlaylists(true)}
                >
                    Add to playlist ▸
                </button>
                {showPlaylists && (
                    <div className="context-submenu">
                        <button
                            className="context-item"
                            onClick={() => void handleNewPlaylist()}
                        >
                            + New playlist…
                        </button>
                        {playlists.length > 0 && <div className="context-divider" />}
                        {playlists.map((p) => (
                            <button
                                key={p.id}
                                className="context-item"
                                onClick={() => void handleAdd(p.id)}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ---------- Playlist entry menu ----------
    if (contextMenu.kind === 'playlist-entry') {
        const entryId = contextMenu.id;
        const entry = activePlaylist?.entries.find((e) => e.id === entryId);
        if (!entry) return null;

        return (
            <div className="context-menu" style={menuStyle} ref={ref}>
                <button
                    className="context-item"
                    onClick={() => {
                        void play(entry.track, {
                            kind: 'playlist',
                            playlistId: entry.playlist_id,
                            entryId: entry.id
                        });
                        closeContextMenu();
                    }}
                >
                    Play
                </button>
                <button
                    className="context-item"
                    onClick={() => {
                        void playFromStart(entry.track, {
                            kind: 'playlist',
                            playlistId: entry.playlist_id,
                            entryId: entry.id
                        });
                        closeContextMenu();
                    }}
                >
                    Play from start
                </button>
                <div className="context-divider" />
                <button
                    className="context-item danger"
                    onClick={() => {
                        void removePlaylistEntry(entryId);
                        closeContextMenu();
                    }}
                >
                    Remove from playlist
                </button>
            </div>
        );
    }

    return null;
}