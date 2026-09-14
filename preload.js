const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  fetchSchedule: () => ipcRenderer.invoke('fetch-schedule'),
  saveSession: (session) => ipcRenderer.invoke('save-session', session),
})