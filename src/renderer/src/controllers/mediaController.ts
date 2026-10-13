import { useStore } from '../store';
import { ensureGraph, resumeContextIfNeeded } from './audioGraph';
import type { PlayContext, Track } from '../../../shared/api';

let el: HTMLVideoElement | null = null;

export function getOrCreateElement(): HTMLVideoElement {
  if (el) return el;

  el = document.createElement('video');
  el.playsInline = true;
  el.preload = 'metadata';
  el.crossOrigin = 'anonymous';

  el.addEventListener('loadedmetadata', onLoadedMetadata);
  el.addEventListener('playing', onPlaying);
  el.addEventListener('pause', onPause);
  el.addEventListener('ended', onEnded);
  el.addEventListener('error', onError);

  return el;
}

export function attachToContainer(container: HTMLElement): void {
  const mediaEl = getOrCreateElement();
  if (mediaEl.parentElement !== container) {
    container.appendChild(mediaEl);
  }
}

export function getElement(): HTMLVideoElement | null {
  return el;
}

export async function play(track: Track, context: PlayContext): Promise<void> {
  const mediaEl = getOrCreateElement();
  ensureGraph(mediaEl);
  await resumeContextIfNeeded();

  const store = useStore.getState();
  store.setCurrentTrack(track, context);
  store.setPlaying(true);

  mediaEl.src = track.url;
  mediaEl.playbackRate = store.playbackSpeed;   // ← add this

  await mediaEl.play();

  if (context.kind === 'playlist') {
    window.api.playlists.setCurrent(context.playlistId, context.entryId).catch(() => {});
  } else {
    window.api.settings.set('library.current_track_id', String(track.id)).catch(() => {});
  }
}

export function togglePlayPause(): void {
  if (!el) return;
  if (el.paused) {
    void el.play();
  } else {
    el.pause();
  }
}

export function seekTo(seconds: number): void {
  if (!el) return;
  el.currentTime = Math.max(0, seconds);
}

export function setPlaybackRate(rate: number): void {
  if (!el) return;
  el.playbackRate = rate;
}

// ---------- Event handlers ----------

function onLoadedMetadata(): void {
  if (!el) return;
  useStore.getState().setDuration(el.duration || 0);
}

function onPlaying(): void {
  useStore.getState().setPlaying(true);
}

function onPause(): void {
  useStore.getState().setPlaying(false);
}

function onEnded(): void {
  useStore.getState().setPlaying(false);
  // Advance to the next track in the current context.
  advanceToNext().catch((err) => console.error('[media] advance failed:', err));
}

function onError(): void {
  const mediaEl = el;
  if (!mediaEl) return;
  const err = mediaEl.error;
  console.error(
    '[media] playback error:',
    err?.code,
    err?.message,
    mediaEl.src
  );
  useStore.getState().setPlaying(false);
}

// ---------- Advancing ----------

async function advanceToNext(): Promise<void> {
  const store = useStore.getState();
  const { currentTrack, currentContext } = store;

  if (!currentTrack || !currentContext) return;

  if (currentContext.kind === 'library') {
    const tracks = store.libraryTracks;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1 || idx === tracks.length - 1) return; // nothing to advance to
    const next = tracks[idx + 1];
    await play(next, currentContext);
  } else {
    const playlist = store.activePlaylist;
    if (!playlist) return;
    const idx = playlist.entries.findIndex((e) => e.id === currentContext.entryId);
    if (idx === -1 || idx === playlist.entries.length - 1) return;
    const nextEntry = playlist.entries[idx + 1];
    await play(nextEntry.track, {
      kind: 'playlist',
      playlistId: currentContext.playlistId,
      entryId: nextEntry.id
    });
  }
}