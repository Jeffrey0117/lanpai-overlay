const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lanpai', {
  onAddText: (callback) => ipcRenderer.on('add-text', () => callback()),
  onAddImage: (callback) => ipcRenderer.on('add-image', (_event, filePath) => callback(filePath)),
  onClearAll: (callback) => ipcRenderer.on('clear-all', () => callback()),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore)
})
