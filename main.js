const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
require('dotenv').config();

const PROTOCOL = 'codingkida';
const BASE_URL = process.env.API_BASE_URL || 'https://www.codingkida.com';

// Register deep link protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Single instance lock — required for deep link on Windows
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow;
let pendingAuth = null;
let pendingEnroll = null; // store enroll token before renderer loads

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
  pendingAuth = null;
  return auth;
});

// Provide pending enroll token to renderer
ipcMain.handle('get-pending-enroll', () => {
  const enroll = pendingEnroll;
  pendingEnroll = null;
  return enroll;
});

// Handle deep link — codingkida://enroll?token=xxx
async function handleDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'enroll') {
      const token = parsed.searchParams.get('token');
      if (token && mainWindow) {
        // Verify token with backend and enroll
        const res = await fetch(`${BASE_URL}/api/enroll-token?token=${token}`);
        const data = await res.json();
        if (data.success) {
          pendingEnroll = { courseId: data.courseId };
          mainWindow.focus();
          mainWindow.webContents.send('enrollment-complete', { courseId: data.courseId });
        }
      }
    }
  } catch {}
}

// Windows: deep link via second instance
app.on('second-instance', (event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const url = commandLine.find(arg => arg.startsWith('codingkida://'));
  if (url) handleDeepLink(url);
});

// macOS: deep link via open-url
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Open external URL in system browser
ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

// Handle login from renderer
ipcMain.handle('login', async (event, { email, password, remember }) => {
  try {
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
