const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__APP_CONFIG__', {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://www.codingkida.com',
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  },
  getPendingAuth: () => ipcRenderer.invoke('get-pending-auth'),
  getPendingEnroll: () => ipcRenderer.invoke('get-pending-enroll'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  downloadContent: (args) => ipcRenderer.invoke('download-content', args),
  getDownloads: (args) => ipcRenderer.invoke('get-downloads', args),
  playDownload: (args) => ipcRenderer.invoke('play-download', args),
  deleteDownload: (args) => ipcRenderer.invoke('delete-download', args),
});
