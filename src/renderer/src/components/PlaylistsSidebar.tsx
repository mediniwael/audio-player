import { JSX, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

export default function PlaylistsSidebar(): JSX.Element {
    const playlists = useStore((s) => s.playlists);
    const activePlaylist = useStore((s) => s.activePlaylist);
    const createPlaylist = useStore((s) => s.createPlaylist);
    const renamePlaylist = useStore((s) => s.renamePlaylist);
    const deletePlaylist = useStore((s) => s.deletePlaylist);
    const loadActivePlaylist = useStore((s) => s.loadActivePlaylist);
    const clearActivePlaylist = useStore((s) => s.clearActivePlaylist);

    const openContextMenu = useStore((s) => s.openContextMenu);
    const playlistActionRequest = useStore((s) => s.playlistActionRequest);
    const clearPlaylistActionRequest = useStore(
        (s) => s.clearPlaylistActionRequest
    );

    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');

    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
        null
    );

    const createInputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (creating && createInputRef.current) {
            createInputRef.current.focus();
        }
    }, [creating]);

    useEffect(() => {
        if (renamingId !== null && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    // React to context-menu actions (rename / delete).
    useEffect(() => {
        if (!playlistActionRequest) return;
        const req = playlistActionRequest;
        clearPlaylistActionRequest();

        if (req.kind === 'rename') {
            const playlist = playlists.find((p) => p.id === req.id);
            if (playlist) {
                setConfirmingDeleteId(null);
                setRenamingId(req.id);
                setRenameValue(playlist.name);
            }
        } else if (req.kind === 'delete') {
            setRenamingId(null);
            setConfirmingDeleteId(req.id);
        }
    }, [playlistActionRequest, playlists, clearPlaylistActionRequest]);

    // Dismiss pending delete if the user clicks elsewhere.
    useEffect(() => {
        if (confirmingDeleteId === null) return;
        function onDown(e: MouseEvent): void {
            const target = e.target as HTMLElement;
            if (!target.closest('.playlist-delete-confirm')) {
                setConfirmingDeleteId(null);
            }
        }
        window.addEventListener('mousedown', onDown);
        return () => window.removeEventListener('mousedown', onDown);
    }, [confirmingDeleteId]);

    async function submitCreate(): Promise<void> {
        const name = newName.trim();
        if (!name) {
            setCreating(false);
            setNewName('');
            return;
        }
        const playlist = await createPlaylist(name);
        setNewName('');
        setCreating(false);
        await loadActivePlaylist(playlist.id);
    }

    function cancelCreate(): void {
        setCreating(false);
        setNewName('');
    }

    async function submitRename(): Promise<void> {
        if (renamingId === null) return;
        const name = renameValue.trim();
        if (name) {
            await renamePlaylist(renamingId, name);
        }
        setRenamingId(null);
        setRenameValue('');
    }

    function cancelRename(): void {
        setRenamingId(null);
        setRenameValue('');
    }

    async function confirmDelete(id: number): Promise<void> {
        setConfirmingDeleteId(null);
        await deletePlaylist(id);
    }

    function cancelDelete(): void {
        setConfirmingDeleteId(null);
    }

    async function openPlaylist(id: number): Promise<void> {
        await loadActivePlaylist(id);
        void window.api.settings.set('library.last_view', `playlist:${id}`);
    }

    function goToLibrary(): void {
        clearActivePlaylist();
        void window.api.settings.set('library.last_view', 'library');
    }

    function handlePlaylistContextMenu(
        e: React.MouseEvent,
        id: number
    ): void {
        e.preventDefault();
        openContextMenu({
            kind: 'playlist',
            id,
            x: e.clientX,
            y: e.clientY
        });
    }

    return (
        <div className="playlists-sidebar sidebar-section">
            <div className="sidebar-section-header">
                <h2>Playlists</h2>
                {!creating && (
                    <button
                        className="icon-btn"
                        onClick={() => setCreating(true)}
                        title="New playlist"
                    >
                        +
                    </button>
                )}
            </div>

            {creating && (
                <input
                    ref={createInputRef}
                    className="rename-input"
                    value={newName}
                    placeholder="Playlist name"
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => {
                        if (newName.trim()) void submitCreate();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void submitCreate();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelCreate();
                        }
                    }}
                />
            )}

            {playlists.length === 0 && !creating ? (
                <p className="empty-hint small">No playlists yet.</p>
            ) : (
                <ul className="playlist-list">
                    {playlists.map((p) => {
                        const isActive = activePlaylist?.playlist.id === p.id;
                        const isRenaming = renamingId === p.id;
                        const isConfirmingDelete = confirmingDeleteId === p.id;

                        return (
                            <li
                                key={p.id}
                                className={`playlist-item ${isActive ? 'active' : ''}`}
                                onContextMenu={(e) => handlePlaylistContextMenu(e, p.id)}
                            >
                                {isRenaming ? (
                                    <input
                                        ref={renameInputRef}
                                        className="rename-input"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={submitRename}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                void submitRename();
                                            } else if (e.key === 'Escape') {
                                                e.preventDefault();
                                                cancelRename();
                                            }
                                        }}
                                    />
                                ) : (
                                    <>
                                        <span
                                            className="playlist-name"
                                            onClick={() => void openPlaylist(p.id)}
                                            title={p.name}
                                        >
                                            {p.name}
                                        </span>
                                        <span className="playlist-count">{p.trackCount}</span>

                                        {isConfirmingDelete && (
                                            <span className="playlist-delete-confirm">
                                                <button
                                                    className="icon-btn small danger"
                                                    onClick={() => void confirmDelete(p.id)}
                                                    title="Confirm delete"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    className="icon-btn small"
                                                    onClick={cancelDelete}
                                                    title="Cancel"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        )}
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {activePlaylist && (
                <button className="link-btn" onClick={goToLibrary}>
                    ← Back to library
                </button>
            )}
        </div>
    );
}