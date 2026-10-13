import { create } from 'zustand';
import { createLibrarySlice, type LibrarySlice } from './librarySlice';
import { createPlaylistsSlice, type PlaylistsSlice } from './playlistsSlice';
import { createPlayerSlice, type PlayerSlice } from './playerSlice';
import { createFoldersSlice, type FoldersSlice } from './foldersSlice';
import { createSettingsSlice, type SettingsSlice } from './settingsSlice';
import { createScanSlice, type ScanSlice } from './scanSlice';
import { createUiSlice, type UiSlice } from './uiSlice';

export interface Store
  extends LibrarySlice,
    PlaylistsSlice,
    PlayerSlice,
    FoldersSlice,
    SettingsSlice,
    ScanSlice,
    UiSlice {}

export const useStore = create<Store>()((...args) => ({
  ...createLibrarySlice(...args),
  ...createPlaylistsSlice(...args),
  ...createPlayerSlice(...args),
  ...createFoldersSlice(...args),
  ...createSettingsSlice(...args),
  ...createScanSlice(...args),
  ...createUiSlice(...args)
}));