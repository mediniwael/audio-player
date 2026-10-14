import { useStore } from '../store';
import {
    enterFullscreen,
    togglePictureInPicture
} from '../controllers/mediaController';
import SeekBar from './SeekBar';
import TransportControls from './TransportControls';
import VoiceBoostToggle from './VoiceBoostToggle';
import SpeedDropdown from './SpeedDropdown';
import { JSX } from 'react/jsx-runtime';

export default function PlayerBar(): JSX.Element {
    const track = useStore((s) => s.currentTrack);
    const isVideo = track?.media_type === 'video';

    return (
        <div className="player-bar">
            <div className="player-now-playing">
                {track ? (
                    <>
                        <div className="player-title">{track.title ?? '(untitled)'}</div>
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
                {isVideo && (
                    <>
                        <button
                            className="icon-btn"
                            onClick={() => void togglePictureInPicture()}
                            title="Picture in picture"
                        >
                            ⧉
                        </button>
                        <button
                            className="icon-btn"
                            onClick={() => {
                                void enterFullscreen();
                            }}
                            title="Fullscreen"
                        >
                            ⛶
                        </button>
                    </>
                )}
                <VoiceBoostToggle />
            </div>
        </div>
    );
}