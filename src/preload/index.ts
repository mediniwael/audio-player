import { contextBridge, ipcRenderer } from 'electron'
import type { AppApi } from '../shared/api'

const api: AppApi = {
  ping: () => ipcRenderer.invoke('ping'),
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    add: (text) => ipcRenderer.invoke('notes:add', text)
  }
}

contextBridge.exposeInMainWorld('api', api)
