import type { StateCreator } from 'zustand';
import type { Track } from '../../../shared/api';
import type { Store } from './index';

export interface LibrarySlice {
  libraryTracks: Track[];
  libraryLoaded: boolean;

  loadLibrary: () => Promise<void>;
  setLibraryTracks: (tracks: Track[]) => void;
}

export const createLibrarySlice: StateCreator<
  Store,
  [],
  [],
  LibrarySlice
> = (set) => ({
  libraryTracks: [],
  libraryLoaded: false,

  loadLibrary: async () => {
    const tracks = await window.api.tracks.list();
    set({ libraryTracks: tracks, libraryLoaded: true });
  },

  setLibraryTracks: (tracks) => set({ libraryTracks: tracks })
});