const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
require('dotenv').config();

// Auto-updater — checks GitHub Releases for new versions
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
} catch {
  // electron-updater not available in dev mode, skip
}

const PROTOCOL = 'codingkida';
const BASE_URL = process.env.API_BASE_URL || 'https://www.codingkida.com';

// follow-redirects handles S3 signed URL redirects
const { https: followHttps, http: followHttp } = require('follow-redirects');

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
let pendingEnroll = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'CodingKida',
    icon: path.join(__dirname, 'src/renderer/assets/logo.png'),
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

// Google login complete — load main app
ipcMain.handle('google-login-complete', (event, data) => {
  if (mainWindow && data && data.token) {
    mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  }
});

// OTP login complete — load main app (token already verified)
ipcMain.handle('otp-login-complete', (event, { token, user, remember }) => {
  if (mainWindow && token) {
    pendingAuth = { token, user: JSON.stringify(user || {}), remember: remember !== false };
    mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));
  }
  return { success: true };
});

// Provide pending enroll token to renderer
ipcMain.handle('get-pending-enroll', () => {
  const enroll = pendingEnroll;
  pendingEnroll = null;
  return enroll;
});

// Handle deep link — codingkida://enroll?token=xxx or codingkida://auth?token=xxx
async function handleDeepLink(url) {
  try {
    const parsed = new URL(url);

    // Google OAuth success deep link: codingkida://auth?token=xxx&user=xxx
    if (parsed.hostname === 'auth') {
      const token = parsed.searchParams.get('token');
      const userRaw = parsed.searchParams.get('user');
      if (token && userRaw && mainWindow) {
        try {
          const user = JSON.parse(decodeURIComponent(userRaw));
          pendingAuth = { token, user: JSON.stringify(user), remember: true };
          mainWindow.focus();
          mainWindow.webContents.send('google-auth-token', { token, user });
        } catch {}
      }
      return;
    }

    if (parsed.hostname === 'enroll') {
      const token = parsed.searchParams.get('token');
      if (token && mainWindow) {
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

    pendingAuth = { token: data.token, user: JSON.stringify(data.user || {}), remember };
    mainWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

    return { success: true, data };
  } catch (error) {
    return { success: false, message: error.message || 'Network error' };
  }
});

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  createWindow();

  // Check for updates after window loads (non-blocking)
  if (autoUpdater) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 5000);

    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of CodingKida is ready. It will be installed when you restart the app.',
        buttons: ['Restart Now', 'Later']
      }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Offline Downloads ────────────────────────────────────────────────────────

const DOWNLOADS_DIR = path.join(app.getPath('userData'), 'ck_downloads');
const DOWNLOADS_META = path.join(app.getPath('userData'), 'ck_downloads_meta.json');
const EXPIRY_DAYS = 30;
const CIPHER_KEY_PREFIX = 'CodingKida-DL-';

function getEncryptionKey(userId) {
  return crypto.createHash('sha256').update(CIPHER_KEY_PREFIX + userId).digest();
}

function encryptBuffer(buffer, userId) {
  const key = getEncryptionKey(userId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(buffer, userId) {
  const key = getEncryptionKey(userId);
  const iv = buffer.slice(0, 16);
  const encrypted = buffer.slice(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function readMeta() {
  try {
    if (fs.existsSync(DOWNLOADS_META)) {
      const raw = JSON.parse(fs.readFileSync(DOWNLOADS_META, 'utf8'));
      // Migrate old keys (lessonId_type) to new keys (userId_lessonId_type)
      let migrated = false;
      for (const key of Object.keys(raw)) {
        const item = raw[key];
        if (item.userId && !key.startsWith(item.userId + '_')) {
          const newKey = item.userId + '_' + key;
          raw[newKey] = item;
          delete raw[key];
          migrated = true;
        }
      }
      if (migrated) fs.writeFileSync(DOWNLOADS_META, JSON.stringify(raw), 'utf8');
      return raw;
    }
  } catch {}
  return {};
}

function writeMeta(meta) {
  fs.writeFileSync(DOWNLOADS_META, JSON.stringify(meta), 'utf8');
}

// Fetch with redirect support — handles S3 signed URL redirects
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? followHttps : followHttp;
    const req = client.get(url, { maxRedirects: 10, timeout: 60000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume(); // drain response
        reject(new Error('Server returned HTTP ' + res.statusCode + '. The download link may have expired — please try again.'));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length === 0) {
          reject(new Error('Downloaded file is empty. Please try again.'));
          return;
        }
        resolve(buf);
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Download timed out after 60 seconds. Check your connection.'));
    });
  });
}

// Local HTTP server — serves decrypted content for playback (no data: URL needed)
let contentServer = null;
let contentServerPort = 0;
let pendingServeBuffer = null;
let pendingServeMime = null;

function startContentServer() {
  return new Promise((resolve) => {
    if (contentServer) { resolve(contentServerPort); return; }
    contentServer = http.createServer((req, res) => {
      if (!pendingServeBuffer || !pendingServeMime) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, {
        'Content-Type': pendingServeMime,
        'Content-Length': pendingServeBuffer.length,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(pendingServeBuffer);
    });
    contentServer.listen(0, '127.0.0.1', () => {
      contentServerPort = contentServer.address().port;
      resolve(contentServerPort);
    });
  });
}

// Download and encrypt a file
ipcMain.handle('download-content', async (event, { url, lessonId, title, type, userId, courseTitle, moduleTitle }) => {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const meta = readMeta();
    const metaKey = userId + '_' + lessonId + '_' + type;
    if (meta[metaKey]) {
      return { success: true, message: 'Already downloaded.' };
    }
    const buffer = await fetchBuffer(url);
    const encrypted = encryptBuffer(buffer, userId);
    const fileName = userId + '_' + lessonId + '_' + type + '.ckd';
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    fs.writeFileSync(filePath, encrypted);
    const expiresAt = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    meta[metaKey] = {
      lessonId, title, type, userId, courseTitle, moduleTitle,
      fileName, expiresAt, downloadedAt: Date.now(),
      mimeType: type === 'pdf' ? 'application/pdf' : 'video/mp4',
    };
    writeMeta(meta);
    return { success: true, message: 'Downloaded successfully.' };
  } catch (err) {
    return { success: false, message: err.message || 'Download failed.' };
  }
});

// Get all downloads (with expiry check)
ipcMain.handle('get-downloads', async (event, { userId }) => {
  try {
    const meta = readMeta();
    const now = Date.now();
    const valid = [];
    let changed = false;
    for (const key of Object.keys(meta)) {
      const item = meta[key];
      if (item.userId !== userId) continue;
      if (now > item.expiresAt) {
        const filePath = path.join(DOWNLOADS_DIR, item.fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        delete meta[key];
        changed = true;
        continue;
      }
      valid.push({ ...item, daysLeft: Math.ceil((item.expiresAt - now) / (24 * 60 * 60 * 1000)) });
    }
    if (changed) writeMeta(meta);
    return { success: true, downloads: valid };
  } catch {
    return { success: false, downloads: [] };
  }
});

// Play/view — decrypt and serve via local HTTP server
ipcMain.handle('play-download', async (event, { lessonId, type, userId }) => {
  try {
    const meta = readMeta();
    const item = meta[userId + '_' + lessonId + '_' + type];
    if (!item) return { success: false, message: 'Not found.' };
    if (Date.now() > item.expiresAt) return { success: false, message: 'Expired. Please re-download.' };
    const filePath = path.join(DOWNLOADS_DIR, item.fileName);
    const encrypted = fs.readFileSync(filePath);
    const decrypted = decryptBuffer(encrypted, userId);
    pendingServeBuffer = decrypted;
    pendingServeMime = item.mimeType;
    const port = await startContentServer();
    return { success: true, serveUrl: `http://127.0.0.1:${port}/content`, mimeType: item.mimeType, type: item.type };
  } catch (err) {
    return { success: false, message: err.message || 'Playback failed.' };
  }
});

// Delete a download
ipcMain.handle('delete-download', async (event, { lessonId, type, userId }) => {
  try {
    const meta = readMeta();
    const key = userId + '_' + lessonId + '_' + type;
    const item = meta[key];
    if (!item) return { success: false };
    const filePath = path.join(DOWNLOADS_DIR, item.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    delete meta[key];
    writeMeta(meta);
    return { success: true };
  } catch {
    return { success: false };
  }
});
