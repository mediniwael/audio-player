import { useStore } from '../store';

let subscribed = false;

export function initScanListener(): void {
  if (subscribed) return;
  subscribed = true;

  window.api.on.scanStart((data) => {
    useStore.getState().setScanFolder(data.folderId, data.path);
  });

  window.api.on.scanProgress((data) => {
    useStore.getState().setScanProgress(data.folderId, data.processed);
  });

  window.api.on.scanDone((data) => {
    useStore.getState().markFolderScanned(data);
  });

  window.api.on.scanFinished(async (results) => {
    useStore.getState().finishScan(results);
    await useStore.getState().loadLibrary();
  });
}