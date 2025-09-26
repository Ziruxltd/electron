const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('versions', {
  processUserInput: (value) => ipcRenderer.invoke('process-user-input', value),
})