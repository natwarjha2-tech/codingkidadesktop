const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__APP_CONFIG__', {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  API_BASE_URL: process.env.API_BASE_URL || 'https://www.codingkida.com',
});
