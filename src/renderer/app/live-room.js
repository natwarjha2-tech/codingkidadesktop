/**
 * CodingKida Desktop — Live Class Room (ISOLATED feature)
 *
 * B2a: connects to the Chime meeting with AUDIO (mic + speaker) and provides
 * mic mute/unmute + Leave. Video tiles, screen-share, record and chat are added
 * in later sub-phases (B2b/B3/B4/B5). The classroom lives entirely in this file
 * + the #page-live-room block + live-room CSS, so nothing else is affected.
 *
 * Uses the vendored Chime SDK (window.ChimeSDK from lib/chime-sdk.min.js) and
 * the join payload returned by POST /api/live/classes/:id/join
 * (= { meeting, attendee }). Leave calls POST /api/live/classes/:id/leave.
 */

var _lrSession = null;        // DefaultMeetingSession
var _lrAV = null;             // audioVideo facade
var _lrClassId = null;        // current class id
var _lrMuted = false;         // local mic state
var _lrCamOn = false;         // local camera state (OFF by default)
var _lrSharing = false;       // local screen-share state (teacher only)
var _lrShareStream = null;    // the MediaStream being shared (to stop its tracks)
var _lrLocalTileId = null;    // our own video tile id (to label it "You")
var _lrLeaving = false;       // guard against double-leave
var _lrHostUserId = null;     // host (teacher) user id — to tag the teacher tile
var _lrIsHost = false;        // is the current user the host/teacher?
var _lrRecording = false;     // local recording state (teacher)
var _lrRecBusy = false;       // guard against double start/stop clicks
var _LR_REC_TOPIC = 'ck-live-rec'; // Chime data-message topic for rec status
var _lrMicLocked = false;     // host has disabled this user's audio (Phase 7)
var _lrCamLocked = false;     // host has disabled this user's video (Phase 7)
var _lrConnected = false;     // Chime session fully connected? (gates PiP — Phase 8)
var _lrStartedAtMs = 0;       // class start time (ms epoch) for the elapsed timer
var _lrTimerInterval = null;  // setInterval handle for the elapsed timer

function _lrToken() {
  return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
}

function _lrSetStatus(text, kind) {
  var el = document.getElementById('lr-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'lr-status' + (kind ? ' ' + kind : '');
}

// ── Elapsed timer (how long the class has been running) ──────────────────────

// Format elapsed ms as mm:ss, or h:mm:ss past an hour.
function _lrFormatElapsed(ms) {
  var total = Math.max(0, Math.floor(ms / 1000));
  var h = Math.floor(total / 3600);
  var m = Math.floor((total % 3600) / 60);
  var s = total % 60;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return h > 0 ? (h + ':' + pad(m) + ':' + pad(s)) : (pad(m) + ':' + pad(s));
}

function _lrTimerTick() {
  var txt = document.getElementById('lr-timer-text');
  if (txt && _lrStartedAtMs) txt.textContent = _lrFormatElapsed(Date.now() - _lrStartedAtMs);
}

// Start (or restart) the elapsed timer + show it. Idempotent.
function _lrStartTimer() {
  var box = document.getElementById('lr-timer');
  if (box) box.style.display = 'inline-flex';
  _lrTimerTick();
  if (_lrTimerInterval) clearInterval(_lrTimerInterval);
  _lrTimerInterval = setInterval(_lrTimerTick, 1000);
}

// Stop + hide the elapsed timer.
function _lrStopTimer() {
  if (_lrTimerInterval) { clearInterval(_lrTimerInterval); _lrTimerInterval = null; }
  var box = document.getElementById('lr-timer');
  if (box) box.style.display = 'none';
}

/**
 * Entry point — called by live.js after a successful join. `joinData` is the
 * backend response: { success, liveClass, meeting, attendee }.
 */
async function openLiveRoom(classId, joinData) {
  if (!classId || !joinData || !joinData.meeting || !joinData.attendee) {
    alert('⚠️ Could not open the live room (missing meeting info).');
    return;
  }
  if (!window.ChimeSDK) {
    alert('⚠️ Live class components failed to load. Please restart the app.');
    return;
  }

  _lrClassId = classId;
  _lrMuted = false;
  _lrCamOn = false;
  _lrSharing = false;
  _lrShareStream = null;
  _lrLocalTileId = null;
  _lrHostUserId = (joinData.liveClass && joinData.liveClass.hostUserId) || null;
  _lrIsHost = _lrHostUserId && _lrCurrentUserId() === _lrHostUserId;
  _lrRecording = false;
  _lrRecBusy = false;
  _lrShowRecIndicator(false); // hidden until a recording actually starts

  // Elapsed timer source: the class's actual start time (same for everyone).
  // Parsed from the join payload; falls back to "now" if it's missing (e.g. an
  // older class row without startedAt).
  var _startedAtIso = joinData.liveClass && joinData.liveClass.startedAt;
  var _startedMs = _startedAtIso ? Date.parse(_startedAtIso) : NaN;
  _lrStartedAtMs = isNaN(_startedMs) ? Date.now() : _startedMs;

  // Fresh grid each open (remove any stale tiles, keep the audio note).
  _lrResetGrid();

  // Show the room page.
  if (typeof navigate === 'function') navigate('live-room');
  var titleEl = document.getElementById('lr-title');
  if (titleEl && joinData.liveClass && joinData.liveClass.title) {
    titleEl.textContent = joinData.liveClass.title;
  }
  _lrSetStatus('Connecting…');
  _lrWireControls();

  try {
    await _lrConnect(joinData.meeting, joinData.attendee);
    // NOTE: do NOT mark "● Live" here. `audioVideo.start()` only *begins* the
    // async WebRTC/WebSocket connection — success/failure arrives later via the
    // audioVideoDidStart / audioVideoDidStop observer (wired in _lrConnect).
    // Start in-room chat + reactions once the session is live (B5).
    if (typeof lrcStart === 'function') lrcStart();
    // Start the participants panel (Phase 6): real-time presence + roster.
    if (typeof lrpStart === 'function') lrpStart();
    // Wire the native PiP mini-window command bridge (Phase 8 / Step 2). Safe
    // no-op when the bridge isn't present. Opening the window is a later step.
    if (typeof lrPipWireCommands === 'function') lrPipWireCommands();
  } catch (e) {
    // Surface the REAL reason in the devtools console so connection failures
    // are diagnosable instead of being swallowed.
    console.error('[live-room] connect failed:', e);
    _lrSetStatus('Connection failed', 'error');
    alert('⚠️ Could not connect to the live class. Please try again.\n\n' +
      (e && e.message ? e.message : e));
    // Clean up a partial session so a retry starts fresh.
    await _lrTeardown();
  }
}

// Build the Chime session and start audio in/out.
async function _lrConnect(meeting, attendee) {
  var S = window.ChimeSDK;
  var logger = new S.ConsoleLogger('CK-Live', S.LogLevel ? S.LogLevel.WARN : 30);
  var deviceController = new S.DefaultDeviceController(logger);
  var configuration = new S.MeetingSessionConfiguration(meeting, attendee);

  _lrSession = new S.DefaultMeetingSession(configuration, logger, deviceController);
  _lrAV = _lrSession.audioVideo;

  // Pick a microphone (first available) + default speaker, then start.
  // IMPORTANT: a failing/busy mic must NOT abort the whole connection — a user
  // can still join and listen without a working input, and can fix the mic
  // later. So mic selection is best-effort and never throws out of _lrConnect.
  try {
    var mics = await _lrAV.listAudioInputDevices();
    if (mics && mics.length > 0 && mics[0].deviceId) {
      await _lrAV.startAudioInput(mics[0].deviceId);
    } else {
      console.warn('[live-room] no usable microphone found; joining listen-only');
    }
  } catch (micErr) {
    console.warn('[live-room] startAudioInput failed; joining listen-only:', micErr);
  }

  // Bind the audio output to a hidden <audio> element so remote audio plays.
  var audioEl = _lrEnsureAudioEl();
  try { await _lrAV.bindAudioElement(audioEl); } catch (e) {}

  // Observe connection lifecycle + video tiles. The connection state is what
  // actually tells us the meeting is live — `start()` returns immediately but
  // the real WebRTC/WebSocket connect happens asynchronously afterwards.
  _lrAV.addObserver({
    // Meeting session fully connected (audio/video channels up).
    audioVideoDidStart: function () {
      _lrConnected = true;
      _lrSetStatus('● Live', 'connected');
      _lrStartTimer(); // begin the elapsed-time counter
      if (typeof lrPipSyncState === 'function') lrPipSyncState();
      // Arm blur auto-PiP (Case 3) now that the class is actually live.
      if (typeof lrPipSetArmed === 'function') lrPipSetArmed(true);
    },
    // Session stopped. If it stopped with a non-OK status, this is the real
    // connection failure (e.g. 403/network) — reflect it instead of a stale
    // "connected" state and log the Chime status code for diagnosis.
    audioVideoDidStop: function (sessionStatus) {
      var code = -1;
      try { code = sessionStatus.statusCode(); } catch (e) {}
      console.warn('[live-room] audioVideoDidStop, Chime statusCode =', code);
      _lrConnected = false;
      // 1 === MeetingEnded (normal), 0 === OK. Anything else = failure while
      // we are not deliberately leaving.
      if (!_lrLeaving && code !== 1 && code !== 0) {
        _lrSetStatus('Connection failed', 'error');
      }
    },
    // Transient reconnects — keep the user informed instead of silent freeze.
    connectionDidBecomePoor: function () {
      _lrSetStatus('● Live (weak connection)', 'connected');
    },
    videoTileDidUpdate: function (tileState) {
      if (!tileState || !tileState.boundAttendeeId) return;
      _lrAddOrUpdateTile(tileState);
    },
    videoTileWasRemoved: function (tileId) {
      _lrRemoveTile(tileId);
    },
  });

  // Recording status broadcast (host → everyone) so all participants see the
  // "● Recording" indicator in real time (transparency). Non-host clients just
  // reflect the state they receive; they never start/stop.
  try {
    _lrAV.realtimeSubscribeToReceiveDataMessage(_LR_REC_TOPIC, function (dm) {
      try {
        var p = JSON.parse(dm.text());
        _lrShowRecIndicator(!!p.recording);
      } catch (e) {}
    });
  } catch (e) {}

  _lrAV.start();
}

// Hidden <audio> sink for remote meeting audio.
// IMPORTANT (Phase 8 PiP): the sink lives INSIDE .lr-shell so that when the
// room is moved into the Picture-in-Picture window, the audio element moves
// WITH it and remote audio keeps playing there. (Previously it was appended to
// document.body and got left behind on pop-out, cutting audio.) Chime binds to
// this exact node, so moving the node keeps the binding intact.
function _lrEnsureAudioEl() {
  var el = document.getElementById('lr-audio-sink');
  if (!el) {
    el = document.createElement('audio');
    el.id = 'lr-audio-sink';
    el.style.display = 'none';
    el.autoplay = true;
    var shell = document.querySelector('#page-live-room .lr-shell');
    (shell || document.body).appendChild(el);
  }
  return el;
}

// Wire mic + camera + share + leave buttons (idempotent — safe each open).
function _lrWireControls() {
  var micBtn = document.getElementById('lr-mic-btn');
  var camBtn = document.getElementById('lr-cam-btn');
  var shareBtn = document.getElementById('lr-share-btn');
  var leaveBtn = document.getElementById('lr-leave-btn');
  if (micBtn) micBtn.onclick = toggleLiveMic;
  if (camBtn) camBtn.onclick = toggleLiveCamera;
  if (leaveBtn) leaveBtn.onclick = leaveLiveRoom;

  // Screen-share is TEACHER-ONLY: show the button only for the host.
  if (shareBtn) {
    shareBtn.style.display = _lrIsHost ? '' : 'none';
    shareBtn.onclick = toggleScreenShare;
  }
  // Record is TEACHER-ONLY: show the button only for the host.
  var recBtn = document.getElementById('lr-rec-btn');
  if (recBtn) {
    recBtn.style.display = _lrIsHost ? '' : 'none';
    recBtn.onclick = toggleRecording;
  }
  // Picker close button.
  var pickerClose = document.getElementById('lr-picker-close');
  if (pickerClose) pickerClose.onclick = _lrClosePicker;
}

// Resolve the current logged-in user's id from the stored user object.
function _lrCurrentUserId() {
  try {
    var raw = localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user');
    if (!raw) return null;
    var u = JSON.parse(raw);
    return (u && (u.id || u.userId)) || null;
  } catch (e) {
    return null;
  }
}

// Mute / unmute the local microphone.
function toggleLiveMic() {
  if (!_lrAV) return;
  // Host moderation (Phase 7): if the host disabled this user's audio, they
  // cannot unmute themselves until the host allows it again.
  if (_lrMicLocked && _lrMuted) {
    alert('⚠️ The host has muted you. You can speak once the host unmutes you.');
    return;
  }
  var micBtn = document.getElementById('lr-mic-btn');
  if (_lrMuted) {
    _lrAV.realtimeUnmuteLocalAudio();
    _lrMuted = false;
    if (micBtn) { micBtn.classList.remove('muted'); micBtn.innerHTML = '<i class="fas fa-microphone"></i>'; }
  } else {
    _lrAV.realtimeMuteLocalAudio();
    _lrMuted = true;
    if (micBtn) { micBtn.classList.add('muted'); micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>'; }
  }
  // Keep the PiP mini-window's mic button in sync (Step 2). No-op if closed.
  if (typeof lrPipSyncState === 'function') lrPipSyncState();
}

// Turn the local camera on/off. OFF by default (privacy-friendly); the user
// explicitly enables it. Starting video publishes a local tile that other
// participants then see via their own videoTileDidUpdate.
async function toggleLiveCamera() {
  if (!_lrAV) return;
  // Host moderation (Phase 7): if the host disabled this user's video, they
  // cannot turn their camera on until the host allows it again.
  if (_lrCamLocked && !_lrCamOn) {
    alert('⚠️ The host has turned off your camera for this class.');
    return;
  }
  var camBtn = document.getElementById('lr-cam-btn');

  if (_lrCamOn) {
    // Turn OFF.
    try { _lrAV.stopLocalVideoTile(); } catch (e) {}
    try { await _lrAV.stopVideoInput(); } catch (e) {}
    _lrCamOn = false;
    if (camBtn) { camBtn.classList.remove('cam-on'); camBtn.classList.add('cam-off'); camBtn.innerHTML = '<i class="fas fa-video-slash"></i>'; }
    if (typeof lrPipSyncState === 'function') lrPipSyncState();
    return;
  }

  // Turn ON — pick the first camera, start input + local tile.
  try {
    var cams = await _lrAV.listVideoInputDevices();
    if (!cams || cams.length === 0) {
      alert('⚠️ No camera found on this device.');
      return;
    }
    await _lrAV.startVideoInput(cams[0].deviceId);
    _lrAV.startLocalVideoTile();
    _lrCamOn = true;
    if (camBtn) { camBtn.classList.remove('cam-off'); camBtn.classList.add('cam-on'); camBtn.innerHTML = '<i class="fas fa-video"></i>'; }
    if (typeof lrPipSyncState === 'function') lrPipSyncState();
  } catch (e) {
    alert('⚠️ Could not start the camera. Please check permissions.');
  }
}

// ── Host-moderation enforcement helpers (Phase 7) ────────────────────────────
// Called by live-room-participants.js when the host disables/enables THIS
// user's audio/video. Kept here because they touch the Chime A/V facade + the
// local mic/cam buttons that this file owns.

// Force the local mic to muted (used when the host mutes this user).
function _lrForceMuteLocalAudio() {
  if (!_lrAV) return;
  try { _lrAV.realtimeMuteLocalAudio(); } catch (e) {}
  _lrMuted = true;
  var micBtn = document.getElementById('lr-mic-btn');
  if (micBtn) { micBtn.classList.add('muted'); micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>'; }
}

// Lock/unlock the mic button (host-disabled audio can't be self-unmuted).
function _lrSetMicLocked(locked) {
  _lrMicLocked = !!locked;
  var micBtn = document.getElementById('lr-mic-btn');
  if (micBtn) {
    if (locked) micBtn.classList.add('host-locked'); else micBtn.classList.remove('host-locked');
    micBtn.title = locked ? 'Muted by host' : 'Mute / Unmute';
  }
}

// Force the local camera off (used when the host disables this user's video).
async function _lrForceStopLocalVideo() {
  if (!_lrAV) return;
  if (_lrCamOn) {
    try { _lrAV.stopLocalVideoTile(); } catch (e) {}
    try { await _lrAV.stopVideoInput(); } catch (e) {}
    _lrCamOn = false;
    var camBtn = document.getElementById('lr-cam-btn');
    if (camBtn) { camBtn.classList.remove('cam-on'); camBtn.classList.add('cam-off'); camBtn.innerHTML = '<i class="fas fa-video-slash"></i>'; }
  }
}

// Lock/unlock the camera button (host-disabled video can't be self-enabled).
function _lrSetCamLocked(locked) {
  _lrCamLocked = !!locked;
  var camBtn = document.getElementById('lr-cam-btn');
  if (camBtn) {
    if (locked) camBtn.classList.add('host-locked'); else camBtn.classList.remove('host-locked');
    camBtn.title = locked ? 'Camera disabled by host' : 'Turn camera on / off';
  }
}

// ── Screen share (teacher only) ─────────────────────────────────────────────

// Toggle screen share. ON → open the source picker; OFF → stop sharing.
async function toggleScreenShare() {
  if (!_lrAV || !_lrIsHost) return;
  if (_lrSharing) {
    await _lrStopShare();
  } else {
    await _lrOpenPicker();
  }
}

// Open the picker populated with the OS's screens/windows (via main process).
async function _lrOpenPicker() {
  var grid = document.getElementById('lr-picker-grid');
  var picker = document.getElementById('lr-picker');
  if (!grid || !picker || !window.electron || !window.electron.getLiveScreenSources) {
    alert('⚠️ Screen sharing is unavailable.');
    return;
  }
  grid.innerHTML = '<div style="color:var(--muted);padding:20px;">Loading screens…</div>';
  picker.style.display = 'flex';

  try {
    var sources = await window.electron.getLiveScreenSources();
    if (!sources || sources.length === 0) {
      grid.innerHTML = '<div style="color:var(--muted);padding:20px;">No screens found.</div>';
      return;
    }
    grid.innerHTML = '';
    sources.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'lr-src';
      item.innerHTML =
        '<img src="' + (s.thumbnail || '') + '" alt=""/>' +
        '<span>' + sanitize(s.name || 'Screen') + '</span>';
      item.onclick = function () { _lrPickSource(s.id); };
      grid.appendChild(item);
    });
  } catch (e) {
    grid.innerHTML = '<div style="color:var(--muted);padding:20px;">Could not list screens.</div>';
  }
}

function _lrClosePicker() {
  var picker = document.getElementById('lr-picker');
  if (picker) picker.style.display = 'none';
}

// User chose a source → tell main which one, grab the stream, start sharing.
async function _lrPickSource(sourceId) {
  _lrClosePicker();
  try {
    if (window.electron && window.electron.setLiveScreenSource) {
      await window.electron.setLiveScreenSource(sourceId);
    }
    // getDisplayMedia triggers the main-process display-media handler, which
    // returns the source we just set. (Constraints kept simple + reliable.)
    var stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    _lrShareStream = stream;

    // Hand the screen track to Chime as the content share.
    await _lrAV.startContentShare(stream);
    _lrSharing = true;

    var shareBtn = document.getElementById('lr-share-btn');
    if (shareBtn) { shareBtn.classList.add('sharing'); shareBtn.innerHTML = '<i class="fas fa-stop"></i> Stop'; }

    // Case 1 (Step 4): the host just started sharing → pop the class into the
    // floating native mini-window so they can watch the room while presenting
    // elsewhere (Teams-style). If PiP is already open, refresh so it switches to
    // the shared screen. No-op if PiP isn't available.
    if (typeof lrPipOpen === 'function') { try { lrPipOpen(); } catch (e) {} }
    if (typeof lrPipRefreshVideo === 'function') { try { lrPipRefreshVideo(); } catch (e) {} }

    // If the user stops sharing via the OS indicator, clean up too.
    var track = stream.getVideoTracks()[0];
    if (track) track.addEventListener('ended', function () { _lrStopShare(); });
  } catch (e) {
    // User cancelled or an error occurred — nothing to clean beyond the stream.
    if (_lrShareStream) { try { _lrShareStream.getTracks().forEach(function (t) { t.stop(); }); } catch (x) {} _lrShareStream = null; }
    _lrSharing = false;
  }
}

// Stop sharing: stop Chime content share + release the OS stream.
async function _lrStopShare() {
  try { _lrAV && _lrAV.stopContentShare(); } catch (e) {}
  if (_lrShareStream) {
    try { _lrShareStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    _lrShareStream = null;
  }
  _lrSharing = false;
  var shareBtn = document.getElementById('lr-share-btn');
  if (shareBtn) { shareBtn.classList.remove('sharing'); shareBtn.innerHTML = '<i class="fas fa-desktop"></i> Share'; }

  // Host stopped sharing → re-pick the PiP primary video (no-op if PiP closed).
  if (typeof lrPipRefreshVideo === 'function') lrPipRefreshVideo();
}

// ── Recording (teacher only) ────────────────────────────────────────────────

// Toggle server-side recording (Chime media capture pipeline → S3). Only the
// host sees/uses this. The recording status is broadcast to everyone so all
// participants see the "● Recording" indicator (transparency best practice).
async function toggleRecording() {
  if (!_lrIsHost || !_lrClassId || _lrRecBusy) return;
  _lrRecBusy = true;

  var recBtn = document.getElementById('lr-rec-btn');
  var original = recBtn ? recBtn.innerHTML : '';
  if (recBtn) { recBtn.disabled = true; recBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> …'; }

  var action = _lrRecording ? 'stop' : 'start';
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/recording/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
    });

    if (res.status === 503) {
      alert('⚠️ Recording is not available yet (server not configured). The class continues normally.');
      return;
    }
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success) {
      alert('⚠️ ' + ((data && data.message) || ('Could not ' + action + ' recording.')));
      return;
    }

    _lrRecording = (action === 'start');
    _lrSetRecButton(_lrRecording);
    _lrShowRecIndicator(_lrRecording);
    _lrBroadcastRec(_lrRecording);
  } catch (e) {
    alert('⚠️ Something went wrong with recording. Please try again.');
  } finally {
    _lrRecBusy = false;
    if (recBtn) {
      recBtn.disabled = false;
      if (recBtn.innerHTML.indexOf('spinner') !== -1) recBtn.innerHTML = original;
    }
    _lrSetRecButton(_lrRecording);
  }
}

// Update the host's Record button to idle / recording state.
function _lrSetRecButton(on) {
  var recBtn = document.getElementById('lr-rec-btn');
  if (!recBtn) return;
  if (on) {
    recBtn.classList.add('recording');
    recBtn.innerHTML = '<i class="fas fa-circle"></i> Stop';
  } else {
    recBtn.classList.remove('recording');
    recBtn.innerHTML = '<i class="fas fa-circle"></i> Record';
  }
}

// Show/hide the "● Recording" indicator (shown to EVERYONE in the room).
function _lrShowRecIndicator(on) {
  var ind = document.getElementById('lr-rec-indicator');
  if (ind) ind.style.display = on ? 'inline-flex' : 'none';
}

// Broadcast recording status to all participants (real-time, via Chime data).
function _lrBroadcastRec(on) {
  try {
    if (_lrAV) _lrAV.realtimeSendDataMessage(_LR_REC_TOPIC, JSON.stringify({ recording: !!on }));
  } catch (e) {}
}

// ── Video tile grid management ──────────────────────────────────────────────

// Reset the grid to just the audio note (used on each room open).
function _lrResetGrid() {
  var grid = document.getElementById('lr-grid');
  if (!grid) return;
  // Remove every tile element but keep the audio note.
  var tiles = grid.querySelectorAll('.lr-tile');
  tiles.forEach(function (t) { t.remove(); });
  var note = document.getElementById('lr-audio-note');
  if (note) note.style.display = '';
}

// Add or update a tile for a given Chime tileState.
function _lrAddOrUpdateTile(tileState) {
  var grid = document.getElementById('lr-grid');
  if (!grid) return;

  var tileId = tileState.tileId;
  var isLocal = !!tileState.localTile;
  if (isLocal) _lrLocalTileId = tileId;

  // Hide the audio-only note once any video appears.
  var note = document.getElementById('lr-audio-note');
  if (note) note.style.display = 'none';

  var tileElId = 'lr-tile-' + tileId;
  var tileEl = document.getElementById(tileElId);
  if (!tileEl) {
    tileEl = document.createElement('div');
    tileEl.className = 'lr-tile';
    tileEl.id = tileElId;

    var video = document.createElement('video');
    video.id = 'lr-video-' + tileId;
    video.autoplay = true;
    video.playsInline = true;
    if (isLocal) video.muted = true; // never echo our own audio

    var label = document.createElement('span');
    label.className = 'lr-tile-name';

    tileEl.appendChild(video);
    tileEl.appendChild(label);
    grid.appendChild(tileEl);
  }

  // Tag + label the tile. Content (screen-share) tiles get a prominent,
  // full-width layout; camera tiles get teacher highlight + "You" for local.
  var isContent = !!tileState.isContent;
  var isHost = _lrHostUserId && tileState.boundExternalUserId &&
    tileState.boundExternalUserId.indexOf(_lrHostUserId) === 0;
  var labelEl = tileEl.querySelector('.lr-tile-name');
  if (isContent) {
    tileEl.classList.add('content');
    if (labelEl) labelEl.textContent = (isHost ? 'Teacher' : 'Presenter') + "'s screen";
  } else {
    if (isHost) tileEl.classList.add('teacher');
    if (labelEl) labelEl.textContent = isLocal ? 'You' : (isHost ? 'Teacher' : 'Participant');
  }

  // Bind the Chime tile to the <video> element so it renders.
  var videoEl = document.getElementById('lr-video-' + tileId);
  if (videoEl && _lrAV) {
    try { _lrAV.bindVideoElement(tileId, videoEl); } catch (e) {}
  }

  // If the PiP mini-window is open, re-pick the primary video (a new/changed
  // tile — e.g. screen-share started — may now be the one to mirror). No-op if
  // PiP is closed. Guarded so it never affects the normal in-room grid.
  if (typeof lrPipRefreshVideo === 'function') lrPipRefreshVideo();
}

// Remove a tile when its video stops.
function _lrRemoveTile(tileId) {
  if (tileId === _lrLocalTileId) _lrLocalTileId = null;
  var tileEl = document.getElementById('lr-tile-' + tileId);
  if (tileEl) tileEl.remove();

  // If no tiles remain, show the audio note again.
  var grid = document.getElementById('lr-grid');
  if (grid && grid.querySelectorAll('.lr-tile').length === 0) {
    var note = document.getElementById('lr-audio-note');
    if (note) note.style.display = '';
  }

  // Re-pick the PiP primary video if the mini-window is open (the removed tile
  // may have been the one being mirrored). No-op if PiP is closed.
  if (typeof lrPipRefreshVideo === 'function') lrPipRefreshVideo();
}

// Leave the room: tears down Chime, tells the backend, returns to the list.
async function leaveLiveRoom() {
  if (_lrLeaving) return;
  _lrLeaving = true;

  var classId = _lrClassId;
  await _lrTeardown();

  // Best-effort backend leave (attendance). Never blocks navigation.
  try {
    if (classId) {
      await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(classId) + '/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      });
    }
  } catch (e) {}

  _lrLeaving = false;
  if (typeof navigate === 'function') navigate('live');
  // Refresh the list so statuses are current.
  if (typeof renderLiveClasses === 'function') renderLiveClasses();
}

// Stop + release the Chime session (safe to call multiple times).
async function _lrTeardown() {
  // Disarm blur auto-PiP + close the mini-window first so it never lingers
  // after a class ends.
  if (typeof lrPipSetArmed === 'function') { try { lrPipSetArmed(false); } catch (e) {} }
  if (typeof lrPipClose === 'function') { try { lrPipClose(); } catch (e) {} }

  // Stop in-room chat first (unsubscribe data messages) while _lrAV still exists.
  if (typeof lrcStop === 'function') { try { lrcStop(); } catch (e) {} }
  // Stop the participants panel (unsubscribe presence) while _lrAV still exists.
  if (typeof lrpStop === 'function') { try { lrpStop(); } catch (e) {} }

  // If the host leaves while recording, stop it (best-effort) + notify others.
  if (_lrIsHost && _lrRecording && _lrClassId) {
    try {
      _lrBroadcastRec(false);
      await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/recording/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      });
    } catch (e) {}
  }

  try {
    if (_lrAV) {
      if (_lrSharing) {
        try { _lrAV.stopContentShare(); } catch (e) {}
      }
      if (_lrCamOn) {
        try { _lrAV.stopLocalVideoTile(); } catch (e) {}
        try { await _lrAV.stopVideoInput(); } catch (e) {}
      }
      try { await _lrAV.stopAudioInput(); } catch (e) {}
      try { _lrAV.stop(); } catch (e) {}
    }
  } catch (e) {}

  // Release any screen-share stream still held.
  if (_lrShareStream) {
    try { _lrShareStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    _lrShareStream = null;
  }

  // Clear the grid + close picker + reset control buttons to defaults.
  // Also drop the "alive-but-off-screen" state so the live-room page never
  // lingers hidden after a class ends (navigation can hide it normally again).
  var _liveRoomPage = document.getElementById('page-live-room');
  if (_liveRoomPage) _liveRoomPage.classList.remove('lr-page-alive');
  _lrResetGrid();
  _lrClosePicker();
  var camBtn = document.getElementById('lr-cam-btn');
  if (camBtn) { camBtn.classList.remove('cam-on'); camBtn.classList.add('cam-off'); camBtn.innerHTML = '<i class="fas fa-video-slash"></i>'; }
  var shareBtn = document.getElementById('lr-share-btn');
  if (shareBtn) { shareBtn.classList.remove('sharing'); shareBtn.innerHTML = '<i class="fas fa-desktop"></i> Share'; shareBtn.style.display = 'none'; }
  var recBtn = document.getElementById('lr-rec-btn');
  if (recBtn) { recBtn.classList.remove('recording'); recBtn.innerHTML = '<i class="fas fa-circle"></i> Record'; recBtn.style.display = 'none'; }
  _lrShowRecIndicator(false);

  _lrSession = null;
  _lrAV = null;
  _lrClassId = null;
  _lrMuted = false;
  _lrCamOn = false;
  _lrSharing = false;
  _lrRecording = false;
  _lrRecBusy = false;
  _lrLocalTileId = null;
  _lrHostUserId = null;
  _lrIsHost = false;
  _lrMicLocked = false;
  _lrCamLocked = false;
  _lrConnected = false;
  _lrStopTimer();
  _lrStartedAtMs = 0;
}
