import { JSX } from 'react/jsx-runtime';
import { togglePlayPause } from '../controllers/mediaController';
import { useStore } from '../store';

export default function TransportControls(): JSX.Element {
    const isPlaying = useStore((s) => s.isPlaying);
    const hasTrack = useStore((s) => s.currentTrack !== null);

    return (
        <div className="transport">
            <button
                className="transport-btn"
                onClick={togglePlayPause}
                disabled={!hasTrack}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
                {isPlaying ? '⏸' : '▶'}
            </button>
        </div>
    );
}