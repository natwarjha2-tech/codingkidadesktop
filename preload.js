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
  // Live Class screen-share (ISOLATED — live feature only)
  getLiveScreenSources: () => ipcRenderer.invoke('live-screen-sources'),
  setLiveScreenSource: (sourceId) => ipcRenderer.invoke('live-set-screen-source', sourceId),
  // Live Class PiP mini-window (ISOLATED — live feature only). Step 1 = plumbing
  // only (open/close an always-on-top window). Video + controls come later.
  openLivePip: (opts) => ipcRenderer.invoke('live-pip:open', opts || {}),
  closeLivePip: (opts) => ipcRenderer.invoke('live-pip:close', opts || {}),
  // Tell main whether a live class is active, so main can auto-open the mini
  // window on window blur/minimize (Case 3 — alt-tab) without a user gesture.
  setLivePipArmed: (armed) => ipcRenderer.invoke('live-pip:armed', !!armed),
  // Handshake: the mini-window announces it has loaded + is ready to receive
  // video/state; the main window listens and starts the WebRTC send + state push.
  livePipReady: () => ipcRenderer.send('live-pip:ready'),
  onLivePipReady: (cb) => ipcRenderer.on('live-pip:ready', () => cb()),
  // Step 2 — IPC bridge between the mini-window and the main window:
  //   livePipSendCommand : mini  → main  (mic/cam/leave button pressed)
  //   livePipSendState   : main  → mini  (title/count/mic/cam/rec status)
  //   onLivePipCommand   : main window listens for commands from the mini-window
  //   onLivePipState     : mini-window listens for state from the main window
  livePipSendCommand: (payload) => ipcRenderer.send('live-pip:command', payload || {}),
  livePipSendState: (payload) => ipcRenderer.send('live-pip:state', payload || {}),
  onLivePipCommand: (cb) => ipcRenderer.on('live-pip:command', (e, data) => cb(data)),
  onLivePipState: (cb) => ipcRenderer.on('live-pip:state', (e, data) => cb(data)),
  // Step 3 — WebRTC loopback signaling (main window = sender, mini = receiver).
  // Pure in-process relay; no external network. `removeLivePipListeners` lets a
  // window tear down its listeners cleanly between opens.
  livePipSendOffer: (sdp) => ipcRenderer.send('live-pip:webrtc-offer', sdp),
  livePipSendAnswer: (sdp) => ipcRenderer.send('live-pip:webrtc-answer', sdp),
  livePipSendIce: (payload) => ipcRenderer.send('live-pip:webrtc-ice', payload || {}),
  onLivePipOffer: (cb) => ipcRenderer.on('live-pip:webrtc-offer', (e, data) => cb(data)),
  onLivePipAnswer: (cb) => ipcRenderer.on('live-pip:webrtc-answer', (e, data) => cb(data)),
  onLivePipIce: (cb) => ipcRenderer.on('live-pip:webrtc-ice', (e, data) => cb(data)),
  removeLivePipListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
