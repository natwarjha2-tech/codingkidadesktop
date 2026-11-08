const { app, BrowserWindow, ipcMain, shell, dialog, desktopCapturer, session, screen } = require('electron');
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

  // Verbose logging so update activity is visible in a log file
  try {
    const log = require('electron-log');
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    console.log('[updater] electron-log attached. Log file:', log.transports.file.getFile().path);
  } catch {
    // electron-log not installed; fall back to console logging
    autoUpdater.logger = console;
  }
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
let livePipWindow = null; // Live Class PiP mini-window (always-on-top). ISOLATED.
let livePipArmed = false; // is a live class active? (enables blur auto-PiP — Case 3)
let livePipSuppressed = false; // true while the user is ON the live-room page →
                               // don't auto-open the PiP on blur (P3: a dialog
                               // opening on the room page briefly blurs the
                               // window; we must NOT pop the PiP then).

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
      preload: path.join(__dirname, 'preload.js'),
      // Live Class reliability: never throttle this renderer when the window is
      // in the background/minimized. Without this, Chromium throttles timers +
      // the WebRTC/media pipeline when the window loses focus, which freezes a
      // teacher's screen-share video and makes audio buffer the moment they
      // switch to another app/window. Keeping it alive is what Teams/Zoom-style
      // Electron apps do for continuous A/V. No effect on security.
      backgroundThrottling: false
    }
  });

  // Live Class (ISOLATED): allow camera + microphone + screen-share for the
  // Chime A/V session. Scoped to media / display-capture only — every other
  // permission keeps Electron's default (deny) behaviour, so this does not
  // loosen security for the rest of the app.
  try {
    mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
      if (permission === 'media' || permission === 'display-capture') return callback(true);
      return callback(false);
    });
  } catch {}

  // Live Class screen-share (teacher): the renderer calls getDisplayMedia(); we
  // handle the request by giving Chrome the source the user picked in our own
  // picker. The renderer first calls the 'live-screen-sources' IPC to show the
  // picker, stores the chosen id, then calls getDisplayMedia — this handler
  // reads that id back. Isolated to the live feature; no effect elsewhere.
  try {
    mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        const chosenId = global.__ckLiveShareSourceId;
        const picked = sources.find((s) => s.id === chosenId) || sources[0];
        if (picked) {
          callback({ video: picked, audio: 'loopback' });
        } else {
          // No source — cancel the request cleanly.
          callback();
        }
      }).catch(() => callback());
    }, { useSystemPicker: false });
  } catch {}

  // Case 3 (Step 4): when a live class is active and the main window loses focus
  // or is minimized, auto-open the floating mini-window (Teams-style). Done in
  // the main process so no renderer user-gesture is required.
  //
  // IMPORTANT (flap-proofing): opening the mini-window itself steals focus from
  // the main window → fires another 'blur'. Without care this creates an
  // open/close loop + multiple windows. So we:
  //   - debounce blur by 300ms and only open if the main window is STILL not
  //     focused AND the mini-window isn't already open,
  //   - treat focus/show/restore (user returned to the app) as the single
  //     "close" trigger.
  let _pipBlurTimer = null;
  // `fromMinimize` = the trigger was an actual window minimize (not a plain
  // focus-loss/blur). On a minimize we ALWAYS want the mini-window — even on the
  // live-room page (P8): a host who minimizes while screen-sharing a single
  // window must get the PiP (so they never "lose" the class), which the
  // `livePipSuppressed` guard (meant only for in-page dialogs/pickers that blur
  // the window) would otherwise block. A plain blur still honours suppress.
  const _pipMaybeOpenOnBlur = (fromMinimize) => {
    if (_pipBlurTimer) clearTimeout(_pipBlurTimer);
    _pipBlurTimer = setTimeout(() => {
      _pipBlurTimer = null;
      if (!livePipArmed) return;
      // P3: on the live-room page itself, a function's dialog/picker blurs the
      // window — do NOT auto-open the PiP there (the room is already on screen).
      // EXCEPTION (P8): a real minimize always pops the PiP, even on that page.
      if (livePipSuppressed && !fromMinimize) return;
      if (livePipWindow && !livePipWindow.isDestroyed()) return; // already open
      // Only pop out if the main window is genuinely not focused/visible.
      if (mainWindow.isFocused()) return;
      createLivePipWindow({ width: 360, height: 240 });
    }, 300);
  };
  const _pipCloseOnReturn = () => {
    if (_pipBlurTimer) { clearTimeout(_pipBlurTimer); _pipBlurTimer = null; }
    closeLivePipWindow();
  };

  mainWindow.on('blur', () => _pipMaybeOpenOnBlur(false));
  mainWindow.on('minimize', () => _pipMaybeOpenOnBlur(true));
  mainWindow.on('focus', _pipCloseOnReturn);
  mainWindow.on('show', _pipCloseOnReturn);
  mainWindow.on('restore', _pipCloseOnReturn);

  // Allow opening DevTools with F12 / Ctrl+Shift+I so console errors (e.g. live
  // class connection failures) can be diagnosed. Harmless in production too.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = (input.key || '').toLowerCase();
    if (input.type === 'keyDown' && (key === 'f12' ||
        (input.control && input.shift && key === 'i'))) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src/renderer/login.html'));
}

// Live Class screen-share: return the list of shareable screens/windows (with
// thumbnails) so the renderer can show a picker. ISOLATED — live feature only.
ipcMain.handle('live-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : '',
    }));
  } catch {
    return [];
  }
});

// Record the source the teacher picked, read back by the display-media handler.
ipcMain.handle('live-set-screen-source', (event, sourceId) => {
  global.__ckLiveShareSourceId = sourceId || null;
  return { success: true };
});

// ─── Live Class PiP mini-window (ISOLATED — Step 1: plumbing only) ──────────────
// A small, frameless, always-on-top window that will host the floating live
// class (video + controls arrive in later steps). The main window keeps the
// Chime media session; this window is purely a secondary view, so opening or
// closing it never affects the ongoing class.

function createLivePipWindow(opts) {
  // Reuse the existing window if it's already open (idempotent).
  if (livePipWindow && !livePipWindow.isDestroyed()) {
    livePipWindow.show();
    livePipWindow.focus();
    return livePipWindow;
  }

  const width = (opts && opts.width) || 360;
  const height = (opts && opts.height) || 240;

  // Position the mini-window in the BOTTOM-RIGHT corner of the primary display
  // (Teams/Meet-style), not the screen center. Uses the work area so it sits
  // above the taskbar, with a small margin. Guarded so any display-API hiccup
  // just falls back to Electron's default centering.
  let pipX, pipY;
  try {
    const wa = screen.getPrimaryDisplay().workArea; // { x, y, width, height }
    const margin = 20;
    pipX = wa.x + wa.width - width - margin;
    pipY = wa.y + wa.height - height - margin;
  } catch { pipX = undefined; pipY = undefined; }

  livePipWindow = new BrowserWindow({
    width,
    height,
    x: pipX,
    y: pipY,
    minWidth: 240,
    minHeight: 160,
    frame: false,              // custom chrome (draggable header added later)
    resizable: true,
    alwaysOnTop: true,         // float above every other app (OS-level) — Teams-like
    skipTaskbar: true,
    backgroundColor: '#0f0f1a',
    title: 'CodingKida Live',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // keep the mini view smooth in the background
    },
  });

  // Make sure it stays above full-screen apps too (best-effort).
  try { livePipWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}

  // Exclude the PiP mini-window from screen capture / screen-share (OS-level).
  // The host still SEES this floating window to monitor the share, but when the
  // host shares their ENTIRE screen, this window is NOT captured — so
  // participants never see a duplicate of the shared content inside the PiP.
  // On Windows this uses SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE).
  try { livePipWindow.setContentProtection(true); } catch {}

  livePipWindow.loadFile(path.join(__dirname, 'src/renderer/live-pip.html'));

  livePipWindow.on('closed', () => { livePipWindow = null; });
  return livePipWindow;
}

function closeLivePipWindow(focusMain) {
  if (livePipWindow && !livePipWindow.isDestroyed()) {
    try { livePipWindow.close(); } catch {}
  }
  livePipWindow = null;
  // Bring the main app window back to the foreground when the user explicitly
  // returns from the mini-window (e.g. "expand" button). Not done on an
  // automatic focus-close (the user is already looking at the main window).
  if (focusMain && mainWindow && !mainWindow.isDestroyed()) {
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } catch {}
  }
}

// Open the PiP mini-window.
ipcMain.handle('live-pip:open', (event, opts) => {
  try {
    createLivePipWindow(opts);
    return { success: true };
  } catch (err) {
    return { success: false, message: err && err.message ? err.message : 'Could not open PiP.' };
  }
});

// Close the PiP mini-window. `focusMain` brings the app window to front (used
// by the mini-window's "return to app" button).
ipcMain.handle('live-pip:close', (event, opts) => {
  closeLivePipWindow(opts && opts.focusMain);
  return { success: true };
});

// Arm/disarm blur auto-PiP (Case 3). When armed (a class is live), the main
// window losing focus/minimizing auto-opens the mini-window — this is done in
// the MAIN process so it needs no renderer user-gesture (unlike the browser
// Document-PiP API). Disarming (class ended/left) stops that behaviour.
ipcMain.handle('live-pip:armed', (event, armed) => {
  livePipArmed = !!armed;
  // If we disarm, make sure no stray mini-window remains.
  if (!livePipArmed) closeLivePipWindow();
  return { success: true };
});

// Suppress/allow blur auto-PiP (P3). The renderer sets this true while the user
// is ON the live-room page, so a dialog/picker blurring the window there never
// pops the PiP; false on every other page so the normal in-app/out-of-app PiP
// behaviour continues.
ipcMain.handle('live-pip:suppress', (event, suppressed) => {
  livePipSuppressed = !!suppressed;
  return { success: true };
});

// Exclude/include the MAIN window from screen capture (share full-screen mode).
// While the HOST views their own share in full screen, the app window covers
// the monitor; if they are sharing that monitor, capture would record the
// full-screen preview itself → an infinite "mirror tunnel" for viewers. Content
// protection (Windows: SetWindowDisplayAffinity WDA_EXCLUDEFROMCAPTURE — the
// same mechanism the PiP window uses) keeps the app window out of the capture so
// viewers keep seeing the real shared content. Turned off again on exit. The
// main window has no other content protection, so toggling it is side-effect
// free.
ipcMain.handle('live-share-fs:protect', (event, on) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setContentProtection(!!on);
  } catch {}
  return { success: true };
});

// Relay a COMMAND from the mini-window → the main window (mic/cam/leave). The
// main window owns the Chime session and performs the real action. Main process
// is just the messenger (mini and main are separate renderers).
ipcMain.on('live-pip:command', (event, payload) => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('live-pip:command', payload || {});
  }
});

// Handshake: mini-window finished loading → tell the main window to start the
// video send + push state. This makes video work no matter HOW the mini-window
// was opened (renderer call OR main-process blur auto-open — Case 3).
ipcMain.on('live-pip:ready', () => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('live-pip:ready');
  }
});

// Relay STATE from the main window → the mini-window (title, count, mic/cam/rec
// status) so the floating view stays in sync with the real class.
ipcMain.on('live-pip:state', (event, payload) => {
  if (livePipWindow && !livePipWindow.isDestroyed() && livePipWindow.webContents) {
    livePipWindow.webContents.send('live-pip:state', payload || {});
  }
});

// ─── WebRTC loopback signaling relay (Step 3) ───────────────────────────────────
// The primary live video is streamed from the MAIN window to the MINI window via
// a localhost RTCPeerConnection. The two windows are separate renderers, so the
// main process relays the SDP offer/answer + ICE candidates between them. This
// is a pure in-process loopback — no external network, no server, no STUN/TURN.

// Main → mini: SDP OFFER from the sender (main window).
ipcMain.on('live-pip:webrtc-offer', (event, sdp) => {
  if (livePipWindow && !livePipWindow.isDestroyed() && livePipWindow.webContents) {
    livePipWindow.webContents.send('live-pip:webrtc-offer', sdp);
  }
});

// Mini → main: SDP ANSWER from the receiver (mini window).
ipcMain.on('live-pip:webrtc-answer', (event, sdp) => {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('live-pip:webrtc-answer', sdp);
  }
});

// ICE candidates both ways. `to` tells the relay which window to forward to.
ipcMain.on('live-pip:webrtc-ice', (event, payload) => {
  const to = payload && payload.to;
  const candidate = payload && payload.candidate;
  if (to === 'mini') {
    if (livePipWindow && !livePipWindow.isDestroyed() && livePipWindow.webContents) {
      livePipWindow.webContents.send('live-pip:webrtc-ice', candidate);
    }
  } else {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('live-pip:webrtc-ice', candidate);
    }
  }
});

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

// Quit and install update (triggered from notification)
ipcMain.handle('quit-and-install-update', () => {
  if (autoUpdater) autoUpdater.quitAndInstall();
});

// ── CloudFront HLS cookie injection ──────────────────────────────────────────
// Approach: use session.webRequest.onBeforeSendHeaders to intercept every
// request to the CloudFront domain and inject the Cookie header at the network
// layer (main process). This bypasses the renderer CORS restriction that blocks
// setting Cookie on cross-origin XHR — Electron's network stack doesn't have
// that restriction. hls.js makes plain XHR without withCredentials and the
// cookies are injected transparently.
let _cfCookieHeader = '';   // the combined Cookie header string
let _cfDomain = '';         // e.g. d17ni0motewviz.cloudfront.net

ipcMain.handle('set-cf-cookies', async (event, { cookies, domain }) => {
  try {
    // Build a single Cookie header string from the three CF cookies.
    _cfCookieHeader = Object.entries(cookies)
      .map(([name, value]) => `${name}=${String(value)}`)
      .join('; ');
    _cfDomain = domain.replace(/^https?:\/\//, '');

    // Register the webRequest interceptor (or update it if already registered).
    // Intercepts every outgoing request whose URL contains the CF domain and
    // injects the signed Cookie header before it leaves the main process.
    const ses = mainWindow && mainWindow.webContents
      ? mainWindow.webContents.session
      : session.defaultSession;

    // Remove any prior listener first (prevents stacking on repeated calls).
    try { ses.webRequest.onBeforeSendHeaders(null); } catch {}

    ses.webRequest.onBeforeSendHeaders(
      { urls: [`https://${_cfDomain}/*`] },
      (details, callback) => {
        const headers = { ...details.requestHeaders, Cookie: _cfCookieHeader };
        callback({ requestHeaders: headers });
      }
    );

    console.log(`[set-cf-cookies] Interceptor registered for https://${_cfDomain}/*`);
    return { ok: true };
  } catch (err) {
    console.error('[set-cf-cookies] failed:', err);
    return { ok: false };
  }
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

// Live Class reliability (Phase 4): stop Chromium from backgrounding/throttling
// the renderer when the window is not focused/visible. Paired with the window's
// `backgroundThrottling: false`, this keeps the Chime WebRTC media pipeline
// (screen-share video + audio) running smoothly when the host/student switches
// to another app or minimizes — matching Teams/Zoom-style behaviour. These are
// process-wide switches and must be set before app.whenReady(). No security impact.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

app.whenReady().then(() => {
  createWindow();

  // Check for updates after window loads (non-blocking)
  if (autoUpdater) {
    console.log('[updater] current app version:', app.getVersion(), 'isPackaged:', app.isPackaged);

    setTimeout(() => {
      console.log('[updater] checking for updates...');
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.error('[updater] check failed:', err && err.message ? err.message : err);
      });
    }, 5000);

    autoUpdater.on('checking-for-update', () => {
      console.log('[updater] checking-for-update event fired');
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[updater] update-not-available. Server version:', info && info.version);
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater] error:', err && err.message ? err.message : err);
    });

    autoUpdater.on('update-available', (info) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('app-update-available', { version: info.version || 'new' });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('app-update-downloaded', { version: info.version || 'new' });
      }
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

// Make sure the PiP mini-window never outlives the app (clean shutdown).
app.on('before-quit', () => {
  closeLivePipWindow();
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
let pendingServeBuffer = null;   // single-file (PDF / legacy)
let pendingServeMime = null;
let pendingHlsDir = null;        // per-lesson HLS directory for path-based serving

function startContentServer() {
  return new Promise((resolve) => {
    if (contentServer) { resolve(contentServerPort); return; }
    contentServer = http.createServer((req, res) => {
      const url = require('url').parse(req.url);
      const pathname = decodeURIComponent(url.pathname || '/');

      // ── HLS offline path-based serving ──────────────────────────────────
      // Requests come in as /hls/<filename> (e.g. /hls/master.m3u8,
      // /hls/v0_seg0.m4s). Decrypt and serve the corresponding local file.
      if (pathname.startsWith('/hls/') && pendingHlsDir) {
        const filename = path.basename(pathname); // strip any sub-path traversal
        const filePath = path.join(pendingHlsDir, filename);
        if (!fs.existsSync(filePath)) {
          res.writeHead(404); res.end('Not found: ' + filename); return;
        }
        try {
          // Files are stored as raw (not encrypted) because HLS needs random
          // access to segments; the directory itself is in the app userData
          // folder which is user-private.
          const buf = fs.readFileSync(filePath);
          const ext = path.extname(filename).toLowerCase();
          const mime = ext === '.m3u8' ? 'application/vnd.apple.mpegurl'
            : (ext === '.m4s' || ext === '.mp4') ? 'video/mp4'
            : 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': buf.length,
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*',
          });
          res.end(buf);
        } catch (e) {
          res.writeHead(500); res.end('Read error: ' + e.message);
        }
        return;
      }

      // ── Legacy single-buffer path (PDF) ──────────────────────────────────
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

// ── HLS offline download ──────────────────────────────────────────────────────
// Downloads one quality of an HLS stream (360p by default — smallest) into a
// per-lesson directory under DOWNLOADS_DIR, then writes a local master.m3u8 that
// points to the local files so hls.js can play offline without any network calls.
//
// Storage layout:
//   DOWNLOADS_DIR/{userId}_{lessonId}_hls/
//     master.m3u8          ← local master (points to v0.m3u8)
//     v0.m3u8              ← variant playlist (segments rewritten to local paths)
//     init_0.mp4           ← fMP4 init segment
//     v0_seg0.m4s …        ← all media segments
//   DOWNLOADS_META: entry with type='hls', hlsDir=<absPath>
//
// Segments are stored RAW (no encryption) — the directory lives in Electron's
// userData which is user-private (not web-accessible). This avoids the memory
// cost of loading hundreds of segments for decryption at playback time.
ipcMain.handle('download-hls', async (event, { masterUrl, cookies, lessonId, title, userId, courseTitle, moduleTitle, qualityIndex }) => {
  const metaKey = userId + '_' + lessonId + '_hls';
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const meta = readMeta();

    // Already downloaded?
    if (meta[metaKey]) {
      const existing = path.join(DOWNLOADS_DIR, meta[metaKey].hlsDirName);
      if (fs.existsSync(path.join(existing, 'master.m3u8'))) {
        return { success: true, message: 'Already downloaded.' };
      }
      delete meta[metaKey]; // stale — re-download
    }

    const hlsDirName = userId + '_' + lessonId + '_hls';
    const hlsDir = path.join(DOWNLOADS_DIR, hlsDirName);
    if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true, force: true });
    fs.mkdirSync(hlsDir, { recursive: true });

    // Helper: fetch a CloudFront URL with the signed cookies injected.
    const cookieHeader = cookies || '';
    function fetchHls(url) {
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? followHttps : followHttp;
        const reqOpts = { maxRedirects: 10, timeout: 30000,
          headers: cookieHeader ? { Cookie: cookieHeader } : {} };
        const req = client.get(url, reqOpts, (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            res.resume();
            reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
            return;
          }
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve(Buffer.concat(chunks)));
          res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout: ' + url)); });
      });
    }

    // 1. Fetch master.m3u8
    const masterBuf = await fetchHls(masterUrl);
    const masterText = masterBuf.toString('utf8');

    // 2. Parse variant playlist URLs from master
    // Lines after #EXT-X-STREAM-INF are the variant playlist relative URLs
    const masterLines = masterText.split('\n').map(l => l.trim()).filter(Boolean);
    const variantUrls = [];
    for (let i = 0; i < masterLines.length; i++) {
      if (masterLines[i].startsWith('#EXT-X-STREAM-INF')) {
        const nextLine = masterLines[i + 1];
        if (nextLine && !nextLine.startsWith('#')) variantUrls.push(nextLine);
      }
    }
    if (variantUrls.length === 0) throw new Error('No variants found in master.m3u8');

    // 3. Pick quality: qualityIndex controls which variant (0=highest, last=lowest).
    // Default: last variant = lowest bitrate = smallest download.
    const qi = (typeof qualityIndex === 'number' && qualityIndex < variantUrls.length)
      ? qualityIndex
      : variantUrls.length - 1;  // default = smallest (360p)

    // Resolve the variant URL relative to the master
    const baseUrl = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
    function resolveUrl(rel) {
      if (rel.startsWith('http')) return rel;
      return baseUrl + rel;
    }

    const variantRelUrl = variantUrls[qi];
    const variantAbsUrl = resolveUrl(variantRelUrl);

    // 4. Fetch variant playlist
    const variantBuf = await fetchHls(variantAbsUrl);
    const variantText = variantBuf.toString('utf8');
    const variantLines = variantText.split('\n').map(l => l.trim());
    const variantBase = variantAbsUrl.substring(0, variantAbsUrl.lastIndexOf('/') + 1);

    // 5. Find all segment files: EXT-X-MAP (init) + .m4s/.ts segments
    const filesToDownload = []; // { remoteUrl, localName }
    let initFilename = null;
    for (const line of variantLines) {
      if (line.startsWith('#EXT-X-MAP:URI="')) {
        const uriMatch = line.match(/URI="([^"]+)"/);
        if (uriMatch) {
          const rel = uriMatch[1];
          const localName = path.basename(rel);
          filesToDownload.push({ remoteUrl: resolveUrl(rel), localName, isInit: true });
          initFilename = localName;
        }
      } else if (line && !line.startsWith('#')) {
        const localName = path.basename(line);
        filesToDownload.push({ remoteUrl: resolveUrl(line), localName, isInit: false });
      }
    }
    if (filesToDownload.length === 0) throw new Error('No segments found in variant playlist');

    // 6. Download all segments
    for (const f of filesToDownload) {
      const buf = await fetchHls(f.remoteUrl);
      fs.writeFileSync(path.join(hlsDir, f.localName), buf);
    }

    // 7. Write local variant playlist — replace remote segment references with
    //    local filenames so hls.js fetches from the local HTTP server.
    const localVariantLines = variantLines.map(line => {
      if (!line || line.startsWith('#')) {
        // Rewrite EXT-X-MAP URI to local filename
        if (line.startsWith('#EXT-X-MAP:URI="')) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch) return line.replace(uriMatch[1], path.basename(uriMatch[1]));
        }
        return line;
      }
      return path.basename(line); // segment filename only
    });
    const localVariantName = 'v0.m3u8'; // always save as v0.m3u8
    fs.writeFileSync(path.join(hlsDir, localVariantName), localVariantLines.join('\n'), 'utf8');

    // 8. Write local master.m3u8 pointing to the local variant
    // Keep the original STREAM-INF metadata (bandwidth/resolution) but point
    // at the local v0.m3u8.
    const localMasterLines = [];
    let skipNext = false;
    for (let i = 0; i < masterLines.length; i++) {
      if (masterLines[i].startsWith('#EXT-X-STREAM-INF')) {
        localMasterLines.push(masterLines[i]);
        skipNext = true; // next non-comment line is the variant URL — replace it
      } else if (skipNext && !masterLines[i].startsWith('#')) {
        localMasterLines.push(localVariantName); // replace with local v0.m3u8
        skipNext = false;
      } else {
        if (!masterLines[i].startsWith('#EXT-X-STREAM-INF')) {
          // Only keep the first variant (the one we downloaded)
          if (!localMasterLines.includes(localVariantName)) {
            localMasterLines.push(masterLines[i]);
          }
        }
      }
    }
    fs.writeFileSync(path.join(hlsDir, 'master.m3u8'), localMasterLines.join('\n'), 'utf8');

    // 9. Save metadata
    const totalSize = filesToDownload.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(hlsDir, f.localName)).size; } catch { return sum; }
    }, 0);
    const expiresAt = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    meta[metaKey] = {
      lessonId, title, type: 'hls', userId, courseTitle, moduleTitle,
      hlsDirName, expiresAt, downloadedAt: Date.now(),
      fileSize: totalSize, segmentCount: filesToDownload.length,
      mimeType: 'application/vnd.apple.mpegurl',
    };
    writeMeta(meta);
    return { success: true, message: 'Downloaded successfully.' };
  } catch (err) {
    // Clean up partial download
    try {
      const hlsDir = path.join(DOWNLOADS_DIR, userId + '_' + lessonId + '_hls');
      if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true, force: true });
    } catch {}
    return { success: false, message: err.message || 'HLS download failed.' };
  }
});

// Download and encrypt a file
ipcMain.handle('download-content', async (event, { url, lessonId, title, type, userId, courseTitle, moduleTitle }) => {
  try {
    if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    const meta = readMeta();
    const metaKey = userId + '_' + lessonId + '_' + type;
    if (meta[metaKey]) {
      // Only treat as "already downloaded" if the actual encrypted file exists
      // and is non-empty. Otherwise self-heal by re-downloading (fixes cases
      // where a prior attempt left a stale/incomplete metadata entry).
      try {
        const existingPath = path.join(DOWNLOADS_DIR, meta[metaKey].fileName);
        if (fs.existsSync(existingPath) && fs.statSync(existingPath).size > 16) {
          return { success: true, message: 'Already downloaded.' };
        }
      } catch {}
      // Stale entry — remove it and continue to re-download.
      delete meta[metaKey];
    }
    const buffer = await fetchBuffer(url);
    const fileSize = buffer.length; // real (unencrypted) byte size
    const encrypted = encryptBuffer(buffer, userId);
    const fileName = userId + '_' + lessonId + '_' + type + '.ckd';
    const filePath = path.join(DOWNLOADS_DIR, fileName);
    fs.writeFileSync(filePath, encrypted);
    const expiresAt = Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    meta[metaKey] = {
      lessonId, title, type, userId, courseTitle, moduleTitle,
      fileName, expiresAt, downloadedAt: Date.now(), fileSize,
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
        // Clean up file or HLS directory
        if (item.hlsDirName) {
          const hlsDir = path.join(DOWNLOADS_DIR, item.hlsDirName);
          if (fs.existsSync(hlsDir)) try { fs.rmSync(hlsDir, { recursive: true, force: true }); } catch {}
        } else if (item.fileName) {
          const filePath = path.join(DOWNLOADS_DIR, item.fileName);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        delete meta[key];
        changed = true;
        continue;
      }
      // Backfill size for older downloads that predate fileSize tracking:
      // use the encrypted file's on-disk size minus the 16-byte IV.
      let fileSize = item.fileSize;
      if (typeof fileSize !== 'number' || fileSize <= 0) {
        try {
          const fp = path.join(DOWNLOADS_DIR, item.fileName);
          if (fs.existsSync(fp)) fileSize = Math.max(0, fs.statSync(fp).size - 16);
        } catch {}
      }
      valid.push({ ...item, fileSize, daysLeft: Math.ceil((item.expiresAt - now) / (24 * 60 * 60 * 1000)) });
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

    // ── HLS offline playback ─────────────────────────────────────────────
    if (type === 'hls') {
      const item = meta[userId + '_' + lessonId + '_hls'];
      if (!item) return { success: false, message: 'Not found.' };
      if (Date.now() > item.expiresAt) return { success: false, message: 'Expired. Please re-download.' };
      const hlsDir = path.join(DOWNLOADS_DIR, item.hlsDirName);
      if (!fs.existsSync(path.join(hlsDir, 'master.m3u8'))) {
        return { success: false, message: 'Download incomplete. Please re-download.' };
      }
      pendingHlsDir = hlsDir;
      const port = await startContentServer();
      // Serve master.m3u8 via /hls/master.m3u8 — hls.js fetches segments
      // from the same base path (/hls/<filename>) handled by the path-based server.
      return { success: true, serveUrl: `http://127.0.0.1:${port}/hls/master.m3u8`, type: 'hls' };
    }

    // ── Legacy single-file (PDF / old MP4) ───────────────────────────────
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
    const key = userId + '_' + lessonId + '_' + (type || 'hls');
    const item = meta[key];
    if (!item) return { success: false };
    if (item.type === 'hls' || item.hlsDirName) {
      // HLS: delete the whole directory
      const hlsDir = path.join(DOWNLOADS_DIR, item.hlsDirName);
      if (fs.existsSync(hlsDir)) fs.rmSync(hlsDir, { recursive: true, force: true });
    } else {
      // Legacy single file
      const filePath = path.join(DOWNLOADS_DIR, item.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    delete meta[key];
    writeMeta(meta);
    return { success: true };
  } catch {
    return { success: false };
  }
});
