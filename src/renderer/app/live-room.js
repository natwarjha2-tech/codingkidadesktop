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
var _lrRecStartedAtMs = 0;    // recording start time (ms epoch) for the rec timer (P13)
var _lrRecTimerInterval = null; // setInterval handle for the recording timer (P13)
var _lrRightPanel = 'none';   // which right panel is open: 'none' | 'chat' | 'people'
var _lrConnState = 'idle';    // connection state machine (see _lrSetConnState)
var _lrFailTimer = null;      // grace timer: show the "failed" overlay only if a drop doesn't recover
var _LR_FAIL_GRACE_MS = 20000; // how long Chime's auto-reconnect gets before we surface the failed overlay
var _lrHeartbeatTimer = null; // host-only liveness ping interval (Phase 3)
var _LR_HEARTBEAT_MS = 30000; // how often the host pings so the server knows it's alive
var _lrMicDeviceId = null;    // selected microphone deviceId (Phase 4; null = first available)
var _lrCamDeviceId = null;    // selected camera deviceId (Phase 4; null = first available)
var _lrDeviceObserver = null; // Chime device-change observer ref (for clean removal)
var _lrDeviceCtl = null;      // Chime DefaultDeviceController ref (to remove the observer on teardown)
var _lrDeviceOutsideWired = false; // outside-click close for device dropdowns wired?
// Live media-state per user (Phase 5): { speaking, muted, cameraOn }. Single
// source of truth that feeds BOTH the video tiles and the participants roster.
var _lrMediaState = {};
var _lrVolumeSubs = {};       // attendeeId -> volume-indicator callback (to unsubscribe cleanly)
var _lrSpeakOffTimers = {};   // userId -> timeout handle (debounce "stopped speaking")
var _lrCamBusy = false;       // guard: camera toggle in flight (O15 — no double-trigger)
var _lrShareBusy = false;     // guard: screen-share toggle in flight (O15)
var _lrOpening = false;       // guard: a room open is in progress (B15 — rapid open safety)
var _lrTilesHidden = false;   // P5: hide the share-mode circular camera strip? (default: shown)

function _lrToken() {
  return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
}

function _lrSetStatus(text, kind) {
  var el = document.getElementById('lr-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'lr-status' + (kind ? ' ' + kind : '');
}

// ── Connection state machine (single source of truth) ───────────────────────
//
// The live room has exactly ONE connection state at a time. Centralising the
// state → (label + CSS class) mapping here means every part of the code that
// needs to reflect connection status does it through _lrSetConnState — no more
// scattered hardcoded "● Live" / "Connecting…" strings (zero duplication), and
// every new/reconnect transition lands on a consistent, correct label.
//
// States:
//   idle          — not connected (initial / after teardown)
//   connecting    — join started, first connect in progress
//   connected     — meeting fully live (audioVideoDidStart, fresh connect)
//   reconnecting  — Chime's built-in reconnect is retrying (transient)
//   poor          — connected but the SDK reports a weak connection
//   failed        — connection dropped unexpectedly (not a deliberate leave)
//   ended         — the class was ended (meeting closed) — Phase 2 uses this
//
// NOTE: we do NOT implement our own reconnect loop. The Chime SDK has a built-in
// ReconnectController that retries automatically; this state machine only
// REFLECTS the signals it emits (industry-correct — never fight the SDK).
var _LR_CONN_UI = {
  idle:         { label: 'Connecting…',                kind: 'connecting' },
  connecting:   { label: 'Connecting…',                kind: 'connecting' },
  connected:    { label: '● Live',                     kind: 'connected' },
  reconnecting: { label: 'Reconnecting…',              kind: 'reconnecting' },
  poor:         { label: '● Live · weak connection',   kind: 'poor' },
  failed:       { label: 'Connection lost',            kind: 'failed' },
  ended:        { label: 'Class ended',                kind: 'ended' },
};

// Transition the connection state + reflect it in the status pill. Idempotent:
// setting the same state twice is a harmless no-op repaint.
function _lrSetConnState(state) {
  if (!_LR_CONN_UI[state]) state = 'connecting';
  _lrConnState = state;
  var ui = _LR_CONN_UI[state];
  _lrSetStatus(ui.label, ui.kind);
}

// ── Non-blocking notice banner (reusable across all live-room phases) ─────────
//
// Replaces blocking alert() calls with a top-center banner inside the room.
// kind ∈ { info | success | warn | error }. info/success auto-dismiss; warn/
// error stay until dismissed (with a close button) so the user doesn't miss a
// real problem. One shared implementation — later phases (device errors, chat
// failures, class-ended) reuse this instead of re-inventing their own toasts.
function _lrNotice(message, kind) {
  if (!message) return;
  kind = kind || 'info';
  var host = document.getElementById('lr-notice');
  if (!host) {
    // Fallback: if the container isn't present for any reason, never block the
    // user — just log. (The container is in #page-live-room markup.)
    console.warn('[live-room] notice:', kind, message);
    return;
  }

  var item = document.createElement('div');
  item.className = 'lr-notice-item ' + kind;

  var text = document.createElement('span');
  text.className = 'lr-notice-text';
  text.textContent = message;
  item.appendChild(text);

  var close = document.createElement('button');
  close.className = 'lr-notice-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss');
  close.innerHTML = '<i class="fas fa-times"></i>';
  close.onclick = function () { if (item.parentNode) item.parentNode.removeChild(item); };
  item.appendChild(close);

  host.appendChild(item);

  // info/success are transient; warn/error persist until dismissed.
  if (kind === 'info' || kind === 'success') {
    setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 4000);
  }
}

// Clear every active notice (used on teardown so stale banners never carry over
// into the next room open).
function _lrClearNotices() {
  var host = document.getElementById('lr-notice');
  if (host) host.innerHTML = '';
}

// ── Room result overlay (class ended / connection failed / removed) ──────────
//
// A full-stage card shown OVER the (now-frozen) tiles when the room reaches a
// terminal state, with a clear primary action — mirroring Zoom/Teams/Meet. One
// overlay, three modes, so there is no duplicated "end screen" markup/logic:
//   ended   → the host ended the class        → "Back to Live Classes"
//   failed  → connection could not be restored → "Rejoin" / "Leave"
//   removed → the host removed this user        → "Back to Live Classes"
// All buttons reuse the EXISTING leave/join flows (leaveLiveRoom / joinLiveClass)
// — no new navigation or join logic is introduced.
var _LR_OVERLAY_UI = {
  ended: {
    icon: 'fa-circle-check', iconKind: 'ok',
    title: 'Class ended',
    message: 'The teacher has ended this class.',
    primary: { label: 'Back to Live Classes', action: 'leave' },
    secondary: null,
  },
  failed: {
    icon: 'fa-triangle-exclamation', iconKind: 'warn',
    title: 'Connection lost',
    message: "We couldn't stay connected to the class. You can try to rejoin.",
    primary: { label: 'Rejoin', action: 'rejoin' },
    secondary: { label: 'Leave', action: 'leave' },
  },
  removed: {
    icon: 'fa-user-slash', iconKind: 'warn',
    title: 'Removed from class',
    message: 'The host has removed you from this class.',
    primary: { label: 'Back to Live Classes', action: 'leave' },
    secondary: null,
  },
};

// Show the terminal-state overlay. Idempotent: re-showing the same mode just
// repaints. The buttons are wired to the shared leave/rejoin handlers.
function _lrShowOverlay(mode) {
  var host = document.getElementById('lr-overlay');
  var ui = _LR_OVERLAY_UI[mode];
  if (!host || !ui) return;

  var classId = _lrClassId; // capture before any teardown nulls it

  var btns = '';
  if (ui.secondary) {
    btns += '<button class="lr-overlay-btn secondary" data-action="' + ui.secondary.action + '">' +
      ui.secondary.label + '</button>';
  }
  btns += '<button class="lr-overlay-btn primary" data-action="' + ui.primary.action + '">' +
    ui.primary.label + '</button>';

  host.innerHTML =
    '<div class="lr-overlay-card">' +
      '<div class="lr-overlay-icon ' + ui.iconKind + '"><i class="fas ' + ui.icon + '"></i></div>' +
      '<div class="lr-overlay-title">' + ui.title + '</div>' +
      '<div class="lr-overlay-msg">' + ui.message + '</div>' +
      '<div class="lr-overlay-actions">' + btns + '</div>' +
    '</div>';
  host.style.display = 'flex';

  // Wire buttons to the EXISTING flows (no new nav/join logic).
  var buttons = host.querySelectorAll('.lr-overlay-btn');
  buttons.forEach(function (b) {
    b.onclick = function () {
      var action = b.getAttribute('data-action');
      _lrHideOverlay();
      if (action === 'rejoin') {
        // Re-join through the same path the Live list uses. Teardown runs first
        // inside leaveLiveRoom-style cleanup via joinLiveClass→openLiveRoom
        // (openLiveRoom resets state); we tear down the dead session first so
        // the retry starts clean.
        _lrTeardown().then(function () {
          if (classId && typeof joinLiveClass === 'function') joinLiveClass(classId, null);
        });
      } else {
        // 'leave' → the standard leave flow (teardown + back to the list).
        if (typeof leaveLiveRoom === 'function') leaveLiveRoom();
      }
    };
  });
}

// Hide + clear the overlay (teardown / recovery).
function _lrHideOverlay() {
  var host = document.getElementById('lr-overlay');
  if (host) { host.style.display = 'none'; host.innerHTML = ''; }
}

// Clear the "failed" grace timer (called on recovery + teardown).
function _lrClearFailTimer() {
  if (_lrFailTimer) { clearTimeout(_lrFailTimer); _lrFailTimer = null; }
}

// ── Host liveness heartbeat (Phase 3) ────────────────────────────────────────
// Only the HOST pings, and only while connected. The server stamps
// hostLastSeenAt; a stale-sweep auto-ends a live class whose host stopped
// pinging (crash/close) so there are no ghost classes / leaked meetings. Pure
// best-effort: a failed ping never affects the room. Students never ping (their
// presence is tracked via Chime).
function _lrSendHeartbeat() {
  if (!_lrIsHost || !_lrClassId) return;
  try {
    fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
    }).catch(function () {});
  } catch (e) {}
}

// Start (or restart) the host heartbeat. Idempotent. Fires once immediately so
// hostLastSeenAt is fresh the moment the class goes live.
function _lrStartHeartbeat() {
  if (!_lrIsHost) return;
  _lrStopHeartbeat();
  _lrSendHeartbeat();
  _lrHeartbeatTimer = setInterval(_lrSendHeartbeat, _LR_HEARTBEAT_MS);
  _lrWireHeartbeatWindowEvents(); // P8: throttle-proof the host liveness ping
}

// Stop the host heartbeat (teardown / leave).
function _lrStopHeartbeat() {
  if (_lrHeartbeatTimer) { clearInterval(_lrHeartbeatTimer); _lrHeartbeatTimer = null; }
  _lrUnwireHeartbeatWindowEvents();
}

// ── P8: throttle-proof host heartbeat ────────────────────────────────────────
// The periodic interval above can slip if the OS/Chromium ever slows a
// background/minimized renderer (e.g. a host who minimizes while screen-sharing
// a single window). To guarantee the server always sees the host as alive
// within the grace window, we also fire an IMMEDIATE heartbeat on the exact
// moments the renderer is most likely to be throttled or resumed: window blur /
// minimize (about to go background) and focus / visibility change (coming back).
// This never ends/leaves the class — it only refreshes hostLastSeenAt, so a
// host who minimizes keeps the class alive (the PiP takes over the view).
// Listeners are host-only, wired on heartbeat start and torn down on stop, so
// there is no leak and no duplication across rooms.
var _lrHbWindowWired = false;

function _lrHeartbeatOnWindowEvent() {
  // Guard to host + a live class only (the ping itself also no-ops otherwise).
  if (_lrIsHost && _lrClassId) _lrSendHeartbeat();
}

function _lrWireHeartbeatWindowEvents() {
  if (_lrHbWindowWired) return;
  _lrHbWindowWired = true;
  try {
    window.addEventListener('blur', _lrHeartbeatOnWindowEvent);
    window.addEventListener('focus', _lrHeartbeatOnWindowEvent);
    document.addEventListener('visibilitychange', _lrHeartbeatOnWindowEvent);
  } catch (e) {}
}

function _lrUnwireHeartbeatWindowEvents() {
  if (!_lrHbWindowWired) return;
  _lrHbWindowWired = false;
  try {
    window.removeEventListener('blur', _lrHeartbeatOnWindowEvent);
    window.removeEventListener('focus', _lrHeartbeatOnWindowEvent);
    document.removeEventListener('visibilitychange', _lrHeartbeatOnWindowEvent);
  } catch (e) {}
}

// ── Device management: mic + camera pickers + hot-plug handling (Phase 4) ─────
//
// One shared device layer for BOTH mic and camera (no duplicated per-device
// logic): a small ▾ dropdown next to each control lets the user choose an
// input, the choice is remembered (_lrMicDeviceId / _lrCamDeviceId) so a
// reconnect keeps it, and a Chime device-change observer handles hot-plug
// (unplug the current device → notify + auto-fallback / stop). Permission and
// device errors reuse the Phase 1 _lrClassifyMediaError + _lrNotice.

// Resolve which deviceId to use for a kind: the saved choice if it's still
// present, else the first available. Keeps "remember my device" working while
// never pointing at a device that was unplugged.
function _lrPickDeviceId(kind, list) {
  if (!list || list.length === 0) return null;
  var saved = (kind === 'audio') ? _lrMicDeviceId : _lrCamDeviceId;
  if (saved) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].deviceId === saved) return saved;
    }
  }
  return list[0].deviceId || null;
}

// List devices of a kind via the Chime device controller (same facade used for
// start/stop). Returns [] on any failure so callers degrade gracefully.
async function _lrListDevices(kind) {
  if (!_lrAV) return [];
  try {
    return (kind === 'audio')
      ? await _lrAV.listAudioInputDevices()
      : await _lrAV.listVideoInputDevices();
  } catch (e) {
    return [];
  }
}

// Build + show the device dropdown for a kind. Idempotent: rebuilt each open so
// it always reflects the current device list. Marks the active device with ✓.
async function _lrBuildDeviceMenu(kind) {
  var menuId = (kind === 'audio') ? 'lr-mic-menu' : 'lr-cam-menu';
  var menu = document.getElementById(menuId);
  if (!menu) return;

  var list = await _lrListDevices(kind);
  var activeId = _lrPickDeviceId(kind, list);

  menu.innerHTML = '';
  if (!list || list.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'lr-dev-empty';
    empty.textContent = (kind === 'audio') ? 'No microphones found' : 'No cameras found';
    menu.appendChild(empty);
    return;
  }

  list.forEach(function (d, idx) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'lr-dev-item' + (d.deviceId === activeId ? ' active' : '');
    var label = d.label || ((kind === 'audio' ? 'Microphone ' : 'Camera ') + (idx + 1));
    item.innerHTML = '<span class="lr-dev-check"><i class="fas fa-check"></i></span>' +
      '<span class="lr-dev-label"></span>';
    // textContent for the label avoids any HTML injection from device names.
    item.querySelector('.lr-dev-label').textContent = label;
    item.onclick = function (e) {
      e.stopPropagation();
      _lrCloseDeviceMenus();
      _lrSelectDevice(kind, d.deviceId);
    };
    menu.appendChild(item);
  });
}

// Apply a device selection. Remembers the choice and switches the live input if
// the device is currently in use (mic always; camera only when it is on).
async function _lrSelectDevice(kind, deviceId) {
  if (!_lrAV || !deviceId) return;

  if (kind === 'audio') {
    _lrMicDeviceId = deviceId;
    try {
      await _lrAV.startAudioInput(deviceId);
    } catch (err) {
      _lrNotice(_lrClassifyMediaError(err, 'microphone'), 'warn');
    }
    return;
  }

  // video
  _lrCamDeviceId = deviceId;
  if (!_lrCamOn) return; // not streaming yet — the choice applies when turned on
  try {
    // Route through the virtual-background transform if one is active (reuses
    // the SAME helper toggleLiveCamera uses — no duplicated bg logic).
    var input = (typeof lrBgMakeVideoInput === 'function')
      ? await lrBgMakeVideoInput(deviceId)
      : deviceId;
    await _lrAV.startVideoInput(input);
  } catch (err) {
    _lrNotice(_lrClassifyMediaError(err, 'camera'), 'warn');
  }
}

// Refresh any OPEN device menu (after a hot-plug). No-op for closed menus.
function _lrRefreshDeviceMenus() {
  var mic = document.getElementById('lr-mic-menu');
  var cam = document.getElementById('lr-cam-menu');
  if (mic && mic.style.display !== 'none' && mic.style.display !== '') _lrBuildDeviceMenu('audio');
  if (cam && cam.style.display !== 'none' && cam.style.display !== '') _lrBuildDeviceMenu('video');
}

// Close both device dropdowns.
function _lrCloseDeviceMenus() {
  ['lr-mic-menu', 'lr-cam-menu'].forEach(function (id) {
    var m = document.getElementById(id);
    if (m) m.style.display = 'none';
  });
}

// Toggle one device dropdown open (closing the other first). Built fresh on open.
function _lrToggleDeviceMenu(kind) {
  var menuId = (kind === 'audio') ? 'lr-mic-menu' : 'lr-cam-menu';
  var menu = document.getElementById(menuId);
  if (!menu) return;
  var isOpen = menu.style.display === 'block';
  _lrCloseDeviceMenus();
  if (!isOpen) {
    _lrBuildDeviceMenu(kind);
    menu.style.display = 'block';
  }
}

// Handle a mid-class device plug/unplug (C8 + D10). If the device we're
// CURRENTLY using disappeared, inform the user and recover gracefully; always
// refresh any open picker so the list stays accurate.
async function _lrOnDevicesChanged(kind, devices) {
  var list = devices || [];
  var stillHere = function (id) {
    if (!id) return false;
    for (var i = 0; i < list.length; i++) { if (list[i] && list[i].deviceId === id) return true; }
    return false;
  };

  if (kind === 'audio') {
    // Our mic vanished → auto-switch to another if available, else listen-only.
    if (_lrMicDeviceId && !stillHere(_lrMicDeviceId)) {
      if (list.length > 0 && list[0].deviceId) {
        _lrNotice('Your microphone was disconnected — switched to "' +
          (list[0].label || 'another microphone') + '".', 'warn');
        _lrMicDeviceId = list[0].deviceId;
        try { await _lrAV.startAudioInput(_lrMicDeviceId); } catch (e) {}
      } else {
        _lrNotice('Your microphone was disconnected. You are now in listen-only mode.', 'warn');
        _lrMicDeviceId = null;
      }
    }
  } else {
    // Our camera vanished → stop local video + inform (the tile is removed by
    // Chime's videoTileWasRemoved). Reuses the existing force-stop helper.
    if (_lrCamOn && _lrCamDeviceId && !stillHere(_lrCamDeviceId)) {
      _lrNotice('Your camera was disconnected.', 'warn');
      if (typeof _lrForceStopLocalVideo === 'function') { try { await _lrForceStopLocalVideo(); } catch (e) {} }
      _lrCamDeviceId = null;
    }
  }

  _lrRefreshDeviceMenus();
}

// ── Live media-state: speaking / muted / cameraOn (Phase 5) ──────────────────
//
// One shared map feeds BOTH the video tiles and the participants roster, so a
// participant's live state (who's talking, mic muted, camera on/off) is
// computed in ONE place and rendered in two views (no duplicated logic). The
// data comes from Chime's per-attendee volume indicator (speaking + muted) and
// from video-tile presence (cameraOn).

// Base userId from a Chime externalUserId (strips the "#content" screen-share
// suffix). Mirrors the participants module's helper so both agree on identity.
function _lrBaseUser(externalUserId) {
  if (!externalUserId) return '';
  var h = externalUserId.indexOf('#content');
  return h === -1 ? externalUserId : externalUserId.slice(0, h);
}

// Merge a patch into a user's media-state and notify both views. Idempotent;
// only re-renders when something actually changed (cheap + flicker-free).
function _lrSetMediaState(userId, patch) {
  if (!userId) return;
  var cur = _lrMediaState[userId] || { speaking: false, muted: true, cameraOn: false };
  var next = {
    speaking: patch.speaking !== undefined ? patch.speaking : cur.speaking,
    muted: patch.muted !== undefined ? patch.muted : cur.muted,
    cameraOn: patch.cameraOn !== undefined ? patch.cameraOn : cur.cameraOn,
  };
  if (next.speaking === cur.speaking && next.muted === cur.muted && next.cameraOn === cur.cameraOn) {
    return; // no change
  }
  _lrMediaState[userId] = next;

  // View 1 — the video tile (speaking glow; avatar tiles reflect cameraOn).
  _lrApplyTileMediaState(userId, next);
  // View 2 — the participants roster (thin bridge; no-op if panel module absent).
  if (typeof lrpOnMediaState === 'function') { try { lrpOnMediaState(userId, next); } catch (e) {} }
  // Keep avatar (camera-off) tiles in sync with presence + cameraOn.
  _lrSyncAvatarTiles();
}

// Read a user's current media-state (roster + tiles share this).
function _lrGetMediaState(userId) {
  return _lrMediaState[userId] || { speaking: false, muted: true, cameraOn: false };
}

// Subscribe to one attendee's volume indicator → drives speaking + muted.
// Debounced "stopped speaking" so the highlight doesn't flicker on natural
// speech gaps. Safe/idempotent: re-subscribing the same attendee is a no-op.
function _lrWatchVolume(attendeeId, externalUserId) {
  if (!_lrAV || !attendeeId || _lrVolumeSubs[attendeeId]) return;
  var userId = _lrBaseUser(externalUserId) || attendeeId;
  var cb = function (_attendeeId, volume, muted /*, signalStrength */) {
    // muted comes through as a boolean when it changes; reflect it when present.
    if (muted !== null && muted !== undefined) {
      _lrSetMediaState(userId, { muted: !!muted });
    }
    var speakingNow = (volume !== null && volume !== undefined) ? volume > 0.12 : false;
    if (speakingNow) {
      if (_lrSpeakOffTimers[userId]) { clearTimeout(_lrSpeakOffTimers[userId]); delete _lrSpeakOffTimers[userId]; }
      _lrSetMediaState(userId, { speaking: true });
    } else if (!_lrSpeakOffTimers[userId]) {
      _lrSpeakOffTimers[userId] = setTimeout(function () {
        delete _lrSpeakOffTimers[userId];
        _lrSetMediaState(userId, { speaking: false });
      }, 900);
    }
  };
  try {
    _lrAV.realtimeSubscribeToVolumeIndicator(attendeeId, cb);
    _lrVolumeSubs[attendeeId] = cb;
  } catch (e) {}
}

// Unsubscribe every volume indicator + clear speak-off timers (teardown).
function _lrUnwatchAllVolume() {
  if (_lrAV) {
    Object.keys(_lrVolumeSubs).forEach(function (attendeeId) {
      try { _lrAV.realtimeUnsubscribeFromVolumeIndicator(attendeeId); } catch (e) {}
    });
  }
  _lrVolumeSubs = {};
  Object.keys(_lrSpeakOffTimers).forEach(function (u) { clearTimeout(_lrSpeakOffTimers[u]); });
  _lrSpeakOffTimers = {};
}

// Resolve a display name for a tile: prefer the server-resolved roster name
// (shared with the participants panel — no duplicate lookup), else a role
// fallback. Keeps tile labels and the roster consistent (D4).
function _lrTileName(userId, isLocal, isHost) {
  if (typeof lrpNameFor === 'function') {
    var n = lrpNameFor(userId);
    if (n) return isLocal ? (n + ' (You)') : n;
  }
  return isLocal ? 'You' : (isHost ? 'Teacher' : 'Participant');
}

// Re-label every camera tile from the latest roster names (called after the
// roster fetch fills identities in, so late-arriving names appear on tiles).
function _lrRelabelTiles() {
  var grid = document.getElementById('lr-grid');
  if (!grid) return;
  var tiles = grid.querySelectorAll('.lr-tile');
  tiles.forEach(function (t) {
    var uid = t.getAttribute('data-userid');
    if (!uid) return;
    var labelEl = t.querySelector('.lr-tile-name');
    if (labelEl) {
      var isLocal = t.getAttribute('data-local') === '1';
      var isHost = _lrHostUserId && uid === _lrHostUserId;
      labelEl.textContent = _lrTileName(uid, isLocal, isHost);
    }
  });
  _lrSyncAvatarTiles();
}

// Apply a user's media-state to their video tile (speaking glow).
function _lrApplyTileMediaState(userId, state) {
  var grid = document.getElementById('lr-grid');
  if (!grid) return;
  var tile = grid.querySelector('.lr-tile[data-userid="' + (window.CSS && CSS.escape ? CSS.escape(userId) : userId) + '"]');
  if (tile) {
    if (state.speaking && !state.muted) tile.classList.add('speaking');
    else tile.classList.remove('speaking');
  }
}

// ── Avatar (camera-off) tiles — Option A: every present participant has a tile.
// A present user WITHOUT a live camera tile gets an avatar tile (photo/initial +
// name), so the grid always shows everyone (Meet/Zoom style). Camera-on users
// get their real video tile instead; this keeps the two in sync.
function _lrSyncAvatarTiles() {
  var grid = document.getElementById('lr-grid');
  if (!grid) return;

  // Who is present? (roster is the source of presence truth.)
  var present = (typeof lrpPresentUserIds === 'function') ? lrpPresentUserIds() : [];
  var presentSet = {};
  present.forEach(function (u) { presentSet[u] = true; });

  // 1) Remove avatar tiles for users who left or who now have a camera tile.
  var avatars = grid.querySelectorAll('.lr-tile.avatar');
  avatars.forEach(function (a) {
    var uid = a.getAttribute('data-userid');
    var hasCamTile = !!grid.querySelector('.lr-tile:not(.avatar)[data-userid="' + (window.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]');
    if (!presentSet[uid] || hasCamTile) a.remove();
  });

  // 2) Add an avatar tile for each present user who has NO camera tile yet.
  present.forEach(function (uid) {
    var hasCamTile = !!grid.querySelector('.lr-tile:not(.avatar)[data-userid="' + (window.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]');
    var hasAvatar = !!grid.querySelector('.lr-tile.avatar[data-userid="' + (window.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]');
    if (hasCamTile || hasAvatar) {
      if (hasAvatar) _lrUpdateAvatarTile(uid); // keep speaking/name fresh
      return;
    }
    _lrCreateAvatarTile(uid);
  });

  _lrToggleAudioNote();
}

// Create one avatar (camera-off) tile for a present user.
function _lrCreateAvatarTile(userId) {
  var grid = document.getElementById('lr-grid');
  if (!grid || !userId) return;
  var isLocal = (userId === _lrCurrentUserId());
  var isHost = _lrHostUserId && userId === _lrHostUserId;

  var tile = document.createElement('div');
  tile.className = 'lr-tile avatar';
  tile.setAttribute('data-userid', userId);
  if (isLocal) tile.setAttribute('data-local', '1');
  if (isHost) tile.classList.add('teacher');

  var circle = document.createElement('div');
  circle.className = 'lr-avatar-circle';

  var info = (typeof lrpInfoFor === 'function') ? lrpInfoFor(userId) : null;
  var name = _lrTileName(userId, isLocal, isHost);
  if (info && info.avatarUrl) {
    var img = document.createElement('img');
    img.src = info.avatarUrl; img.alt = '';
    img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); circle.textContent = (name[0] || '?').toUpperCase(); };
    circle.appendChild(img);
  } else {
    circle.textContent = (name[0] || '?').toUpperCase();
  }

  var label = document.createElement('span');
  label.className = 'lr-tile-name';
  label.textContent = name;

  tile.appendChild(circle);
  tile.appendChild(label);
  grid.appendChild(tile);

  _lrApplyTileMediaState(userId, _lrGetMediaState(userId));
}

// Refresh an existing avatar tile's name + speaking state (identity may arrive
// after the tile was first created).
function _lrUpdateAvatarTile(userId) {
  var grid = document.getElementById('lr-grid');
  if (!grid) return;
  var tile = grid.querySelector('.lr-tile.avatar[data-userid="' + (window.CSS && CSS.escape ? CSS.escape(userId) : userId) + '"]');
  if (!tile) return;
  var isLocal = (userId === _lrCurrentUserId());
  var isHost = _lrHostUserId && userId === _lrHostUserId;
  var name = _lrTileName(userId, isLocal, isHost);
  var labelEl = tile.querySelector('.lr-tile-name');
  if (labelEl) labelEl.textContent = name;
  var circle = tile.querySelector('.lr-avatar-circle');
  if (circle && !circle.querySelector('img') && circle.textContent !== (name[0] || '?').toUpperCase()) {
    circle.textContent = (name[0] || '?').toUpperCase();
  }
  _lrApplyTileMediaState(userId, _lrGetMediaState(userId));
}

// Show the global audio-note only when the grid + stage have no tiles at all.
function _lrToggleAudioNote() {
  var grid = document.getElementById('lr-grid');
  var stage = document.getElementById('lr-stage');
  var note = document.getElementById('lr-audio-note');
  if (!note) return;
  var count = (grid ? grid.querySelectorAll('.lr-tile').length : 0) +
    (stage ? stage.querySelectorAll('.lr-tile').length : 0);
  note.style.display = count === 0 ? '' : 'none';
}

// Host leave-vs-end prompt (H3). Returns 'leave' | 'end' | 'cancel'.
// Two sequential confirms keep it dependency-free + reliable in Electron:
//   1) "End the class for everyone?"  OK → end,  Cancel → step 2
//   2) "Leave but keep it running?"   OK → leave, Cancel → cancel
function _lrHostLeaveChoice() {
  var end = confirm(
    'You are the host.\n\n' +
    'OK = END the class for everyone.\n' +
    'Cancel = just leave (the class keeps running for students).'
  );
  if (end) return 'end';
  var leave = confirm('Leave the class but keep it running for students?\n\nOK = Leave    Cancel = Stay');
  return leave ? 'leave' : 'cancel';
}

// ── Media error classification (shared by mic/cam permission + device errors) ─
//
// Maps a getUserMedia / Chime device error to a short, human message. Phase 1
// uses it for the microphone; Phase 4 reuses the SAME classifier for the camera
// and device-change failures (so B13/C7/C8/D6/D10/C14 all speak one language).
function _lrClassifyMediaError(err, deviceLabel) {
  var name = (err && err.name) || '';
  var dev = deviceLabel || 'device';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Access to your ' + dev + ' is blocked. Please allow permission and try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No ' + dev + ' was found on this computer.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your ' + dev + ' is busy — close other apps using it and try again.';
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return 'Your ' + dev + " doesn't support the requested settings.";
    default:
      return 'Could not start your ' + dev + '. Please check it and try again.';
  }
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

// ── Recording timer (P13) ────────────────────────────────────────────────────
// A live counter beside the "● Recording" indicator showing how long the
// recording has been running. Reuses _lrFormatElapsed (same mm:ss / h:mm:ss
// format as the class timer — no duplicated formatting). It is anchored to the
// recording's start time, which the host broadcasts so EVERY participant's
// counter stays in sync (not a per-client local clock).

function _lrRecTimerTick() {
  var txt = document.getElementById('lr-rec-timer');
  if (txt && _lrRecStartedAtMs) txt.textContent = _lrFormatElapsed(Date.now() - _lrRecStartedAtMs);
}

// Start (or restart) the recording timer anchored to `startedAtMs` (epoch ms).
// Falls back to "now" if a start time wasn't provided (e.g. an older broadcast
// payload without it). Idempotent.
function _lrStartRecTimer(startedAtMs) {
  _lrRecStartedAtMs = (typeof startedAtMs === 'number' && startedAtMs > 0) ? startedAtMs : Date.now();
  _lrRecTimerTick();
  if (_lrRecTimerInterval) clearInterval(_lrRecTimerInterval);
  _lrRecTimerInterval = setInterval(_lrRecTimerTick, 1000);
}

// Stop + reset the recording timer.
function _lrStopRecTimer() {
  if (_lrRecTimerInterval) { clearInterval(_lrRecTimerInterval); _lrRecTimerInterval = null; }
  _lrRecStartedAtMs = 0;
  var txt = document.getElementById('lr-rec-timer');
  if (txt) txt.textContent = '00:00';
}

// ── Right-panel + layout controller (single source of truth) ─────────────────
//
// The live room has exactly ONE right-side panel slot that shows Chat XOR
// Participants XOR nothing. Centralising this here guarantees the two panels
// are mutually exclusive and removes any duplicated show/hide logic from the
// chat/participants modules (they just call _lrSetRightPanel). The layout CSS
// keys off the .lr-body classes this sets (panel-chat / panel-people /
// panel-none) and off .sharing (set by _lrApplyLayout).

// Open a specific right panel ('chat' | 'people'), or 'none' to close. Passing
// the already-open panel's name toggles it closed (Meet/Teams behaviour).
function _lrSetRightPanel(which) {
  var body = document.querySelector('#page-live-room .lr-body');
  var chat = document.getElementById('lr-chat');
  var people = document.getElementById('lr-people');
  if (!body) return;

  // Toggle: clicking the currently-open panel closes it.
  if (which === _lrRightPanel) which = 'none';
  _lrRightPanel = (which === 'chat' || which === 'people') ? which : 'none';

  // Only ONE panel visible at a time.
  if (chat) chat.style.display = (_lrRightPanel === 'chat') ? '' : 'none';
  if (people) people.style.display = (_lrRightPanel === 'people') ? 'flex' : 'none';

  // Reflect state on .lr-body so CSS can size the main area (full width when
  // no panel is open) and style the toggle buttons' active state.
  body.classList.remove('panel-chat', 'panel-people', 'panel-none');
  body.classList.add('panel-' + _lrRightPanel);

  // Keep the top-bar toggle buttons' active highlight in sync.
  var chatBtn = document.getElementById('lr-chat-toggle');
  var peopleBtn = document.getElementById('lr-people-btn');
  if (chatBtn) chatBtn.classList.toggle('active', _lrRightPanel === 'chat');
  if (peopleBtn) peopleBtn.classList.toggle('active', _lrRightPanel === 'people');

  // When the participants panel opens, refresh its roster/identities.
  if (_lrRightPanel === 'people' && typeof lrpOnPanelOpened === 'function') {
    try { lrpOnPanelOpened(); } catch (e) {}
  }
}

// Is a screen-share active in this room RIGHT NOW, from this client's view?
// True when THIS user is sharing (host's own share — the host has no content
// tile in their own stage) OR a remote screen-share (content) tile is present in
// the stage (every viewer). Previously only `_lrSharing` was checked, which is
// true on the host's machine alone — so viewers never got the share layout and
// a tall shared screen overflowed (bottom cut) on smaller displays.
function _lrIsShareActive() {
  if (_lrSharing) return true;
  var stage = document.getElementById('lr-stage');
  return !!(stage && stage.querySelector('.lr-tile.content'));
}

// Apply the stage/grid layout based on whether a screen-share is active.
// NO-share  → camera tiles form a Google-Meet-style grid (big tiles).
// SHARE-on  → the shared screen fills the stage; camera tiles collapse into a
//             slim strip of small circular avatars. All visual; CSS keys off
//             the .sharing class, so this helper is just the single toggle.
// Same layout for host AND viewers (driven by _lrIsShareActive). Idempotent —
// safe to call on every tile add/remove.
function _lrApplyLayout() {
  var shareActive = _lrIsShareActive();
  var body = document.querySelector('#page-live-room .lr-body');
  if (body) body.classList.toggle('sharing', shareActive);

  // Camera-tiles toggle (P5) is only meaningful while sharing (that's when the
  // tiles collapse into the circular strip). Show the toggle button only during
  // a share; when sharing stops, reset to "shown" so the next share starts ON.
  var tilesBtn = document.getElementById('lr-tiles-toggle');
  if (tilesBtn) tilesBtn.style.display = shareActive ? '' : 'none';
  if (!shareActive) {
    _lrTilesHidden = false;
  }
  _lrApplyTilesVisibility();
}

// Apply the camera-tiles show/hide state to the layout + the toggle button's
// active look. The CSS keys off `.lr-body.tiles-hidden` (only has an effect in
// share mode, where the circular strip exists).
function _lrApplyTilesVisibility() {
  var body = document.querySelector('#page-live-room .lr-body');
  if (body) body.classList.toggle('tiles-hidden', !!_lrTilesHidden);
  var tilesBtn = document.getElementById('lr-tiles-toggle');
  if (tilesBtn) tilesBtn.classList.toggle('active', !_lrTilesHidden); // active = tiles shown
}

// Toggle the share-mode camera strip on/off (host + participant both). Wired to
// the top-bar button. No-op visually when not sharing (strip doesn't exist then).
function _lrToggleTiles() {
  _lrTilesHidden = !_lrTilesHidden;
  _lrApplyTilesVisibility();
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
  // Rapid re-open safety (B15): ignore a second open while one is already in
  // progress or a session is still active — prevents overlapping sessions from
  // a double-click / fast rejoin. Cleared once connect settles (below).
  if (_lrOpening || _lrAV) return;
  _lrOpening = true;

  // P9: remember (client-side) that this user has entered this class's room this
  // session, so the Live list shows "Rejoin" (not "Join Now") after they leave.
  // No-op if the list module isn't loaded. Single source of truth lives there.
  if (typeof liveMarkJoined === 'function') { try { liveMarkJoined(classId); } catch (e) {} }

  _lrClassId = classId;
  _lrMuted = true; // join muted by default; actual Chime mute happens on connect
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
  _lrSetConnState('connecting');
  _lrClearNotices(); // start each open with a clean banner area
  _lrClearFailTimer();
  _lrHideOverlay();  // never carry a stale terminal overlay into a new open
  _lrWireControls();

  // Initial layout: no screen-share yet (Meet-style grid) and no right panel
  // open (main area full width). The chat/participants buttons open their panel
  // on demand via the single _lrSetRightPanel controller.
  _lrRightPanel = 'none';
  _lrApplyLayout();
  _lrSetRightPanel('none');

  try {
    await _lrConnect(joinData.meeting, joinData.attendee);
    _lrOpening = false; // connect kicked off successfully; room is active
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
    // Wire the virtual-background picker (Phase 3).
    if (typeof lrBgWire === 'function') lrBgWire();
  } catch (e) {
    // Surface the REAL reason in the devtools console so connection failures
    // are diagnosable instead of being swallowed.
    console.error('[live-room] connect failed:', e);
    _lrSetConnState('failed');
    // Non-blocking, clearer error (K4/I16): show the real reason + a retry hint
    // instead of a blocking alert. The user can re-open the class to retry.
    _lrNotice(
      'Could not connect to the live class' +
        (e && e.message ? ' (' + e.message + ')' : '') +
        '. Please try joining again.',
      'error'
    );
    // Clean up a partial session so a retry starts fresh.
    await _lrTeardown();
    _lrOpening = false; // allow a fresh open/retry after cleanup (B15)
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
    var micId = _lrPickDeviceId('audio', mics); // saved choice if present, else first
    if (micId) {
      _lrMicDeviceId = micId;
      await _lrAV.startAudioInput(micId);
    } else {
      // No mic available — join listen-only, but TELL the user (B13/C7) instead
      // of silently swallowing it, so they know why they can't speak.
      console.warn('[live-room] no usable microphone found; joining listen-only');
      _lrNotice('No microphone found — you have joined in listen-only mode.', 'warn');
    }
  } catch (micErr) {
    // Classify the failure (permission / busy / not-found) and surface a clear,
    // non-blocking message. The connection still proceeds (listen-only).
    console.warn('[live-room] startAudioInput failed; joining listen-only:', micErr);
    _lrNotice(_lrClassifyMediaError(micErr, 'microphone') + ' You have joined in listen-only mode.', 'warn');
  }

  // Bind the audio output to a hidden <audio> element so remote audio plays.
  var audioEl = _lrEnsureAudioEl();
  try { await _lrAV.bindAudioElement(audioEl); } catch (e) {}

  // Observe connection lifecycle + video tiles. The connection state is what
  // actually tells us the meeting is live — `start()` returns immediately but
  // the real WebRTC/WebSocket connect happens asynchronously afterwards.
  _lrAV.addObserver({
    // Connecting / reconnecting. Fired at the START of every connect attempt.
    // `reconnecting===true` means Chime's built-in ReconnectController is
    // retrying after a transient drop — reflect it so the user sees
    // "Reconnecting…" instead of a stale "● Live" or a scary "failed" (B12/K2).
    audioVideoDidStartConnecting: function (reconnecting) {
      _lrSetConnState(reconnecting ? 'reconnecting' : 'connecting');
    },
    // Meeting session fully connected (audio/video channels up). Also fired
    // after a successful reconnect, so the label returns to "● Live" on its own.
    audioVideoDidStart: function () {
      _lrConnected = true;
      _lrSetConnState('connected');
      // Recovered (fresh connect OR a successful auto-reconnect) → cancel any
      // pending "failed" overlay and clear a stale banner (B8).
      _lrClearFailTimer();
      _lrHideOverlay();
      _lrStartTimer(); // begin the elapsed-time counter
      _lrStartHeartbeat(); // host-only: keep the class marked alive (Phase 3)
      // Join muted by default (Meet/Teams-style): on every join/rejoin the local
      // mic is ACTUALLY muted (not just the icon), so audio + UI always match.
      // Reuses the existing force-mute helper (mutes Chime + sets the button).
      // The user can unmute anytime via the mic button.
      if (typeof _lrForceMuteLocalAudio === 'function') _lrForceMuteLocalAudio();
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
      // 1 === MeetingEnded (the host ended it — a normal close, handled fully in
      // Phase 2), 0 === OK. We never deliberately leave here. Anything else is
      // an unexpected drop → mark "failed" + tell the user it's recoverable
      // (K11/K4/I16). Chime keeps retrying in the background on its own.
      if (_lrLeaving) return;
      if (code === 1) {
        // MeetingEnded — the host ended the class. Show the terminal "Class
        // ended" overlay for EVERYONE still in the room (M2). Stop the elapsed
        // timer; keep the session object until the user clicks through so the
        // overlay has a stable backdrop (full teardown runs on leave/rejoin).
        _lrSetConnState('ended');
        _lrClearFailTimer();
        _lrStopTimer();
        _lrShowOverlay('ended');
      } else if (code !== 0) {
        // Unexpected drop. Chime's ReconnectController is already retrying in
        // the background, so DON'T panic the user immediately — show the banner
        // (Phase 1) and give auto-reconnect a grace window. Only if it hasn't
        // recovered by then do we surface the actionable "failed" overlay with
        // Rejoin/Leave (B8/K6). audioVideoDidStart cancels this if we recover.
        _lrSetConnState('failed');
        _lrNotice('Connection lost. Trying to reconnect…', 'error');
        _lrClearFailTimer();
        _lrFailTimer = setTimeout(function () {
          _lrFailTimer = null;
          if (!_lrLeaving && !_lrConnected) _lrShowOverlay('failed');
        }, _LR_FAIL_GRACE_MS);
      }
    },
    // Weak connection — the meeting is still up but quality is degraded. Reflect
    // it distinctly (not a failure, not a plain "Live") so the user understands
    // any lag/artefacts (K2).
    connectionDidBecomePoor: function () {
      // Don't override a "reconnecting"/"failed" state with "poor".
      if (_lrConnState === 'connected') _lrSetConnState('poor');
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
        // Sync the recording timer to the host's broadcast start time (P13) so
        // every participant's counter matches. Missing/old payload → fallback
        // handled inside _lrStartRecTimer.
        _lrShowRecIndicator(!!p.recording, p.startedAt || 0);
      } catch (e) {}
    });
  } catch (e) {}

  // Device hot-plug handling (Phase 4 / C8 + D10): react when the user plugs or
  // unplugs a mic/camera mid-class. If the CURRENT device vanished, tell the
  // user and auto-fall-back (mic) / stop (camera); always refresh any open menu.
  try {
    _lrDeviceObserver = {
      audioInputsChanged: function (devices) { _lrOnDevicesChanged('audio', devices); },
      videoInputsChanged: function (devices) { _lrOnDevicesChanged('video', devices); },
    };
    deviceController.addDeviceChangeObserver(_lrDeviceObserver);
    _lrDeviceCtl = deviceController; // keep a ref so teardown can remove the observer
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
  if (micBtn) {
    micBtn.onclick = toggleLiveMic;
    // Join-muted default: reflect the muted state in the button UI immediately
    // on wiring (before Chime connects), so the icon never shows "unmuted" for
    // the brief window between opening the room and audioVideoDidStart firing.
    // Keeps UI and functionality in sync from the very first frame.
    if (_lrMuted) {
      micBtn.classList.add('muted');
      micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    } else {
      micBtn.classList.remove('muted');
      micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
  }
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

  // Compact back button (live-room's own, replacing the universal back bar).
  // Uses the app's existing goBack() so history behaviour is identical.
  var backBtn = document.getElementById('lr-back-btn');
  if (backBtn) backBtn.onclick = function () { if (typeof goBack === 'function') goBack(); };

  // Camera-tiles toggle (P5) — show/hide the share-mode circular camera strip.
  var tilesBtn = document.getElementById('lr-tiles-toggle');
  if (tilesBtn) tilesBtn.onclick = _lrToggleTiles;

  // Device-picker carets (Phase 4): the ▾ next to mic/cam opens a dropdown to
  // choose the input device. The main mic/cam buttons keep their exact
  // behaviour; the caret is a separate adjoining control.
  var micCaret = document.getElementById('lr-mic-caret');
  if (micCaret) micCaret.onclick = function (e) { e.stopPropagation(); _lrToggleDeviceMenu('audio'); };
  var camCaret = document.getElementById('lr-cam-caret');
  if (camCaret) camCaret.onclick = function (e) { e.stopPropagation(); _lrToggleDeviceMenu('video'); };

  // Close device dropdowns on any outside click (wired once).
  if (!_lrDeviceOutsideWired) {
    _lrDeviceOutsideWired = true;
    document.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest &&
          (ev.target.closest('.lr-dev-menu') || ev.target.closest('.lr-dev-caret'))) return;
      _lrCloseDeviceMenus();
    });
  }
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
  // Guard against overlapping toggles (O15): a rapid double-click could
  // otherwise start/stop video twice and desync the button + state.
  if (_lrCamBusy) return;
  // Host moderation (Phase 7): if the host disabled this user's video, they
  // cannot turn their camera on until the host allows it again.
  if (_lrCamLocked && !_lrCamOn) {
    alert('⚠️ The host has turned off your camera for this class.');
    return;
  }
  _lrCamBusy = true;
  try {
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

  // Turn ON — pick the chosen camera (or the first available), start input + tile.
  try {
    var cams = await _lrAV.listVideoInputDevices();
    var camId = _lrPickDeviceId('video', cams); // saved choice if present, else first
    if (!camId) {
      // No camera at all — non-blocking, clear (D6/D10), not a dead-end alert.
      _lrNotice('No camera was found on this computer.', 'warn');
      return;
    }
    _lrCamDeviceId = camId;
    // Virtual background: if one is selected, this returns a transform device
    // that replaces the background; otherwise it returns the plain deviceId.
    var _camInput = (typeof lrBgMakeVideoInput === 'function')
      ? await lrBgMakeVideoInput(camId)
      : camId;
    await _lrAV.startVideoInput(_camInput);
    _lrAV.startLocalVideoTile();
    _lrCamOn = true;
    if (camBtn) { camBtn.classList.remove('cam-off'); camBtn.classList.add('cam-on'); camBtn.innerHTML = '<i class="fas fa-video"></i>'; }
    if (typeof lrPipSyncState === 'function') lrPipSyncState();
  } catch (e) {
    // Permission-aware, non-blocking message (D6) via the shared classifier.
    _lrNotice(_lrClassifyMediaError(e, 'camera'), 'warn');
  }
  } finally {
    // Always clear the in-flight guard, whichever branch/return ran (O15).
    _lrCamBusy = false;
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

// Virtual background (Phase 3): re-apply the camera input when the user changes
// the background while the camera is already on. Rebuilds the video input
// through the (possibly new) transform device so the change is live. Called by
// live-room-bg.js. No-op if the camera is off.
async function lrBgReapplyCamera() {
  if (!_lrAV || !_lrCamOn) return;
  try {
    var cams = await _lrAV.listVideoInputDevices();
    if (!cams || cams.length === 0 || !cams[0].deviceId) return;
    var input = (typeof lrBgMakeVideoInput === 'function')
      ? await lrBgMakeVideoInput(cams[0].deviceId)
      : cams[0].deviceId;
    // Restarting the input swaps the processed track; the local tile keeps
    // rendering, so remote participants see the new background seamlessly.
    await _lrAV.startVideoInput(input);
  } catch (e) {
    console.warn('[live-room] background re-apply failed:', e);
  }
}

// ── Screen share (teacher only) ─────────────────────────────────────────────

// Toggle screen share. ON → open the source picker; OFF → stop sharing.
async function toggleScreenShare() {
  if (!_lrAV || !_lrIsHost) return;
  // Guard overlapping share toggles (O15) so a double-click can't open the
  // picker twice or race start/stop.
  if (_lrShareBusy) return;
  _lrShareBusy = true;
  try {
    if (_lrSharing) {
      // Confirm before stopping so a mis-click doesn't abruptly end the share
      // mid-presentation. Only stop when the host explicitly agrees.
      if (!confirm('Are you sure you want to stop sharing your screen?')) return;
      await _lrStopShare();
    } else {
      await _lrOpenPicker();
    }
  } finally {
    _lrShareBusy = false;
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
    // returns the source we just set. We request audio too (E8): the main
    // process answers with `audio: 'loopback'`, so on supported sources the
    // stream carries the SYSTEM audio — a video the teacher plays is heard by
    // everyone. Best-effort: if audio isn't available for the chosen source the
    // stream simply has no audio track and the share proceeds normally.
    var stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch (audioErr) {
      // Some sources/platforms reject the combined audio+video request. Retry
      // video-only so screen sharing never fails just because audio couldn't be
      // captured.
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    }
    _lrShareStream = stream;

    // Hand the screen track(s) to Chime as the content share. Chime publishes
    // the audio track alongside the video when the stream has one, so no extra
    // wiring is needed — students hear it through the same meeting audio sink.
    await _lrAV.startContentShare(stream);
    _lrSharing = true;

    var shareBtn = document.getElementById('lr-share-btn');
    if (shareBtn) { shareBtn.classList.add('sharing'); shareBtn.innerHTML = '<i class="fas fa-stop"></i> Stop'; }

    // Part E: tell the host whether system audio is included, so they know
    // whether a played video/clip will be heard. Reuses the Phase 1 notice.
    var hasShareAudio = false;
    try { hasShareAudio = stream.getAudioTracks().length > 0; } catch (x) {}
    if (hasShareAudio) {
      _lrNotice('Sharing your screen with system audio.', 'success');
    } else {
      _lrNotice('Sharing your screen. System audio isn’t available for this source.', 'info');
    }

    // Layout: switch camera tiles into the slim circular-avatar strip now that
    // the shared screen owns the stage.
    _lrApplyLayout();

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

  // Layout: camera tiles return to the Google-Meet grid now that nothing is
  // being shared.
  _lrApplyLayout();

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
    // Anchor the recording timer to a single start instant and broadcast it so
    // every participant's counter stays in sync (P13).
    var recStartedAt = _lrRecording ? Date.now() : 0;
    _lrShowRecIndicator(_lrRecording, recStartedAt);
    _lrBroadcastRec(_lrRecording, recStartedAt);
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

// Show/hide the "● Recording" indicator (shown to EVERYONE in the room) and
// drive its live recording timer (P13). `startedAtMs` (epoch ms) anchors the
// timer so it stays in sync across participants; omitted → the timer uses
// "now" (host's own toggle) or is simply stopped when turning off.
function _lrShowRecIndicator(on, startedAtMs) {
  var ind = document.getElementById('lr-rec-indicator');
  if (ind) ind.style.display = on ? 'inline-flex' : 'none';
  if (on) {
    _lrStartRecTimer(startedAtMs);
  } else {
    _lrStopRecTimer();
  }
}

// Broadcast recording status to all participants (real-time, via Chime data).
// `startedAt` (epoch ms) lets every participant anchor the recording timer to
// the SAME instant (P13) — additive field, older clients that ignore it still
// work (they just fall back to their own clock).
function _lrBroadcastRec(on, startedAt) {
  try {
    if (_lrAV) {
      _lrAV.realtimeSendDataMessage(
        _LR_REC_TOPIC,
        JSON.stringify({ recording: !!on, startedAt: startedAt || 0 })
      );
    }
  } catch (e) {}
}

// ── Video tile grid management ──────────────────────────────────────────────

// Reset the stage + grid to just the audio note (used on each room open).
// Tiles now live in two places: camera tiles in #lr-grid (right column) and the
// screen-share tile in #lr-stage (left). Clear both; keep the audio note shown.
function _lrResetGrid() {
  var grid = document.getElementById('lr-grid');
  var stage = document.getElementById('lr-stage');
  [grid, stage].forEach(function (container) {
    if (!container) return;
    var tiles = container.querySelectorAll('.lr-tile');
    tiles.forEach(function (t) { t.remove(); });
  });
  var note = document.getElementById('lr-audio-note');
  if (note) note.style.display = '';
}

// Add or update a tile for a given Chime tileState.
function _lrAddOrUpdateTile(tileState) {
  var grid = document.getElementById('lr-grid');       // RIGHT column (camera tiles)
  var stage = document.getElementById('lr-stage');     // LEFT stage (screen-share)
  if (!grid) return;

  var tileId = tileState.tileId;
  var isLocal = !!tileState.localTile;
  var isContent = !!tileState.isContent;
  if (isLocal) _lrLocalTileId = tileId;

  // The user this tile belongs to (strip the "#content" suffix for shares).
  var tileUserId = isLocal ? _lrCurrentUserId()
    : _lrBaseUser(tileState.boundExternalUserId || '');

  // Teams layout: the screen-share (content) tile goes to the big LEFT stage;
  // every camera tile goes into the RIGHT column grid.
  var container = (isContent && stage) ? stage : grid;

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
    container.appendChild(tileEl);
  } else if (tileEl.parentNode !== container) {
    // A tile can switch sides (e.g. becomes/stops being content) — move it.
    container.appendChild(tileEl);
  }

  // Tag the tile with identity so the roster/media-state + relabelling can find
  // it (Phase 5). Content tiles don't carry a user identity.
  if (!isContent && tileUserId) {
    tileEl.setAttribute('data-userid', tileUserId);
    if (isLocal) tileEl.setAttribute('data-local', '1');
  }

  // Tag + label the tile. Content (screen-share) tiles get a prominent,
  // full-width layout; camera tiles get teacher highlight + the real name (D4).
  var isHost = _lrHostUserId && tileState.boundExternalUserId &&
    tileState.boundExternalUserId.indexOf(_lrHostUserId) === 0;
  var labelEl = tileEl.querySelector('.lr-tile-name');
  if (isContent) {
    tileEl.classList.add('content');
    if (labelEl) labelEl.textContent = (isHost ? 'Teacher' : 'Presenter') + "'s screen";
    // A screen-share tile is now in the stage → switch THIS client (viewer
    // included) into the share layout so the shared screen fits the window.
    _lrApplyLayout();
  } else {
    if (isHost) tileEl.classList.add('teacher');
    if (labelEl) labelEl.textContent = _lrTileName(tileUserId, isLocal, isHost);
  }

  // Bind the Chime tile to the <video> element so it renders.
  var videoEl = document.getElementById('lr-video-' + tileId);
  if (videoEl && _lrAV) {
    try { _lrAV.bindVideoElement(tileId, videoEl); } catch (e) {}
  }

  // Media-state (Phase 5): a live camera tile means that user's camera is ON —
  // remove their avatar (camera-off) tile. Also start watching their volume for
  // speaking/muted. Content tiles are not people, so they're skipped.
  if (!isContent && tileUserId) {
    _lrWatchVolume(tileState.boundAttendeeId, tileState.boundExternalUserId);
    _lrSetMediaState(tileUserId, { cameraOn: true });
    _lrApplyTileMediaState(tileUserId, _lrGetMediaState(tileUserId));
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
  var tileUserId = tileEl ? tileEl.getAttribute('data-userid') : null;
  var wasContent = !!(tileEl && tileEl.classList.contains('content'));
  if (tileEl) tileEl.remove();

  // The screen-share tile left the stage → drop back to the normal grid layout
  // on this client (viewer included).
  if (wasContent) _lrApplyLayout();

  // That user's camera is now off — update media-state so an avatar (camera-off)
  // tile takes the video tile's place if they're still present (Phase 5 / D5).
  if (tileUserId) _lrSetMediaState(tileUserId, { cameraOn: false });

  // Keep avatar tiles + the audio-note in sync with what's left.
  _lrSyncAvatarTiles();
  _lrToggleAudioNote();

  // Re-pick the PiP primary video if the mini-window is open (the removed tile
  // may have been the one being mirrored). No-op if PiP is closed.
  if (typeof lrPipRefreshVideo === 'function') lrPipRefreshVideo();
}

// Leave the room: tears down Chime, tells the backend, returns to the list.
//
// Host leave-vs-end clarity (H3): when the HOST leaves, the class keeps running
// for students (that is the intended policy — a teacher can step out and rejoin).
// We make that explicit so the host isn't surprised, and offer to End for
// everyone instead. Reuses the existing endLiveClass flow — no duplicated logic.
async function leaveLiveRoom() {
  if (_lrLeaving) return;

  // Only prompt the host, only while the class is actually live (not when an
  // overlay/terminal state already drove us here, and not for students).
  if (_lrIsHost && _lrConnected && _lrConnState !== 'ended') {
    var choice = _lrHostLeaveChoice();
    if (choice === 'cancel') return;
    if (choice === 'end') {
      var endId = _lrClassId;
      // End for everyone via the SAME path the Live list uses. endLiveClass
      // handles teardown-independent backend end + list refresh; we tear down
      // the local session first so media stops immediately.
      _lrLeaving = true;
      await _lrTeardown();
      if (endId && typeof endLiveClass === 'function') { try { await endLiveClass(endId, null); } catch (e) {} }
      _lrLeaving = false;
      if (typeof navigate === 'function') navigate('live');
      if (typeof renderLiveClasses === 'function') renderLiveClasses();
      return;
    }
    // choice === 'leave' → fall through to the normal leave below.
  }

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
  // Dispose the virtual-background processor (frees the model/worker).
  if (typeof lrBgStop === 'function') { try { lrBgStop(); } catch (e) {} }

  // Remove the device-change observer (Phase 4) so it never fires after leave.
  if (_lrDeviceCtl && _lrDeviceObserver) {
    try { _lrDeviceCtl.removeDeviceChangeObserver(_lrDeviceObserver); } catch (e) {}
  }
  _lrDeviceObserver = null;
  _lrDeviceCtl = null;
  _lrCloseDeviceMenus();

  // Unsubscribe all volume indicators + clear media-state (Phase 5) while _lrAV
  // still exists, so nothing fires after we leave.
  _lrUnwatchAllVolume();

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
  _lrStopHeartbeat(); // stop host liveness pings (Phase 3)
  _lrStartedAtMs = 0;

  // Reset the right-panel + layout state so the next room opens clean (no
  // leftover panel open, no stale .sharing / .panel-* classes on .lr-body).
  _lrRightPanel = 'none';
  var _body = document.querySelector('#page-live-room .lr-body');
  if (_body) _body.classList.remove('sharing', 'panel-chat', 'panel-people', 'panel-none');

  // Reset the connection state + clear any lingering notice banners / overlay /
  // grace timer so the next room open starts from a clean slate.
  _lrConnState = 'idle';
  _lrClearNotices();
  _lrClearFailTimer();
  _lrHideOverlay();

  // Reset remembered device choices so the next open resolves fresh (first
  // available) — avoids pointing at a device from a previous session/machine.
  _lrMicDeviceId = null;
  _lrCamDeviceId = null;

  // Clear the live media-state map (Phase 5) so the next room starts clean.
  _lrMediaState = {};

  // Clear transient action guards (O15/B15) so the next open starts unblocked.
  _lrOpening = false;
  _lrCamBusy = false;
  _lrShareBusy = false;

  // Reset the camera-tiles toggle (P5) so the next room starts with tiles shown.
  _lrTilesHidden = false;
  if (_body) _body.classList.remove('tiles-hidden');
}
