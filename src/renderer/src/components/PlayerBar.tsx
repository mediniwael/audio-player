import { useStore } from '../store';
import SeekBar from './SeekBar';
import TransportControls from './TransportControls';
import VoiceBoostToggle from './VoiceBoostToggle';
import SpeedDropdown from './SpeedDropdown';
import { JSX } from 'react/jsx-runtime';

export default function PlayerBar(): JSX.Element {
    const track = useStore((s) => s.currentTrack);
    const playbackError = useStore((s) => s.playbackError);

    return (
        <div className="player-bar">
            <div className="player-now-playing">
                {track ? (
                    <>
                        <div className="player-title">
                            {track ? (track.title ?? '(untitled)') : 'No track'}
                        </div>
                        {playbackError && (
                            <div className="player-error">{playbackError}</div>
                        )}
                        <div className="player-subtitle">
                            {track.artist ?? ''}
                            {track.artist && track.album ? ' — ' : ''}
                            {track.album ?? ''}
                        </div>
                    </>
                ) : (
                    <div className="player-title player-title-empty">No track</div>
                )}
            </div>

            <TransportControls />
            <SeekBar />

            <div className="player-right">
                <SpeedDropdown />
                <VoiceBoostToggle />
            </div>
        </div>
    );
}