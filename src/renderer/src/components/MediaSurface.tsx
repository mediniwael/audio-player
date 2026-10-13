import { JSX, useEffect, useRef } from 'react';
import { attachToContainer } from '../controllers/mediaController';
import { useStore } from '../store';

export default function MediaSurface(): JSX.Element {
    const ref = useRef<HTMLDivElement>(null);
    const mediaType = useStore((s) => s.currentTrack?.media_type ?? 'audio');

    useEffect(() => {
        if (ref.current) {
            attachToContainer(ref.current);
        }
        // Intentionally empty cleanup. The media element lives for the app's
        // lifetime and must not be detached on React re-renders.
    }, []);

    return (
        <div
            ref={ref}
            className={`media-surface ${mediaType === 'audio' ? 'audio-only' : 'video'}`}
        />
    );
}