import { JSX, useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

export default function PlaylistsSidebar(): JSX.Element {
    // ---------- Store ----------
    const playlists = useStore((s) => s.playlists);
    const activePlaylist = useStore((s) => s.activePlaylist);
    const createPlaylist = useStore((s) => s.createPlaylist);
    const renamePlaylist = useStore((s) => s.renamePlaylist);
    const deletePlaylist = useStore((s) => s.deletePlaylist);
    const loadActivePlaylist = useStore((s) => s.loadActivePlaylist);
    const clearActivePlaylist = useStore((s) => s.clearActivePlaylist);

    // ---------- Local UI state ----------
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');

    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');

    const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(
        null
    );

    const createInputRef = useRef<HTMLInputElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Focus the create input when it appears. autoFocus is unreliable after
    // native dialogs close, so we do it explicitly.
    useEffect(() => {
        if (creating && createInputRef.current) {
            createInputRef.current.focus();
        }
    }, [creating]);

    // Same for the rename input.
    useEffect(() => {
        if (renamingId !== null && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);

    // Clear the pending delete confirmation if the user clicks elsewhere.
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

    // ---------- Create ----------
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

    // ---------- Rename ----------
    function startRename(id: number, current: string): void {
        setConfirmingDeleteId(null);
        setRenamingId(id);
        setRenameValue(current);
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

    // ---------- Delete ----------
    function requestDelete(id: number): void {
        setConfirmingDeleteId(id);
    }

    async function confirmDelete(id: number): Promise<void> {
        setConfirmingDeleteId(null);
        await deletePlaylist(id);
    }

    function cancelDelete(): void {
        setConfirmingDeleteId(null);
    }

    // ---------- Navigation ----------
    async function openPlaylist(id: number): Promise<void> {
        await loadActivePlaylist(id);
        void window.api.settings.set('library.last_view', `playlist:${id}`);
    }

    function goToLibrary(): void {
        clearActivePlaylist();
        void window.api.settings.set('library.last_view', 'library');
    }

    // ---------- Render ----------
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
                        // Commit if there's content; otherwise leave open.
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

                                        {isConfirmingDelete ? (
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
                                        ) : (
                                            <>
                                                <button
                                                    className="icon-btn small"
                                                    onClick={() => startRename(p.id, p.name)}
                                                    title="Rename"
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    className="icon-btn small"
                                                    onClick={() => requestDelete(p.id)}
                                                    title="Delete"
                                                >
                                                    ×
                                                </button>
                                            </>
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