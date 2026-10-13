import { JSX, useEffect } from 'react';
import { setVoiceBoost as applyToGraph } from '../controllers/audioGraph';
import { useStore } from '../store';

export default function VoiceBoostToggle(): JSX.Element {
    const enabled = useStore((s) => s.voiceBoost);
    const setVoiceBoost = useStore((s) => s.setVoiceBoost);

    // Apply the persisted state on first render.
    useEffect(() => {
        applyToGraph(enabled);
    }, [enabled]);

    function toggle(): void {
        const next = !enabled;
        setVoiceBoost(next);
        applyToGraph(next);
        window.api.settings.set('voiceBoost', String(next)).catch(() => { });
    }

    return (
        <button
            className={`voice-boost-btn ${enabled ? 'active' : ''}`}
            onClick={toggle}
            title="Boost voice clarity for speech"
        >
            VB
        </button>
    );
}