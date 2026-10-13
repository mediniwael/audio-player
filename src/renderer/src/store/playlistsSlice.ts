import type { StateCreator } from 'zustand';
import type { Playlist, PlaylistWithEntries } from '../../../shared/api';
import type { Store } from './index';

export interface PlaylistsSlice {
  playlists: Playlist[];
  activePlaylist: PlaylistWithEntries | null;

  loadPlaylists: () => Promise<void>;
  loadActivePlaylist: (id: number) => Promise<void>;
  clearActivePlaylist: () => void;
}

export const createPlaylistsSlice: StateCreator<
  Store,
  [],
  [],
  PlaylistsSlice
> = (set) => ({
  playlists: [],
  activePlaylist: null,

  loadPlaylists: async () => {
    const playlists = await window.api.playlists.list();
    set({ playlists });
  },

  loadActivePlaylist: async (id) => {
    const activePlaylist = await window.api.playlists.get(id);
    set({ activePlaylist });
  },

  clearActivePlaylist: () => set({ activePlaylist: null })
});