import type { StateCreator } from 'zustand';
import type { Track } from '../../../shared/api';
import type { Store } from './index';

export interface LibrarySlice {
  libraryTracks: Track[];
  libraryLoaded: boolean;
  libraryCursorTrackId: number | null;

  loadLibrary: () => Promise<void>;
  setLibraryTracks: (tracks: Track[]) => void;
  loadLibraryCursor: () => Promise<void>;
  setLibraryCursor: (id: number | null) => void;
}

export const createLibrarySlice: StateCreator<
  Store,
  [],
  [],
  LibrarySlice
> = (set) => ({
  libraryTracks: [],
  libraryLoaded: false,
  libraryCursorTrackId: null,

  loadLibrary: async () => {
    const tracks = await window.api.tracks.list();
    set({ libraryTracks: tracks, libraryLoaded: true });
  },

  setLibraryTracks: (tracks) => set({ libraryTracks: tracks }),

  loadLibraryCursor: async () => {
    const stored = await window.api.settings.get('library.current_track_id');
    if (!stored) {
      set({ libraryCursorTrackId: null });
      return;
    }
    const id = Number(stored);
    set({ libraryCursorTrackId: Number.isFinite(id) ? id : null });
  },

  setLibraryCursor: (id) => set({ libraryCursorTrackId: id })
});