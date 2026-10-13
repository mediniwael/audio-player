import type { StateCreator } from 'zustand';
import type { Track } from '../../../shared/api';
import type { Store } from './index';

export interface LibrarySlice {
  libraryTracks: Track[];
  libraryLoaded: boolean;
  libraryLoading: boolean;
  libraryCursorTrackId: number | null;
  libraryError: string | null;
  libraryFolderFilter: number | null;

  setLibraryFolderFilter: (folderId: number | null) => void;
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
  libraryLoading: false,
  libraryCursorTrackId: null,
  libraryError: null,
  libraryFolderFilter: null,

  setLibraryFolderFilter: (folderId) => set({ libraryFolderFilter: folderId }),
  loadLibrary: async () => {
  set({ libraryLoading: true, libraryError: null });
  try {
    const tracks = await window.api.tracks.list();
    set({ libraryTracks: tracks, libraryLoaded: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[library] load failed:', err);
    set({ libraryError: message });
  } finally {
    set({ libraryLoading: false });
  }
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