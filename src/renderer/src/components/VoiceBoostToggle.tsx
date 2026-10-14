import { JSX, useEffect } from 'react';
import { setVoiceBoost as applyToGraph } from '../controllers/audioGraph';
import { useStore } from '../store';

export default function VoiceBoostToggle(): JSX.Element {
    const enabled = useStore((s) => s.voiceBoost);
    const setVoiceBoost = useStore((s) => s.setVoiceBoost);
    const isVideo = useStore((s) => s.currentTrack?.media_type === 'video');

    useEffect(() => {
        // Only apply the preference to the graph when it's effective.
        if (!isVideo) {
            applyToGraph(enabled);
        }
    }, [enabled, isVideo]);

    function toggle(): void {
        if (isVideo) return;
        const next = !enabled;
        setVoiceBoost(next);
        applyToGraph(next);
        void window.api.settings.set('voiceBoost', String(next));
    }

    return (
        <button
            className={`voice-boost-btn ${enabled && !isVideo ? 'active' : ''}`}
            onClick={toggle}
            disabled={isVideo}
            title={
                isVideo
                    ? 'Voice Boost is unavailable for video'
                    : 'Boost voice clarity for speech'
            }
        >
            VB
        </button>
    );
}