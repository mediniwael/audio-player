import type { StateCreator } from 'zustand';
import type { ScanResult } from '../../../shared/api';
import type { Store } from './index';

export interface ScanSlice {
  isScanning: boolean;
  scanFolderPath: string | null;
  scanProcessed: number;
  lastScanResults: ScanResult[] | null;

  startScan: () => Promise<void>;
  setScanFolder: (folderId: number, path: string) => void;
  setScanProgress: (folderId: number, processed: number) => void;
  markFolderScanned: (result: ScanResult) => void;
  finishScan: (results: ScanResult[]) => void;
}

export const createScanSlice: StateCreator<
  Store,
  [],
  [],
  ScanSlice
> = (set) => ({
  isScanning: false,
  scanFolderPath: null,
  scanProcessed: 0,
  lastScanResults: null,

  startScan: async () => {
  set({
    isScanning: true,
    scanFolderPath: null,
    scanProcessed: 0,
    lastScanResults: null
  });
  try {
    const results = await window.api.library.scan();
    set({ isScanning: false, lastScanResults: results });
  } catch (err) {
    console.error('[scan] failed:', err);
    set({ isScanning: false });
  }
},

  setScanFolder: (_folderId, path) =>
    set({ scanFolderPath: path, scanProcessed: 0 }),

  setScanProgress: (_folderId, processed) =>
    set({ scanProcessed: processed }),

  markFolderScanned: () => {
    // Fired per-folder during a scan. Reserved for per-folder progress
    // display in a later session.
  },

  finishScan: (results) =>
    set({ isScanning: false, lastScanResults: results })
});