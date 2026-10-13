import type { StateCreator } from 'zustand';
import type {
  Playlist,
  PlaylistWithEntries
} from '../../../shared/api';
import type { Store } from './index';

export interface PlaylistsSlice {
  playlists: Playlist[];
  activePlaylist: PlaylistWithEntries | null;

  loadPlaylists: () => Promise<void>;
  loadActivePlaylist: (id: number) => Promise<void>;
  clearActivePlaylist: () => void;

  createPlaylist: (name: string) => Promise<Playlist>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;

  addTracksToPlaylist: (playlistId: number, trackIds: number[]) => Promise<void>;
  removePlaylistEntry: (entryId: number) => Promise<void>;
  reorderPlaylist: (playlistId: number, entryIds: number[]) => Promise<void>;
  setPlaylistCursor: (playlistId: number, entryId: number | null) => void;
}

export const createPlaylistsSlice: StateCreator<
  Store,
  [],
  [],
  PlaylistsSlice
> = (set, get) => ({
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

  clearActivePlaylist: () => set({ activePlaylist: null }),

  createPlaylist: async (name) => {
    const playlist = await window.api.playlists.create(name);
    await get().loadPlaylists();
    return playlist;
  },

  renamePlaylist: async (id, name) => {
    await window.api.playlists.rename(id, name);
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, name } : p
      ),
      activePlaylist:
        s.activePlaylist && s.activePlaylist.playlist.id === id
          ? {
              ...s.activePlaylist,
              playlist: { ...s.activePlaylist.playlist, name }
            }
          : s.activePlaylist
    }));
  },

  deletePlaylist: async (id) => {
    await window.api.playlists.remove(id);
    set((s) => ({
      playlists: s.playlists.filter((p) => p.id !== id),
      activePlaylist:
        s.activePlaylist && s.activePlaylist.playlist.id === id
          ? null
          : s.activePlaylist
    }));
  },

  addTracksToPlaylist: async (playlistId, trackIds) => {
    await window.api.playlists.addTracks(playlistId, trackIds);
    await get().loadPlaylists();
    const active = get().activePlaylist;
    if (active && active.playlist.id === playlistId) {
      await get().loadActivePlaylist(playlistId);
    }
  },

  removePlaylistEntry: async (entryId) => {
    await window.api.playlists.removeEntry(entryId);
    const active = get().activePlaylist;
    if (active) {
      await get().loadActivePlaylist(active.playlist.id);
      await get().loadPlaylists();
    }
  },

  reorderPlaylist: async (playlistId, entryIds) => {
    await window.api.playlists.reorder(playlistId, entryIds);
    await get().loadActivePlaylist(playlistId);
  },

  setPlaylistCursor: (playlistId, entryId) => {
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, current_entry_id: entryId } : p
      ),
      activePlaylist:
        s.activePlaylist && s.activePlaylist.playlist.id === playlistId
          ? {
              ...s.activePlaylist,
              playlist: {
                ...s.activePlaylist.playlist,
                current_entry_id: entryId
              }
            }
          : s.activePlaylist
    }));
  }
});