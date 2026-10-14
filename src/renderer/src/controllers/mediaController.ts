import { useStore } from '../store';
import { ensureGraph, resumeContextIfNeeded, setVoiceBoost } from './audioGraph';
import { initResumeTracker, setResumeBaseline } from './resumeTracker';
import type { PlayContext, Track } from '../../../shared/api';

let el: HTMLVideoElement | null = null;

export interface PlayOptions {
  restart?: boolean;
}

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

  installMediaSessionHandlers();
  initResumeTracker(el);

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

export async function play(
  track: Track,
  context: PlayContext,
  options: PlayOptions = {}
): Promise<void> {
  const mediaEl = getOrCreateElement();
  ensureGraph(mediaEl);
  await resumeContextIfNeeded();

  const store = useStore.getState();
  store.setPlaybackError(null);
  store.setCurrentTrack(track, context);
  const wantsBoost = track.media_type === 'video'
  ? false
  : store.voiceBoost;
  setVoiceBoost(wantsBoost);  
  updateMediaSession(track);
  store.setPlaying(true);

  // Read the saved position BEFORE we set src, so the fetch isn't racing
  // with the element's own loading pipeline.
  const saved = options.restart
    ? 0
    : await window.api.tracks.getPosition(track.id);

  mediaEl.src = track.url;
  mediaEl.playbackRate = store.playbackSpeed;
  mediaEl.controls = track.media_type === 'video';

  await waitForMetadata(mediaEl);

  // Apply resume position. The guard skips positions within 1 second of the
  // end, which would otherwise start playback at the final frame.
  if (saved > 0 && saved < mediaEl.duration - 1) {
    mediaEl.currentTime = saved;
  }

  setResumeBaseline(mediaEl.currentTime);

  await mediaEl.play();

  // Persist the cursor for this context.
  if (context.kind === 'playlist') {
    store.setPlaylistCursor(context.playlistId, context.entryId);
    void window.api.playlists.setCurrent(context.playlistId, context.entryId);
  } else {
    store.setLibraryCursor(track.id);
    void window.api.settings.set('library.current_track_id', String(track.id));
  }
}

export function playFromStart(track: Track, context: PlayContext): Promise<void> {
  return play(track, context, { restart: true });
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

// ---------- Metadata wait ----------

function waitForMetadata(mediaEl: HTMLVideoElement): Promise<void> {
  if (mediaEl.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onLoaded = (): void => {
      mediaEl.removeEventListener('loadedmetadata', onLoaded);
      mediaEl.removeEventListener('error', onError);
      resolve();
    };
    const onError = (): void => {
      mediaEl.removeEventListener('loadedmetadata', onLoaded);
      mediaEl.removeEventListener('error', onError);
      reject(new Error('metadata load failed'));
    };
    mediaEl.addEventListener('loadedmetadata', onLoaded);
    mediaEl.addEventListener('error', onError);
  });
}

// ---------- Event handlers ----------

function onLoadedMetadata(): void {
  if (!el) return;
  useStore.getState().setDuration(el.duration || 0);
}

function onPlaying(): void {
  useStore.getState().setPlaying(true);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
}

function onPause(): void {
  useStore.getState().setPlaying(false);
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
}

function onEnded(): void {
  useStore.getState().setPlaying(false);
  void advanceToNext();
}

function onError(): void {
  if (!el) return;
  const err = el.error;
  const message = err?.message || 'Playback failed';
  console.error('[media] playback error:', err?.code, message, el.src);
  const store = useStore.getState();
  store.setPlaying(false);
  store.setPlaybackError(
    `${store.currentTrack?.title ?? 'Track'}: ${message}`
  );
}

// ---------- Advancing ----------

async function advanceToNext(): Promise<void> {
  const store = useStore.getState();
  const { currentTrack, currentContext } = store;

  if (!currentTrack || !currentContext) return;

  if (currentContext.kind === 'library') {
    const tracks = store.libraryTracks;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx === -1 || idx === tracks.length - 1) return;
    const next = tracks[idx + 1];
    await play(next, currentContext);
  } else {
    const playlist = store.activePlaylist;
    if (!playlist) return;
    const idx = playlist.entries.findIndex(
      (e) => e.id === currentContext.entryId
    );
    if (idx === -1 || idx === playlist.entries.length - 1) return;
    const nextEntry = playlist.entries[idx + 1];
    await play(nextEntry.track, {
      kind: 'playlist',
      playlistId: currentContext.playlistId,
      entryId: nextEntry.id
    });
  }
}

export function seekBy(deltaSeconds: number): void {
  if (!el) return;
  const duration = el.duration;
  if (!isFinite(duration) || duration <= 0) return;
  const next = Math.max(0, Math.min(duration, el.currentTime + deltaSeconds));
  el.currentTime = next;
}

function updateMediaSession(track: Track): void {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title ?? 'Unknown',
    artist: track.artist ?? '',
    album: track.album ?? ''
  });
}

function installMediaSessionHandlers(): void {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    if (!el) return;
    void el.play();
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    if (!el) return;
    el.pause();
  });

  navigator.mediaSession.setActionHandler('stop', () => {
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  });

  // Optional: only supported when the current context has a next track.
  // The `advanceToNext` function knows, so we can just call it and let it
  // decide. For a cleaner overlay, we could set the handler to null when
  // there's nothing next — do that in a later polish pass.
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    void advanceToNext();
  });
}

export async function enterFullscreen(): Promise<void> {
  if (!el) return;
  try {
    await el.requestFullscreen();
  } catch (err) {
    console.error('[media] fullscreen failed:', err);
  }
}

export function exitFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  }
}

export async function togglePictureInPicture(): Promise<void> {
  if (!el) return;
  try {
    if (document.pictureInPictureElement === el) {
      await document.exitPictureInPicture();
    } else {
      await el.requestPictureInPicture();
    }
  } catch (err) {
    console.error('[media] PiP failed:', err);
  }
}