import { useStore } from '../store';

const SAVE_INTERVAL_SECONDS = 5;
//const END_GUARD_SECONDS = 1;

let el: HTMLVideoElement | null = null;
let lastSaved = 0;

export function initResumeTracker(mediaEl: HTMLVideoElement): void {
  if (el === mediaEl) return;
  el = mediaEl;

  el.addEventListener('timeupdate', onTimeUpdate);
  el.addEventListener('pause', onPause);
  el.addEventListener('seeked', onSeeked);
  el.addEventListener('ended', onEnded);

  window.addEventListener('beforeunload', onBeforeUnload);
}

// Called by mediaController after applying a saved position, so the next
// timeupdate doesn't immediately re-save the same value.
export function setResumeBaseline(seconds: number): void {
  lastSaved = seconds;
}

function currentTrackId(): number | null {
  return useStore.getState().currentTrack?.id ?? null;
}

function onTimeUpdate(): void {
  if (!el) return;
  const id = currentTrackId();
  if (id === null) return;
  if (Math.abs(el.currentTime - lastSaved) >= SAVE_INTERVAL_SECONDS) {
    lastSaved = el.currentTime;
    void window.api.tracks.savePosition(id, el.currentTime);
  }
}

function onPause(): void {
  saveNow();
}

function onSeeked(): void {
  saveNow();
}

function onEnded(): void {
  const id = currentTrackId();
  if (id === null) return;
  // Track played to completion. Reset so the next play starts from the
  // beginning. See design doc §11.1.
  lastSaved = 0;
  void window.api.tracks.savePosition(id, 0);
}

function onBeforeUnload(): void {
  saveNow();
}

function saveNow(): void {
  if (!el) return;
  const id = currentTrackId();
  if (id === null) return;
  lastSaved = el.currentTime;
  void window.api.tracks.savePosition(id, el.currentTime);
}