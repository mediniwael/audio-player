import { JSX, useState } from 'react';
import { useStore } from '../store';
import { play } from '../controllers/mediaController';
import PlaylistEntryRow from './PlaylistEntryRow';
import type { PlaylistEntry } from '../../../shared/api';

export default function PlaylistView(): JSX.Element {
    const activePlaylist = useStore((s) => s.activePlaylist);
    const renamePlaylist = useStore((s) => s.renamePlaylist);
    const reorderPlaylist = useStore((s) => s.reorderPlaylist);

    const [dragId, setDragId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');

    if (!activePlaylist) return <div className="main-pane" />;

    const { playlist, entries } = activePlaylist;
    const cursorEntryId = playlist.current_entry_id;

    function handleResume(): void {
        if (cursorEntryId === null) return;
        const entry = entries.find((e) => e.id === cursorEntryId);
        if (!entry) return;
        void play(entry.track, {
            kind: 'playlist',
            playlistId: playlist.id,
            entryId: entry.id
        });
    }

    function handleEntryClick(entry: PlaylistEntry): void {
        void play(entry.track, {
            kind: 'playlist',
            playlistId: playlist.id,
            entryId: entry.id
        });
    }

    async function submitName(): Promise<void> {
        const name = nameDraft.trim();
        if (name && name !== playlist.name) {
            await renamePlaylist(playlist.id, name);
        }
        setEditingName(false);
    }

    function handleDragStart(entryId: number): void {
        setDragId(entryId);
    }

    function handleDragOver(entryId: number): void {
        if (dragOverId !== entryId) setDragOverId(entryId);
    }

    function handleDrop(targetId: number): void {
        if (dragId === null || dragId === targetId) {
            setDragId(null);
            setDragOverId(null);
            return;
        }
        const fromIdx = entries.findIndex((e) => e.id === dragId);
        const toIdx = entries.findIndex((e) => e.id === targetId);
        if (fromIdx === -1 || toIdx === -1) {
            setDragId(null);
            setDragOverId(null);
            return;
        }

        const reordered = [...entries];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);

        void reorderPlaylist(
            playlist.id,
            reordered.map((e) => e.id)
        );

        setDragId(null);
        setDragOverId(null);
    }

    return (
        <div className="main-pane">
            <div className="playlist-header">
                {editingName ? (
                    <input
                        autoFocus
                        className="playlist-title-input"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={submitName}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void submitName();
                            if (e.key === 'Escape') setEditingName(false);
                        }}
                    />
                ) : (
                    <h2
                        className="playlist-title"
                        onDoubleClick={() => {
                            setNameDraft(playlist.name);
                            setEditingName(true);
                        }}
                        title="Double-click to rename"
                    >
                        {playlist.name}
                    </h2>
                )}
                <span className="playlist-total">{entries.length} tracks</span>

                {cursorEntryId !== null && (
                    <button className="continue-btn" onClick={handleResume}>
                        ▶ Resume
                    </button>
                )}
            </div>

            {entries.length === 0 ? (
                <p className="empty-hint">
                    No tracks yet. Right-click a track in the library to add it here.
                </p>
            ) : (
                <ul className="track-list">
                    {entries.map((entry) => (
                        <PlaylistEntryRow
                            key={entry.id}
                            entry={entry}
                            isCurrent={entry.id === cursorEntryId}
                            isDragging={entry.id === dragId}
                            isDragOver={entry.id === dragOverId && entry.id !== dragId}
                            onClick={() => handleEntryClick(entry)}
                            onDragStart={() => handleDragStart(entry.id)}
                            onDragOver={() => handleDragOver(entry.id)}
                            onDrop={() => handleDrop(entry.id)}
                            onDragEnd={() => {
                                setDragId(null);
                                setDragOverId(null);
                            }}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}