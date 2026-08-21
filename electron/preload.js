const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadScheduleData: () => ipcRenderer.invoke('load-schedule-data'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (x, y) => ipcRenderer.invoke('set-window-position', [x, y]),
  setWindowSize: (w, h) => ipcRenderer.invoke('set-window-size', [w, h]),
  onConfigLoaded: (callback) => {
    ipcRenderer.on('config-loaded', (_, config) => callback(config))
  },
  isElectron: true,
})
