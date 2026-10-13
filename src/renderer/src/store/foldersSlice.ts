import type { StateCreator } from 'zustand';
import type { Folder } from '../../../shared/api';
import type { Store } from './index';

export interface FoldersSlice {
  folders: Folder[];

  loadFolders: () => Promise<void>;
  addFolder: () => Promise<void>;
  removeFolder: (id: number) => Promise<void>;
}

export const createFoldersSlice: StateCreator<
  Store,
  [],
  [],
  FoldersSlice
> = (set, get) => ({
  folders: [],

  loadFolders: async () => {
    const folders = await window.api.folders.list();
    set({ folders });
  },

  addFolder: async () => {
    const folders = await window.api.folders.add();
    set({ folders });
    // A new folder means the library likely changed. Trigger a scan.
    // (Wired up in Session 2 when the scan slice exists.)
    void get;
  },

  removeFolder: async (id) => {
    const folders = await window.api.folders.remove(id);
    set({ folders });
    // Removing a folder cascades to tracks in the database, so reload
    // the library to reflect the change.
    // (Wired up in Session 3.)
    // If the filtered folder was the one removed, clear the filter.
    if (get().libraryFolderFilter === id) {
      set({ libraryFolderFilter: null });
    }
  }
});