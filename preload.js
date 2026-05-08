const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__APP_CONFIG__', {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://www.codingkida.com',
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
  },
  getPendingAuth: () => ipcRenderer.invoke('get-pending-auth')
});
