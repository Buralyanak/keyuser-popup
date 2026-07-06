const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronSettings', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
});
