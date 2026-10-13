import { useEffect } from 'react';
import { togglePlayPause, seekBy, play } from '../controllers/mediaController';
import { useStore } from '../store';

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // Ignore keypresses that originate in text inputs.
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Ignore when modifier keys are held (so Ctrl+Space etc. still work
      // for the OS or other apps).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case ' ':
            e.preventDefault();
            {
                const store = useStore.getState();
                if (store.currentTrack) {
                togglePlayPause();
                } else if (store.libraryCursorTrackId !== null) {
                const track = store.libraryTracks.find(
                    (t) => t.id === store.libraryCursorTrackId
                );
                if (track) {
                    void play(track, { kind: 'library' });
                }
                }
            }
            break;

        case 'ArrowLeft':
          e.preventDefault();
          seekBy(-10);
          break;

        case 'ArrowRight':
          e.preventDefault();
          seekBy(10);
          break;

        case 'ArrowUp':
          e.preventDefault();
          seekBy(10);
          break;

        case 'ArrowDown':
          e.preventDefault();
          seekBy(-10);
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}