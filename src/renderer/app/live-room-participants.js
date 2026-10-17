/**
 * CodingKida Desktop — Live Class Participants panel (ISOLATED feature)
 *
 * Phase 6: a Zoom-style roster — shows everyone currently in the class with
 * their name + profile image + a live count, plus transient "X joined / X left"
 * toasts. Driven by two sources that complement each other:
 *
 *   1) REAL-TIME presence — Chime's `realtimeSubscribeToAttendeeIdPresence`
 *      fires the instant an attendee joins/leaves (no polling). This is the
 *      source of truth for who is present + the live count.
 *   2) IDENTITY (name + avatar) — resolved from the backend roster endpoint
 *      GET /api/live/classes/:id/participants (server-derived; never trusted
 *      from the client). The roster is (re)fetched on start and whenever a
 *      newly-present attendee isn't yet known, so names/images fill in quickly.
 *
 * Shares the live session via globals from live-room.js: _lrAV (audioVideo),
 * _lrClassId, _lrCurrentUserId(), _lrToken(), _lrHostUserId. Wired by
 * live-room.js (start on connect, stop on teardown) so nothing else is touched.
 */

var _LRP_MOD_TOPIC = 'ck-live-mod'; // Chime data-message topic for host moderation

var _lrpStarted = false;      // subscribed to presence?
var _lrpPresent = {};         // userId -> true (currently present)
var _lrpInfo = {};            // userId -> { name, avatarUrl, role }
var _lrpPresenceCb = null;    // the presence callback (to unsubscribe cleanly)
var _lrpMyId = null;          // current user id
var _lrpFetchTimer = null;    // debounce roster refetch
var _lrpBulk = { audio: false, video: false, chat: false }; // host "all blocked" state
var _lrpKebabOutsideWired = false; // outside-click close for ⋮ menus wired?
var _lrpRejoinPollTimer = null;    // host poll for rejoin requests
var _lrpRejoinPrompting = {};      // userIds currently being prompted (avoid dup popups)

// Chime content-share attendees use a "<userId>#content" externalUserId — they
// are not real people, so we strip the suffix / skip them in the roster.
function _lrpBaseUserId(externalUserId) {
  if (!externalUserId) return '';
  var hash = externalUserId.indexOf('#content');
  return hash === -1 ? externalUserId : externalUserId.slice(0, hash);
}
function _lrpIsContent(externalUserId) {
  return !!externalUserId && externalUserId.indexOf('#content') !== -1;
}

// Called by live-room.js once the Chime session is live.
function lrpStart() {
  if (!_lrAV || _lrpStarted) return;
  _lrpStarted = true;
  _lrpPresent = {};
  _lrpInfo = {};
  _lrpMyId = (typeof _lrCurrentUserId === 'function') ? _lrCurrentUserId() : null;

  _lrpWireControls();

  // Subscribe to real-time attendee presence (join/leave).
  // NOTE: Chime marks a SCREEN-SHARE (content) attendee with "#content" in its
  // ATTENDEE ID (not always in the externalUserId). We pass both so the handler
  // can skip the content pseudo-attendee — otherwise stopping a screen-share
  // fires a "leave" that gets mistaken for the host leaving, dropping the count
  // to 0. This was the "count → 0 on share stop" bug.
  _lrpPresenceCb = function (attendeeId, present, externalUserId, dropped) {
    try { _lrpOnPresence(externalUserId, present, attendeeId); } catch (e) {}
  };
  try {
    _lrAV.realtimeSubscribeToAttendeeIdPresence(_lrpPresenceCb);
  } catch (e) {}

  // Host moderation (Phase 7): listen for mod commands broadcast by the host.
  try {
    _lrAV.realtimeSubscribeToReceiveDataMessage(_LRP_MOD_TOPIC, _lrpOnModData);
  } catch (e) {}

  // Initial roster (names + avatars for anyone already here).
  _lrpFetchRoster();

  // Host only: poll for rejoin requests from removed users (Phase 4). A removed
  // user is OUTSIDE the meeting, so they can't signal via Chime data messages —
  // the host polls a small REST endpoint and shows an Accept/Reject prompt.
  if (_lrpIAmHost()) _lrpStartRejoinPoll();
}

// Called by live-room.js teardown — unsubscribe + reset.
function lrpStop() {
  if (_lrAV && _lrpPresenceCb) {
    try { _lrAV.realtimeUnsubscribeToAttendeeIdPresence(_lrpPresenceCb); } catch (e) {}
  }
  if (_lrAV) {
    try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_LRP_MOD_TOPIC); } catch (e) {}
  }
  _lrpPresenceCb = null;
  _lrpStarted = false;
  _lrpPresent = {};
  _lrpInfo = {};
  _lrpMyId = null;
  _lrpBulk = { audio: false, video: false, chat: false };
  if (_lrpFetchTimer) { clearTimeout(_lrpFetchTimer); _lrpFetchTimer = null; }
  _lrpStopRejoinPoll();

  var panel = document.getElementById('lr-people');
  if (panel) panel.style.display = 'none';
  var list = document.getElementById('lr-people-list');
  if (list) list.innerHTML = '';
  _lrpUpdateCount();
}

// ── Controls (toggle panel) ───────────────────────────────────────────────────

function _lrpWireControls() {
  var btn = document.getElementById('lr-people-btn');
  var closeBtn = document.getElementById('lr-people-close');
  if (btn) btn.onclick = _lrpTogglePanel;
  if (closeBtn) closeBtn.onclick = function () {
    var panel = document.getElementById('lr-people');
    if (panel) panel.style.display = 'none';
  };

  // Bulk host-moderation controls — host only.
  var bulk = document.getElementById('lr-people-bulk');
  if (bulk) bulk.style.display = _lrpIAmHost() ? 'flex' : 'none';
  var ba = document.getElementById('lr-bulk-audio');
  var bv = document.getElementById('lr-bulk-video');
  var bc = document.getElementById('lr-bulk-chat');
  if (ba) ba.onclick = function () { _lrpToggleBulk('audio'); };
  if (bv) bv.onclick = function () { _lrpToggleBulk('video'); };
  if (bc) bc.onclick = function () { _lrpToggleBulk('chat'); };

  // Bottom-left host moderation dock — same bulk actions, always visible to the
  // host (no panel needed). Reuses _lrpToggleBulk, so zero duplicated logic.
  var dock = document.getElementById('lr-moddock');
  if (dock) dock.style.display = _lrpIAmHost() ? 'flex' : 'none';
  var da = document.getElementById('lr-moddock-audio');
  var dv = document.getElementById('lr-moddock-video');
  var dc = document.getElementById('lr-moddock-chat');
  if (da) da.onclick = function () { _lrpToggleBulk('audio'); };
  if (dv) dv.onclick = function () { _lrpToggleBulk('video'); };
  if (dc) dc.onclick = function () { _lrpToggleBulk('chat'); };

  // Close any open three-dot menu when clicking elsewhere (wired once).
  if (!_lrpKebabOutsideWired) {
    _lrpKebabOutsideWired = true;
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest || !ev.target.closest('.lr-kebab')) _lrpCloseAllKebabs();
    });
  }

  _lrpSyncBulkButtons();
}

function _lrpTogglePanel() {
  var panel = document.getElementById('lr-people');
  if (!panel) return;
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'flex';
    _lrpRenderList();
    _lrpFetchRoster(); // refresh identities when opened
  } else {
    panel.style.display = 'none';
  }
}

// ── Presence (real-time join/leave) ────────────────────────────────────────────

function _lrpOnPresence(externalUserId, present, attendeeId) {
  // Skip the screen-share (content) pseudo-attendee. Chime tags it with
  // "#content" in the attendeeId and/or externalUserId — check BOTH so stopping
  // a share never looks like the host leaving.
  if (_lrpIsContent(externalUserId) || _lrpIsContent(attendeeId)) return;
  var userId = _lrpBaseUserId(externalUserId);
  if (!userId) return;

  var wasPresent = !!_lrpPresent[userId];

  if (present) {
    _lrpPresent[userId] = true;
    if (!wasPresent) {
      // New arrival. If we don't know their name yet, fetch the roster (debounced)
      // and show the toast once we have a label (fallback to a generic one).
      if (!_lrpInfo[userId]) {
        _lrpScheduleRoster();
        _lrpToast(_lrpLabel(userId) + ' joined', 'join');
      } else {
        _lrpToast(_lrpLabel(userId) + ' joined', 'join');
      }
    }
  } else {
    if (wasPresent) {
      delete _lrpPresent[userId];
      _lrpToast(_lrpLabel(userId) + ' left', 'leave');
    }
  }

  _lrpRenderList();
  _lrpUpdateCount();
}

function _lrpLabel(userId) {
  if (userId === _lrpMyId) return 'You';
  var info = _lrpInfo[userId];
  return (info && info.name) ? info.name : 'A participant';
}

// ── Roster (identity) ──────────────────────────────────────────────────────────

function _lrpScheduleRoster() {
  if (_lrpFetchTimer) return;
  _lrpFetchTimer = setTimeout(function () {
    _lrpFetchTimer = null;
    _lrpFetchRoster();
  }, 600);
}

async function _lrpFetchRoster() {
  if (!_lrpStarted || !_lrClassId) return;
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/participants', {
      headers: { Authorization: 'Bearer ' + _lrToken() },
    });
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success || !Array.isArray(data.participants)) return;

    data.participants.forEach(function (p) {
      if (!p || !p.userId) return;
      _lrpInfo[p.userId] = {
        name: p.name || 'Participant',
        avatarUrl: p.avatarUrl || null,
        role: p.role || 'student',
        audioBlocked: !!p.audioBlocked,
        videoBlocked: !!p.videoBlocked,
        chatBlocked: !!p.chatBlocked,
      };
      // The roster reflects who the server believes is present → seed presence
      // for anyone the real-time events may have missed (e.g. we joined late).
      _lrpPresent[p.userId] = true;
    });

    // Re-apply any moderation that targets ME (covers a late join / reload: the
    // host may have blocked me before I connected). Server state is the source
    // of truth; this makes the client reflect it.
    if (_lrpMyId && _lrpInfo[_lrpMyId]) {
      _lrpApplyModerationToSelf('audio', _lrpInfo[_lrpMyId].audioBlocked);
      _lrpApplyModerationToSelf('video', _lrpInfo[_lrpMyId].videoBlocked);
      _lrpApplyModerationToSelf('chat', _lrpInfo[_lrpMyId].chatBlocked);
    }

    _lrpRenderList();
    _lrpUpdateCount();
  } catch (e) {}
}

// ── Rendering ───────────────────────────────────────────────────────────────────

function _lrpRenderList() {
  var list = document.getElementById('lr-people-list');
  if (!list) return;

  var ids = Object.keys(_lrpPresent);
  // Sort: host/teacher first, then "You", then alphabetical by name.
  ids.sort(function (a, b) {
    var ra = _lrpIsHostId(a) ? 0 : 1, rb = _lrpIsHostId(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    var ya = (a === _lrpMyId) ? 0 : 1, yb = (b === _lrpMyId) ? 0 : 1;
    if (ya !== yb) return ya - yb;
    return _lrpLabel(a).localeCompare(_lrpLabel(b));
  });

  list.innerHTML = '';
  ids.forEach(function (userId) {
    var info = _lrpInfo[userId] || {};
    var isHost = _lrpIsHostId(userId);
    var mine = (userId === _lrpMyId);
    var name = mine ? ((info.name || 'You')) : (info.name || 'Participant');
    var displayName = name + (mine ? ' (You)' : '');

    var row = document.createElement('div');
    row.className = 'lr-person';

    var avatar = document.createElement('div');
    avatar.className = 'lr-person-avatar';
    if (info.avatarUrl) {
      var img = document.createElement('img');
      img.src = info.avatarUrl;
      img.alt = '';
      img.onerror = function () { // fall back to initial if the image fails
        avatar.textContent = (name[0] || '?').toUpperCase();
        if (img.parentNode) img.parentNode.removeChild(img);
      };
      avatar.appendChild(img);
    } else {
      avatar.textContent = (name[0] || '?').toUpperCase();
    }

    var nameEl = document.createElement('span');
    nameEl.className = 'lr-person-name';
    nameEl.textContent = (typeof sanitize === 'function') ? sanitize(displayName) : displayName;

    row.appendChild(avatar);
    row.appendChild(nameEl);

    if (isHost) {
      var badge = document.createElement('span');
      badge.className = 'lr-person-badge';
      badge.textContent = 'Host';
      row.appendChild(badge);
    }

    // Per-participant three-dot (⋮) menu — HOST only, for OTHER participants.
    // Contains per-user audio/video/chat toggles + force-remove. Bulk controls
    // stay in the header/dock; this is the individual control (Phase 4).
    if (_lrpIAmHost() && !mine && !isHost) {
      row.appendChild(_lrpBuildKebab(userId, info));
    }

    list.appendChild(row);
  });

  if (ids.length === 0) {
    list.innerHTML = '<div class="lr-people-empty">No one here yet.</div>';
  }
}

function _lrpIsHostId(userId) {
  return !!(typeof _lrHostUserId !== 'undefined' && _lrHostUserId && userId === _lrHostUserId);
}

function _lrpUpdateCount() {
  var n = Object.keys(_lrpPresent).length;
  var c1 = document.getElementById('lr-people-count');
  var c2 = document.getElementById('lr-people-head-count');
  if (c1) c1.textContent = String(n);
  if (c2) c2.textContent = String(n);
  // Keep the PiP mini-window's participant count in sync (Step 2). No-op if the
  // mini-window is closed or the bridge isn't present.
  if (typeof lrPipSyncState === 'function') lrPipSyncState();
}

// ── Toasts ("X joined / X left") ────────────────────────────────────────────────

function _lrpToast(text, kind) {
  var dock = document.getElementById('lr-people-toasts');
  if (!dock) return;
  var el = document.createElement('div');
  el.className = 'lr-people-toast' + (kind ? ' ' + kind : '');
  el.textContent = (typeof sanitize === 'function') ? sanitize(text) : text;
  dock.appendChild(el);
  setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 3200);
}

// ── Host moderation (Phase 7) ──────────────────────────────────────────────────

// Am I the host of this class? (reuses live-room.js globals set on open)
function _lrpIAmHost() {
  return !!(typeof _lrIsHost !== 'undefined' && _lrIsHost);
}

// Incoming moderation command (received by ALL clients). Two shapes:
//   { scope:'all', type, blocked }                 → applies to everyone
//   { targetUserId, type, blocked }                → applies to one user
// Everyone updates their roster view; the affected user(s) additionally enforce
// it on their own A/V + chat. (Per-user shape is still handled so the backend
// per-participant endpoint can be re-enabled later with zero client changes.)
function _lrpOnModData(dataMessage) {
  var p;
  try { p = JSON.parse(dataMessage.text()); } catch (e) { return; }
  if (!p) return;

  // Force-remove (Phase 4): host removed someone. Everyone drops them from the
  // roster; the TARGET additionally leaves the class immediately.
  if (p.action === 'removed' && p.targetUserId) {
    delete _lrpPresent[p.targetUserId];
    _lrpRenderList();
    _lrpUpdateCount();
    if (_lrpMyId && p.targetUserId === _lrpMyId) {
      try { alert('The host has removed you from this class.'); } catch (e) {}
      if (typeof leaveLiveRoom === 'function') { try { leaveLiveRoom(); } catch (e) {} }
    }
    return;
  }

  if (!p.type) return;

  if (p.scope === 'all') {
    // Update every known participant's flag + enforce on self.
    Object.keys(_lrpInfo).forEach(function (uid) {
      if (p.type === 'audio') _lrpInfo[uid].audioBlocked = !!p.blocked;
      if (p.type === 'video') _lrpInfo[uid].videoBlocked = !!p.blocked;
      if (p.type === 'chat') _lrpInfo[uid].chatBlocked = !!p.blocked;
    });
    _lrpRenderList();
    _lrpSyncBulkButtons();
    // The host never blocks themselves — only non-hosts enforce it.
    if (_lrpMyId && !_lrpIAmHost()) _lrpApplyModerationToSelf(p.type, !!p.blocked);
    return;
  }

  if (!p.targetUserId) return;
  if (_lrpInfo[p.targetUserId]) {
    if (p.type === 'audio') _lrpInfo[p.targetUserId].audioBlocked = !!p.blocked;
    if (p.type === 'video') _lrpInfo[p.targetUserId].videoBlocked = !!p.blocked;
    if (p.type === 'chat') _lrpInfo[p.targetUserId].chatBlocked = !!p.blocked;
    _lrpRenderList();
  }
  if (_lrpMyId && p.targetUserId === _lrpMyId) {
    _lrpApplyModerationToSelf(p.type, !!p.blocked);
  }
}

// Enforce a moderation decision on the LOCAL user (the target). Audio/video are
// enforced via the live-room.js helpers; chat by disabling the input. The
// corresponding control button is also locked so the user can't re-enable what
// the host disabled.
function _lrpApplyModerationToSelf(type, blocked) {
  if (type === 'chat') {
    var input = document.getElementById('lr-chat-text');
    var sendBtn = document.getElementById('lr-chat-send');
    if (input) {
      input.disabled = blocked;
      input.placeholder = blocked ? 'Chat disabled by host' : 'Type a message…';
    }
    if (sendBtn) sendBtn.disabled = blocked;
    _lrpToast(blocked ? 'Host turned off your chat' : 'Host turned on your chat', blocked ? 'leave' : 'join');
    return;
  }

  if (type === 'audio') {
    // Force-mute + lock the mic button when blocked; just unlock when allowed.
    if (blocked && typeof _lrForceMuteLocalAudio === 'function') _lrForceMuteLocalAudio();
    if (typeof _lrSetMicLocked === 'function') _lrSetMicLocked(blocked);
    _lrpToast(blocked ? 'Host muted your mic' : 'Host unmuted your mic', blocked ? 'leave' : 'join');
    return;
  }

  if (type === 'video') {
    // Force camera off + lock when blocked; just unlock when allowed.
    if (blocked && typeof _lrForceStopLocalVideo === 'function') _lrForceStopLocalVideo();
    if (typeof _lrSetCamLocked === 'function') _lrSetCamLocked(blocked);
    _lrpToast(blocked ? 'Host turned off your camera' : 'Host allowed your camera', blocked ? 'leave' : 'join');
    return;
  }
}

// ── Bulk moderation (all participants) ─────────────────────────────────────────

// Host action: toggle audio/video/chat for EVERYONE. One backend call
// (updateMany) + one broadcast ({scope:'all'}) — scales to any class size.
async function _lrpToggleBulk(type) {
  if (!_lrpIAmHost() || !_lrClassId) return;
  var blocked = !_lrpBulk[type]; // flip the current "all blocked" state
  var btn = document.getElementById('lr-bulk-' + type);
  if (btn) btn.disabled = true;

  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/moderate-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      body: JSON.stringify({ type: type, blocked: blocked }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success) {
      alert('⚠️ ' + ((data && data.message) || 'Could not update participants.'));
      return;
    }

    _lrpBulk[type] = blocked;

    // Reflect on every known participant locally + resync button labels.
    Object.keys(_lrpInfo).forEach(function (uid) {
      if (type === 'audio') _lrpInfo[uid].audioBlocked = blocked;
      if (type === 'video') _lrpInfo[uid].videoBlocked = blocked;
      if (type === 'chat') _lrpInfo[uid].chatBlocked = blocked;
    });
    _lrpSyncBulkButtons();

    // One broadcast → every client enforces/updates (non-hosts enforce on self).
    try {
      if (_lrAV) {
        _lrAV.realtimeSendDataMessage(_LRP_MOD_TOPIC, JSON.stringify({
          scope: 'all', type: type, blocked: blocked,
        }));
      }
    } catch (e) {}
  } catch (e) {
    alert('⚠️ Something went wrong updating participants.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Per-participant three-dot (⋮) menu (Phase 4) ───────────────────────────────

// Build the ⋮ button + its dropdown for one participant row (host only).
function _lrpBuildKebab(userId, info) {
  var wrap = document.createElement('div');
  wrap.className = 'lr-kebab';

  var btn = document.createElement('button');
  btn.className = 'lr-kebab-btn';
  btn.type = 'button';
  btn.title = 'Participant options';
  btn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';

  var menu = document.createElement('div');
  menu.className = 'lr-kebab-menu';
  menu.style.display = 'none';

  function item(label, icon, onClick, danger) {
    var el = document.createElement('button');
    el.className = 'lr-kebab-item' + (danger ? ' danger' : '');
    el.type = 'button';
    el.innerHTML = '<i class="fas ' + icon + '"></i> ' + label;
    el.onclick = function (e) {
      e.stopPropagation();
      menu.style.display = 'none';
      onClick();
    };
    return el;
  }

  menu.appendChild(item(
    info.audioBlocked ? 'Unmute audio' : 'Mute audio',
    info.audioBlocked ? 'fa-microphone-slash' : 'fa-microphone',
    function () { _lrpModerateOne(userId, 'audio', !info.audioBlocked); }
  ));
  menu.appendChild(item(
    info.videoBlocked ? 'Allow video' : 'Disable video',
    info.videoBlocked ? 'fa-video-slash' : 'fa-video',
    function () { _lrpModerateOne(userId, 'video', !info.videoBlocked); }
  ));
  menu.appendChild(item(
    info.chatBlocked ? 'Allow chat' : 'Disable chat',
    info.chatBlocked ? 'fa-comment-slash' : 'fa-comment',
    function () { _lrpModerateOne(userId, 'chat', !info.chatBlocked); }
  ));
  menu.appendChild(item('Remove from class', 'fa-user-slash',
    function () { _lrpRemoveOne(userId); }, true));

  btn.onclick = function (e) {
    e.stopPropagation();
    // Close any other open menu first, then toggle this one.
    var open = menu.style.display !== 'none';
    _lrpCloseAllKebabs();
    menu.style.display = open ? 'none' : 'block';
  };

  wrap.appendChild(btn);
  wrap.appendChild(menu);
  return wrap;
}

function _lrpCloseAllKebabs() {
  var menus = document.querySelectorAll('.lr-kebab-menu');
  menus.forEach(function (m) { m.style.display = 'none'; });
}

// Per-participant moderate: POST + broadcast (reuses the same mod topic/handler
// as bulk — a per-user payload, not scope:'all').
async function _lrpModerateOne(targetUserId, type, blocked) {
  if (!_lrpIAmHost() || !_lrClassId) return;
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      body: JSON.stringify({ targetUserId: targetUserId, type: type, blocked: blocked }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success) { alert('⚠️ ' + ((data && data.message) || 'Could not update participant.')); return; }

    if (_lrpInfo[targetUserId]) {
      if (type === 'audio') _lrpInfo[targetUserId].audioBlocked = blocked;
      if (type === 'video') _lrpInfo[targetUserId].videoBlocked = blocked;
      if (type === 'chat') _lrpInfo[targetUserId].chatBlocked = blocked;
    }
    _lrpRenderList();
    try {
      if (_lrAV) _lrAV.realtimeSendDataMessage(_LRP_MOD_TOPIC, JSON.stringify({ targetUserId: targetUserId, type: type, blocked: blocked }));
    } catch (e) {}
  } catch (e) {
    alert('⚠️ Something went wrong updating the participant.');
  }
}

// ── Rejoin approval (host side, Phase 4) ───────────────────────────────────────

function _lrpStartRejoinPoll() {
  if (_lrpRejoinPollTimer) return;
  _lrpRejoinPrompting = {};
  var poll = function () {
    if (!_lrpStarted || !_lrpIAmHost() || !_lrClassId) return;
    fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/rejoin-requests', {
      headers: { Authorization: 'Bearer ' + _lrToken() },
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.success || !Array.isArray(data.requests)) return;
        data.requests.forEach(function (req) { _lrpPromptRejoin(req); });
      })
      .catch(function () {});
  };
  poll();
  _lrpRejoinPollTimer = setInterval(poll, 5000);
}

function _lrpStopRejoinPoll() {
  if (_lrpRejoinPollTimer) { clearInterval(_lrpRejoinPollTimer); _lrpRejoinPollTimer = null; }
  _lrpRejoinPrompting = {};
}

// Show a single Accept/Reject prompt per pending request (no duplicates).
function _lrpPromptRejoin(req) {
  if (!req || !req.userId || _lrpRejoinPrompting[req.userId]) return;
  _lrpRejoinPrompting[req.userId] = true;

  var name = req.name || 'A participant';
  // confirm() is modal + blocking which is fine here (one request at a time).
  var accept = confirm('"' + name + '" wants to rejoin the class.\n\nOK = Accept    Cancel = Reject');
  fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/rejoin-respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
    body: JSON.stringify({ targetUserId: req.userId, accept: accept }),
  })
    .then(function (r) { return r.json(); })
    .then(function () {
      _lrpToast(name + (accept ? ' can rejoin' : ' was not allowed back'), accept ? 'join' : 'leave');
    })
    .catch(function () {})
    .finally(function () {
      // Clear the prompt guard after a moment so a fresh request can re-prompt.
      setTimeout(function () { delete _lrpRejoinPrompting[req.userId]; }, 3000);
    });
}

// Force-remove a participant: POST + broadcast a 'removed' signal so the target
// leaves immediately.
async function _lrpRemoveOne(targetUserId) {
  if (!_lrpIAmHost() || !_lrClassId) return;
  var who = (_lrpInfo[targetUserId] && _lrpInfo[targetUserId].name) || 'this participant';
  if (!confirm('Remove ' + who + ' from the class?')) return;
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      body: JSON.stringify({ targetUserId: targetUserId }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success) { alert('⚠️ ' + ((data && data.message) || 'Could not remove participant.')); return; }

    // Local: drop them + broadcast so their client leaves immediately.
    delete _lrpPresent[targetUserId];
    _lrpRenderList();
    _lrpUpdateCount();
    try {
      if (_lrAV) _lrAV.realtimeSendDataMessage(_LRP_MOD_TOPIC, JSON.stringify({ action: 'removed', targetUserId: targetUserId }));
    } catch (e) {}
  } catch (e) {
    alert('⚠️ Something went wrong removing the participant.');
  }
}

// Keep the bulk buttons' label + state in sync with _lrpBulk.
function _lrpSyncBulkButtons() {
  var map = {
    audio: { on: '<i class="fas fa-microphone-slash"></i> Unmute all', off: '<i class="fas fa-microphone"></i> Mute all' },
    video: { on: '<i class="fas fa-video"></i> Allow video', off: '<i class="fas fa-video-slash"></i> Stop video' },
    chat: { on: '<i class="fas fa-comment"></i> Allow chat', off: '<i class="fas fa-comment-slash"></i> Mute chat' },
  };
  // Icons for the compact bottom-left dock (icon-only; blocked = slashed + red).
  var dockIcons = {
    audio: { on: 'fa-microphone-slash', off: 'fa-microphone' },
    video: { on: 'fa-video-slash', off: 'fa-video' },
    chat: { on: 'fa-comment-slash', off: 'fa-comment' },
  };

  ['audio', 'video', 'chat'].forEach(function (type) {
    var blocked = !!_lrpBulk[type];

    // Panel header bulk buttons (labelled).
    var btn = document.getElementById('lr-bulk-' + type);
    if (btn) {
      btn.innerHTML = blocked ? map[type].on : map[type].off;
      if (blocked) btn.classList.add('active'); else btn.classList.remove('active');
    }

    // Bottom-left dock buttons (icon-only).
    var dockBtn = document.getElementById('lr-moddock-' + type);
    if (dockBtn) {
      dockBtn.innerHTML = '<i class="fas ' + (blocked ? dockIcons[type].on : dockIcons[type].off) + '"></i>';
      if (blocked) dockBtn.classList.add('active'); else dockBtn.classList.remove('active');
    }
  });
}
