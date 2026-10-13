import type { StateCreator } from 'zustand';
import type { Track, PlayContext } from '../../../shared/api';
import type { Store } from './index';

export interface PlayerSlice {
  currentTrack: Track | null;
  currentContext: PlayContext | null;
  isPlaying: boolean;
  duration: number;
  voiceBoost: boolean;
  playbackSpeed: number;

  setCurrentTrack: (track: Track | null, context: PlayContext | null) => void;
  setPlaying: (isPlaying: boolean) => void;
  setDuration: (duration: number) => void;
  setVoiceBoost: (voiceBoost: boolean) => void;
  setPlaybackSpeed: (playbackSpeed: number) => void;
}

export const createPlayerSlice: StateCreator<
  Store,
  [],
  [],
  PlayerSlice
> = (set) => ({
  currentTrack: null,
  currentContext: null,
  isPlaying: false,
  duration: 0,
  voiceBoost: false,
  playbackSpeed: 1.0,

  setCurrentTrack: (track, context) =>
    set({ currentTrack: track, currentContext: context }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setDuration: (duration) => set({ duration }),
  setVoiceBoost: (voiceBoost) => set({ voiceBoost }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed })
});