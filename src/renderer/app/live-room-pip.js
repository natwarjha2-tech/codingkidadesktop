/**
 * CodingKida Desktop — Live Class PiP bridge (main-window side) — ISOLATED
 *
 * Native-window PiP (Teams-style). The floating mini-window is a separate
 * Electron BrowserWindow (created in main.js). This file runs in the MAIN
 * window and is the only place that talks to it, via the preload IPC bridge:
 *
 *   main → mini : lrPipPushState()   (title / participant count / mic / cam / rec)
 *   mini → main : onLivePipCommand   (mic / cam / leave / expand button pressed)
 *
 * The Chime media session lives entirely in the MAIN window and is NEVER
 * touched here — so opening/closing the mini-window can never drop audio/video
 * or force a rejoin. Commands from the mini-window simply invoke the SAME
 * functions the in-room buttons use (toggleLiveMic / toggleLiveCamera /
 * leaveLiveRoom), so there is zero duplicated behaviour.
 *
 * Step 2 = command relay + state sync (no video yet; that is Step 3). Triggers
 * (when to actually open the window) are wired in Step 4.
 */

var _lrPipWired = false;   // command listener wired once?
var _lrPipStateTimer = null; // throttle state pushes
var _lrPipIsOpen = false;  // is the mini-window currently open?

// Is the native PiP IPC bridge available? (false in a plain browser / tests)
function _lrPipBridge() {
  return (typeof window !== 'undefined' && window.electron &&
    typeof window.electron.livePipSendState === 'function') ? window.electron : null;
}

// Arm/disarm the main-process blur auto-PiP (Case 3). Armed while a class is
// live so alt-tab/minimize auto-opens the mini-window; disarmed on leave/end.
function lrPipSetArmed(armed) {
  var br = _lrPipBridge();
  if (br && typeof br.setLivePipArmed === 'function') {
    try { br.setLivePipArmed(!!armed); } catch (e) {}
  }
}

// Wire the mini-window → main-window command listener exactly once. Called when
// the live room opens (safe to call repeatedly).
function lrPipWireCommands() {
  if (_lrPipWired) return;
  var br = _lrPipBridge();
  if (!br || typeof br.onLivePipCommand !== 'function') return;
  _lrPipWired = true;

  // Handshake: whenever the mini-window loads (opened by a renderer call OR by
  // the main-process blur auto-open in Case 3), it tells us it's ready — we then
  // mark PiP open, start the video send, and push the current state. This is the
  // single reliable entry point for "a mini-window now exists".
  if (typeof br.onLivePipReady === 'function') {
    br.onLivePipReady(function () {
      _lrPipIsOpen = true;
      lrPipPushState();
      lrPipStartVideo();
    });
  }

  br.onLivePipCommand(function (payload) {
    var action = payload && payload.action;
    if (!action) return;
    try {
      if (action === 'mic' && typeof toggleLiveMic === 'function') {
        toggleLiveMic();
        lrPipPushState();
      } else if (action === 'cam' && typeof toggleLiveCamera === 'function') {
        toggleLiveCamera();
        // camera toggle is async-ish; push shortly after so state is accurate
        setTimeout(lrPipPushState, 300);
      } else if (action === 'leave' && typeof leaveLiveRoom === 'function') {
        lrPipClose();
        leaveLiveRoom();
      } else if (action === 'expand') {
        // "Return to app": close the mini-window, bring the APP window to the
        // front, and show the live room inline.
        if (typeof navigate === 'function') navigate('live-room');
        lrPipClose(true); // focusMain = bring the main window forward
      }
    } catch (e) {}
  });
}

// Open the native mini-window + start syncing state to it.
function lrPipOpen() {
  var br = _lrPipBridge();
  if (!br || typeof br.openLivePip !== 'function') return;
  // Only when a class is actually connected (gated by live-room.js _lrConnected).
  if (typeof _lrConnected !== 'undefined' && !_lrConnected) return;
  _lrPipIsOpen = true;
  br.openLivePip({ width: 360, height: 240 });
  // Video + state start are driven by the mini-window's "ready" handshake
  // (onLivePipReady above) — reliable regardless of how it was opened.
}

// Close the native mini-window. `focusMain` brings the app window to front
// (used by the mini-window's "return to app" button).
function lrPipClose(focusMain) {
  _lrPipIsOpen = false;
  _lrPipVideoRetries = 0;
  lrPipStopVideo();
  var br = _lrPipBridge();
  if (br && typeof br.closeLivePip === 'function') br.closeLivePip({ focusMain: !!focusMain });
}

// ── WebRTC video forwarding — SENDER side (main window), Step 3 ─────────────────

var _lrPipPC = null;          // RTCPeerConnection (sender)
var _lrPipSenderWired = false; // answer/ice listeners wired?
var _lrPipVideoRetries = 0;   // short self-retries while waiting for a tile

// Pick the PRIMARY video MediaStream to mirror into the PiP, by priority:
//   1) the host's OWN screen-share (_lrShareStream) — a sharing host has no
//      content tile in their own grid, so we must take the captured stream
//      directly; this is what makes "host shares → PiP shows the shared screen"
//      work on the host's machine.
//   2) a remote screen-share content tile  3) teacher camera tile
//   4) any live tile.
// Returns a MediaStream or null (audio-only → placeholder stays).
function _lrPipPickPrimaryStream() {
  // 1) Host is sharing their own screen → use the captured share stream.
  try {
    if (typeof _lrSharing !== 'undefined' && _lrSharing &&
        typeof _lrShareStream !== 'undefined' && _lrShareStream &&
        _lrShareStream.getVideoTracks && _lrShareStream.getVideoTracks().length) {
      return _lrShareStream;
    }
  } catch (e) {}

  var grid = document.getElementById('lr-grid');
  if (!grid) return null;
  // 2) Remote content (screen-share) tile.
  var content = grid.querySelector('.lr-tile.content video');
  if (content && content.srcObject) return content.srcObject;
  // 3) Teacher camera tile.
  var teacher = grid.querySelector('.lr-tile.teacher video');
  if (teacher && teacher.srcObject) return teacher.srcObject;
  // 4) First tile with a live stream.
  var vids = grid.querySelectorAll('.lr-tile video');
  for (var i = 0; i < vids.length; i++) {
    if (vids[i].srcObject) return vids[i].srcObject;
  }
  return null;
}

// Start streaming the primary video to the mini-window over a loopback PC.
async function lrPipStartVideo() {
  var br = _lrPipBridge();
  if (!br || typeof RTCPeerConnection === 'undefined') return;

  var srcStream = _lrPipPickPrimaryStream();
  var vtracks = srcStream && srcStream.getVideoTracks ? srcStream.getVideoTracks() : [];

  if (!srcStream || !vtracks.length) {
    // No video yet (audio-only). Show the mini-window placeholder; we'll retry
    // when a tile appears (lrPipRefreshVideo on tile updates) and also do a few
    // short self-retries in case tiles are still being bound right after open.
    try { br.livePipSendState({ hasVideo: false }); } catch (e) {}
    if (_lrPipIsOpen && _lrPipVideoRetries < 6) {
      _lrPipVideoRetries++;
      setTimeout(function () { if (_lrPipIsOpen) lrPipStartVideo(); }, 700);
    }
    return;
  }
  _lrPipVideoRetries = 0;

  // Fresh peer connection each time (clean state). Empty iceServers — this is a
  // pure localhost loopback between two windows of the same app, so host ICE
  // candidates are enough (no STUN/TURN needed/wanted).
  _lrPipTeardownPC();
  _lrPipPC = new RTCPeerConnection({ iceServers: [] });

  // Forward the ORIGINAL Chime video track directly (more reliable than
  // re-capturing the <video> element, which can yield blank frames if the
  // element is briefly paused/unpainted). Audio stays in the main window.
  _lrPipPC.addTrack(vtracks[0], srcStream);

  // Relay our ICE candidates to the mini (receiver). Send a PLAIN object — an
  // RTCIceCandidate doesn't survive IPC structured-clone intact.
  _lrPipPC.onicecandidate = function (ev) {
    if (ev.candidate) {
      br.livePipSendIce({ to: 'mini', candidate: {
        candidate: ev.candidate.candidate,
        sdpMid: ev.candidate.sdpMid,
        sdpMLineIndex: ev.candidate.sdpMLineIndex,
      }});
    }
  };

  // Wire answer + ICE-from-mini listeners once.
  if (!_lrPipSenderWired) {
    _lrPipSenderWired = true;
    br.onLivePipAnswer(function (sdp) {
      if (_lrPipPC && sdp) {
        try { _lrPipPC.setRemoteDescription(sdp); } catch (e) {}
      }
    });
    br.onLivePipIce(function (candidate) {
      if (_lrPipPC && candidate) {
        try { _lrPipPC.addIceCandidate(candidate); } catch (e) {}
      }
    });
  }

  // Create + send the offer. IMPORTANT: send a PLAIN { type, sdp } object — an
  // RTCSessionDescription does not survive IPC structured-clone intact, which
  // made the receiver's setRemoteDescription fail with "Failed to parse
  // SessionDescription". Sending the primitive fields fixes it.
  try {
    var offer = await _lrPipPC.createOffer();
    await _lrPipPC.setLocalDescription(offer);
    var ld = _lrPipPC.localDescription;
    br.livePipSendOffer({ type: ld.type, sdp: ld.sdp });
    br.livePipSendState({ hasVideo: true });
  } catch (e) {
    _lrPipTeardownPC();
  }
}

// Re-evaluate the primary video (call when tiles change while PiP is open).
function lrPipRefreshVideo() {
  if (!_lrPipWindowOpen()) return;
  lrPipStartVideo();
}

// Is the mini-window currently open? (tracked via lrPipOpen/lrPipClose)
function _lrPipWindowOpen() {
  return _lrPipIsOpen;
}

function lrPipStopVideo() {
  _lrPipTeardownPC();
}

function _lrPipTeardownPC() {
  if (_lrPipPC) {
    try { _lrPipPC.close(); } catch (e) {}
    _lrPipPC = null;
  }
}

// Push the current class state to the mini-window (title/count/mic/cam/rec).
// Reads the globals owned by live-room.js + participants.js — single source of
// truth, no duplicated state.
function lrPipPushState() {
  var br = _lrPipBridge();
  if (!br) return;

  var titleEl = document.getElementById('lr-title');
  var title = titleEl ? titleEl.textContent : 'Live Class';

  var count = 0;
  try {
    if (typeof _lrpPresent !== 'undefined' && _lrpPresent) {
      count = Object.keys(_lrpPresent).length;
    }
  } catch (e) {}

  br.livePipSendState({
    title: title,
    count: count,
    micMuted: (typeof _lrMuted !== 'undefined') ? !!_lrMuted : false,
    camOn: (typeof _lrCamOn !== 'undefined') ? !!_lrCamOn : false,
    recording: (typeof _lrRecording !== 'undefined') ? !!_lrRecording : false,
    status: (typeof _lrConnected !== 'undefined' && _lrConnected) ? 'Live' : 'Connecting…',
  });
}

// Throttled state push — call this whenever something relevant changes.
function lrPipSyncState() {
  if (_lrPipStateTimer) return;
  _lrPipStateTimer = setTimeout(function () {
    _lrPipStateTimer = null;
    lrPipPushState();
  }, 120);
}
