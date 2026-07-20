const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onDeepLink: (handler) => {
    const listener = (_event, url) => handler(url)
    ipcRenderer.on('deep-link', listener)
    return () => ipcRenderer.removeListener('deep-link', listener)
  },
})
