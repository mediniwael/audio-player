import { contextBridge, ipcRenderer } from 'electron';
import type { AppApi } from '../shared/api';

const api: AppApi = {
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    add: () => ipcRenderer.invoke('folders:add'),
    remove: (id) => ipcRenderer.invoke('folders:remove', id)
  },
  library: {
    scan: () => ipcRenderer.invoke('library:scan')
  },
  tracks: {
    list: () => ipcRenderer.invoke('tracks:list'),
    inFolder: (id) => ipcRenderer.invoke('tracks:inFolder', id),
    getPosition: (id) => ipcRenderer.invoke('tracks:getPosition', id),
    savePosition: (id, seconds) =>
      ipcRenderer.invoke('tracks:savePosition', id, seconds)
  },
  playlists: {
    list: () => ipcRenderer.invoke('playlists:list'),
    create: (name) => ipcRenderer.invoke('playlists:create', name),
    rename: (id, name) => ipcRenderer.invoke('playlists:rename', id, name),
    remove: (id) => ipcRenderer.invoke('playlists:remove', id),
    get: (id) => ipcRenderer.invoke('playlists:get', id),
    addTracks: (playlistId, trackIds) =>
      ipcRenderer.invoke('playlists:addTracks', playlistId, trackIds),
    removeEntry: (entryId) =>
      ipcRenderer.invoke('playlists:removeEntry', entryId),
    reorder: (playlistId, entryIds) =>
      ipcRenderer.invoke('playlists:reorder', playlistId, entryIds),
    setCurrent: (playlistId, entryId) =>
      ipcRenderer.invoke('playlists:setCurrent', playlistId, entryId),
    getCurrent: (playlistId) =>
      ipcRenderer.invoke('playlists:getCurrent', playlistId)
  },
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value)
  },
  on: {
    scanStart: (cb) =>
      ipcRenderer.on('scan:start', (_e, data) => cb(data)),
    scanProgress: (cb) =>
      ipcRenderer.on('scan:progress', (_e, data) => cb(data)),
    scanDone: (cb) =>
      ipcRenderer.on('scan:done', (_e, data) => cb(data)),
    scanFinished: (cb) =>
      ipcRenderer.on('scan:finished', (_e, data) => cb(data))
  }
};

contextBridge.exposeInMainWorld('api', api);