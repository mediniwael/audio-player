import { JSX, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { play, playFromStart } from '../controllers/mediaController';

export default function ContextMenu(): JSX.Element | null {
    const contextMenu = useStore((s) => s.contextMenu);
    const closeContextMenu = useStore((s) => s.closeContextMenu);
    const playlists = useStore((s) => s.playlists);
    const createPlaylist = useStore((s) => s.createPlaylist);
    const addTracksToPlaylist = useStore((s) => s.addTracksToPlaylist);
    const removePlaylistEntry = useStore((s) => s.removePlaylistEntry);
    const libraryTracks = useStore((s) => s.libraryTracks);
    const activePlaylist = useStore((s) => s.activePlaylist);

    const ref = useRef<HTMLDivElement>(null);
    const [showPlaylists, setShowPlaylists] = useState(false);

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

    if (!contextMenu) return null;

    const menuStyle: React.CSSProperties = {
        left: contextMenu.x,
        top: contextMenu.y
    };

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