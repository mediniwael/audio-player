import type { StateCreator } from 'zustand';
import type { Store } from './index';

export interface ContextMenuTarget {
  kind: 'library-track' | 'playlist-entry';
  id: number;
  x: number;
  y: number;
}

export interface UiSlice {
  contextMenu: ContextMenuTarget | null;
  openContextMenu: (target: ContextMenuTarget) => void;
  closeContextMenu: () => void;
}

export const createUiSlice: StateCreator<Store, [], [], UiSlice> = (set) => ({
  contextMenu: null,
  openContextMenu: (target) => set({ contextMenu: target }),
  closeContextMenu: () => set({ contextMenu: null })
});