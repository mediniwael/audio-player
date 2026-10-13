import type { StateCreator } from 'zustand';
import type { Store } from './index';

export interface SettingsSlice {
  settingsLoaded: boolean;

  loadSettings: () => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
}

export const createSettingsSlice: StateCreator<
  Store,
  [],
  [],
  SettingsSlice
> = (set) => ({
  settingsLoaded: false,

  loadSettings: async () => {
    const voiceBoost = (await window.api.settings.get('voiceBoost')) === 'true';
    const speedStr = await window.api.settings.get('playbackSpeed');
    const playbackSpeed = speedStr ? Number(speedStr) : 1.0;
    set({ voiceBoost, playbackSpeed, settingsLoaded: true });
  },

  setSetting: async (key, value) => {
    await window.api.settings.set(key, value);
  }
});