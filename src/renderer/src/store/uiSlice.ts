import type { StateCreator } from 'zustand';
import type { Store } from './index';

export interface ContextMenuTarget {
  kind: 'library-track' | 'playlist-entry' | 'folder' | 'playlist';
  id: number;
  x: number;
  y: number;
}

export interface PlaylistActionRequest {
  kind: 'rename' | 'delete';
  id: number;
}

export interface UiSlice {
  contextMenu: ContextMenuTarget | null;
  playlistActionRequest: PlaylistActionRequest | null;

  openContextMenu: (target: ContextMenuTarget) => void;
  closeContextMenu: () => void;
  requestPlaylistAction: (kind: 'rename' | 'delete', id: number) => void;
  clearPlaylistActionRequest: () => void;
}

export const createUiSlice: StateCreator<Store, [], [], UiSlice> = (set) => ({
  contextMenu: null,
  playlistActionRequest: null,

  openContextMenu: (target) => set({ contextMenu: target }),
  closeContextMenu: () => set({ contextMenu: null }),

  requestPlaylistAction: (kind, id) =>
    set({ playlistActionRequest: { kind, id } }),

  clearPlaylistActionRequest: () => set({ playlistActionRequest: null })
});