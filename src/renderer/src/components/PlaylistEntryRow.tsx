import { useStore } from '../store';
import type { PlaylistEntry } from '../../../shared/api';
import { JSX } from 'react/jsx-runtime';
import { basename, formatDuration } from '../utils/format';

interface Props {
    entry: PlaylistEntry;
    isCurrent: boolean;
    isDragging: boolean;
    isDragOver: boolean;
    onClick: () => void;
    onDragStart: () => void;
    onDragOver: () => void;
    onDrop: () => void;
    onDragEnd: () => void;
}

export default function PlaylistEntryRow({
    entry,
    isCurrent,
    isDragging,
    isDragOver,
    onClick,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd
}: Props): JSX.Element {
    const currentTrackId = useStore((s) => s.currentTrack?.id ?? null);
    const isPlaying = useStore((s) => s.isPlaying);
    const openContextMenu = useStore((s) => s.openContextMenu);

    const classNames = ['track-row', 'playlist-entry-row'];
    if (entry.track.id === currentTrackId) classNames.push('active');
    if (isCurrent) classNames.push('current-entry');
    if (isDragging) classNames.push('dragging');
    if (isDragOver) classNames.push('drag-over');

    function handleContextMenu(e: React.MouseEvent): void {
        e.preventDefault();
        openContextMenu({
            kind: 'playlist-entry',
            id: entry.id,
            x: e.clientX,
            y: e.clientY
        });
    }

    return (
        <li
            className={classNames.join(' ')}
            draggable
            onDragStart={onDragStart}
            onDragOver={(e) => {
                e.preventDefault();
                onDragOver();
            }}
            onDrop={(e) => {
                e.preventDefault();
                onDrop();
            }}
            onDragEnd={onDragEnd}
            onClick={onClick}
            onContextMenu={handleContextMenu}
        >
            <span className="drag-handle" title="Drag to reorder">⋮⋮</span>
            <div className="track-main">
                <div className="track-title">
                    {basename(entry.track.path)}
                    {isCurrent && isPlaying && <span className="playing-dot">●</span>}
                </div>
                <div className="track-meta">
                    {entry.track.artist ?? ''}
                    {entry.track.artist && entry.track.album ? ' — ' : ''}
                    {entry.track.album ?? ''}
                </div>
            </div>
            <div className="track-duration">
                {formatDuration(entry.track.duration)}
            </div>
        </li>
    );
}