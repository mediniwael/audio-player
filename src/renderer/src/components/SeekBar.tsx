import { JSX, useEffect, useRef } from 'react';
import { getElement, seekTo } from '../controllers/mediaController';
import { useStore } from '../store';

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SeekBar(): JSX.Element {
    const duration = useStore((s) => s.duration);

    const fillRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLSpanElement>(null);
    const lastSecondRef = useRef(-1);

    useEffect(() => {
        let raf = 0;
        const tick = (): void => {
            const el = getElement();
            if (el) {
                const pct = duration > 0 ? (el.currentTime / duration) * 100 : 0;
                if (fillRef.current) fillRef.current.style.width = `${pct}%`;

                const secs = Math.floor(el.currentTime);
                if (secs !== lastSecondRef.current && currentRef.current) {
                    lastSecondRef.current = secs;
                    currentRef.current.textContent = formatTime(el.currentTime);
                }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [duration]);

    function handleClick(e: React.MouseEvent<HTMLDivElement>): void {
        const el = getElement();
        if (!el || duration <= 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        seekTo(pct * duration);
    }

    return (
        <div className="seek-bar">
            <span className="seek-time" ref={currentRef}>0:00</span>
            <div className="seek-track" onClick={handleClick}>
                <div className="seek-fill" ref={fillRef} />
            </div>
            <span className="seek-time">{formatTime(duration)}</span>
        </div>
    );
}