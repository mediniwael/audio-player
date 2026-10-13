import { JSX } from 'react';
import { setPlaybackRate } from '../controllers/mediaController';
import { useStore } from '../store';


export default function SpeedDropdown(): JSX.Element {
    const speed = useStore((s) => s.playbackSpeed);
    const setSpeed = useStore((s) => s.setPlaybackSpeed);

    function onChange(e: React.ChangeEvent<HTMLSelectElement>): void {
        const value = Number(e.target.value);
        setSpeed(value);
        setPlaybackRate(value);   // applies to the current element
        window.api.settings.set('playbackSpeed', String(value)).catch(() => { });
    }

    return (
        <select value={speed} onChange={onChange} title="Playback speed">
            {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((s) => (
                <option key={s} value={s}>{s}×</option>
            ))}
        </select>
    );
}