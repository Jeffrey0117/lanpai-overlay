const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lanpai', {
  onAddSmart: (callback) => ipcRenderer.on('add-smart', () => callback()),
  onAddImage: (callback) => ipcRenderer.on('add-image', (_event, source) => callback(source)),
  onClearAll: (callback) => ipcRenderer.on('clear-all', () => callback()),
  onUndo: (callback) => ipcRenderer.on('undo', () => callback()),
  onShowHistory: (callback) => ipcRenderer.on('show-history', () => callback()),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore)
})
