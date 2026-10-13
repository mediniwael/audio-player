import type { StateCreator } from 'zustand';
import type { Track, PlayContext, Playlist } from '../../../shared/api';
import type { Store } from './index';

export interface PlayerSlice {
  currentTrack: Track | null;
  currentContext: PlayContext | null;
  isPlaying: boolean;
  duration: number;
  voiceBoost: boolean;
  playbackSpeed: number;
  playbackError: string | null;

  setPlaybackError: (err: string | null) => void;
  setCurrentTrack: (track: Track | null, context: PlayContext | null) => void;
  setPlaying: (isPlaying: boolean) => void;
  setDuration: (duration: number) => void;
  setVoiceBoost: (voiceBoost: boolean) => void;
  setPlaybackSpeed: (playbackSpeed: number) => void;
  createPlaylistFromFolder: (
    folderId: number,
    name: string
  ) => Promise<Playlist>;
}

export const createPlayerSlice: StateCreator<
  Store,
  [],
  [],
  PlayerSlice
> = (set,get) => ({
  currentTrack: null,
  currentContext: null,
  isPlaying: false,
  duration: 0,
  voiceBoost: false,
  playbackSpeed: 1.0,
  playbackError: null,

  setCurrentTrack: (track, context) =>
    set({ currentTrack: track, currentContext: context }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setVoiceBoost: (voiceBoost) => set({ voiceBoost }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setPlaybackError: (playbackError) => set({ playbackError }),
  createPlaylistFromFolder: async (folderId, name) => {
  // The library is already loaded in the store, so we can build the
  // track list without an extra IPC round trip. The filter preserves
  // the natural sort order the library uses.
  const trackIds = get()
    .libraryTracks.filter((t) => t.folder_id === folderId)
    .map((t) => t.id);

  if (trackIds.length === 0) {
    throw new Error('Folder has no tracks to add');
  }

  const playlist = await window.api.playlists.create(name);
  await window.api.playlists.addTracks(playlist.id, trackIds);
  await get().loadPlaylists();
  return playlist;
},
});