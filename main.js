const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
require('dotenv').config();

let mainWindow;
let pendingAuth = null; // store token before index.html loads

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/login.html'));
}

// Provide pending auth to renderer on load
ipcMain.handle('get-pending-auth', () => {
  const auth = pendingAuth;
  pendingAuth = null; // clear after use
  return auth;
});

// Handle login from renderer
ipcMain.handle('login', async (event, { email, password, remember }) => {
  try {
    const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, message: data.message || 'Login failed' };
    }

    // Store auth data BEFORE loading index.html so init() sees it immediately
    pendingAuth = { token: data.token, user: JSON.stringify(data.user || {}), remember };
    mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

    return { success: true, data };
  } catch (error) {
    return { success: false, message: error.message || 'Network error' };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
