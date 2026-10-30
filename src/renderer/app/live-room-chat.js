/**
 * CodingKida Desktop — Live Class in-room Chat + Reactions (ISOLATED feature)
 *
 * B5: real-time chat + emoji reactions INSIDE the live room. Real-time delivery
 * uses Chime SDK Data Messages (the same media connection — micro-second
 * latency, no extra WebSocket server). Durability + late-joiner history use the
 * REST endpoints built in Phase 7:
 *   GET  /api/live/classes/:id/chat        → history (oldest → newest)
 *   POST /api/live/classes/:id/chat        → persist a message
 *   POST /api/live/classes/:id/reactions   → persist a reaction (toggle)
 *
 * Shares the live session via globals from live-room.js (window-scoped vars):
 *   _lrAV (audioVideo facade), _lrClassId, _lrCurrentUserId(), _lrToken().
 * This file is wired by live-room.js (chat start on connect, reset on teardown)
 * so nothing else in the app is touched.
 */

var _lrcTopic = 'ck-live-chat';     // Chime data-message topic for chat
var _lrcReactTopic = 'ck-live-react'; // Chime data-message topic for reactions
var _lrcSeen = {};                   // de-dupe map (message id → true)
var _lrcStarted = false;             // subscribed to data messages?
var _lrcMyId = null;                 // current user id (sender identity)

// Live-class reaction set (Phase 3): tuned for a classroom — thumbs up/down,
// raise hand, clap, celebrate. Shown in the bottom-center reaction dock.
var LRC_REACTIONS = ['👍', '👎', '✋', '👏', '🎉'];

// Called by live-room.js once the Chime session is live. Subscribes to data
// messages, loads history, and wires the input + reaction bar.
//
// Fully RE-ENTRANT across join → leave → rejoin: it binds to whatever the
// CURRENT `_lrAV` session is, and is self-healing even if a prior teardown was
// skipped (e.g. force-remove / PiP-leave paths that null `_lrAV` before
// lrcStop could run). Instead of bailing out when a stale `_lrcStarted` flag is
// left behind, we always re-subscribe fresh on the new session — the standard
// "unsubscribe-then-subscribe" pattern guarantees exactly one live
// subscription (never zero, never doubled).
function lrcStart() {
  if (!_lrAV) return;

  // Defensive: drop any lingering subscriptions on the CURRENT session before
  // (re)subscribing, so a previously-skipped teardown can't leave us either
  // unsubscribed or double-subscribed. Safe no-op if we weren't subscribed.
  try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_lrcTopic); } catch (e) {}
  try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_lrcReactTopic); } catch (e) {}

  _lrcStarted = true;
  _lrcSeen = {};
  _lrcMyId = (typeof _lrCurrentUserId === 'function') ? _lrCurrentUserId() : null;

  _lrcClearMessages();
  _lrcRenderReactionBar();
  _lrcWireInput();

  // Subscribe to incoming chat + reaction data messages (real-time).
  try {
    _lrAV.realtimeSubscribeToReceiveDataMessage(_lrcTopic, _lrcOnChatData);
    _lrAV.realtimeSubscribeToReceiveDataMessage(_lrcReactTopic, _lrcOnReactData);
  } catch (e) {}

  // Load persisted history (also backfills anything a data message missed).
  _lrcLoadHistory();
}

// Called by live-room.js teardown — unsubscribe + reset UI state.
//
// Idempotent + leaves NO stale wiring behind: input/send handlers are cleared
// so no closure keeps a reference to the old (now-stopped) session. The emoji
// picker DOM is intentionally NOT torn down — it is static markup reused across
// rooms (rebuilt only once via the `_lrcEmojiBuilt` guard), so re-tearing it
// would be wasted work; we only hide it. `lrcStart` re-wires everything cleanly
// on the next join.
function lrcStop() {
  if (_lrAV) {
    try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_lrcTopic); } catch (e) {}
    try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_lrcReactTopic); } catch (e) {}
  }
  _lrcStarted = false;
  _lrcSeen = {};
  _lrcMyId = null;

  // Clear input/send handlers so a stale closure can't linger across rejoins.
  // (lrcStart → _lrcWireInput re-attaches fresh handlers on the next join.)
  var input = document.getElementById('lr-chat-text');
  if (input) { input.onkeydown = null; input.value = ''; }
  var sendBtn = document.getElementById('lr-chat-send');
  if (sendBtn) sendBtn.onclick = null;

  _lrcClearMessages();
  _lrcCloseEmojiPicker();
}

// ── History ─────────────────────────────────────────────────────────────────

async function _lrcLoadHistory() {
  if (!_lrClassId) return;
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/chat', {
      headers: { Authorization: 'Bearer ' + _lrToken() },
    });
    var data = await res.json().catch(function () { return {}; });
    if (data && data.success && Array.isArray(data.messages)) {
      data.messages.forEach(function (m) { _lrcRenderMessage(m); });
    }
  } catch (e) {}
}

// ── Incoming data messages ───────────────────────────────────────────────────

function _lrcOnChatData(dataMessage) {
  try {
    var m = JSON.parse(dataMessage.text());
    if (m && m.id) _lrcRenderMessage(m);
  } catch (e) {}
}

function _lrcOnReactData(dataMessage) {
  try {
    var r = JSON.parse(dataMessage.text());
    if (r && r.reaction) _lrcFloatReaction(r.reaction);
  } catch (e) {}
}

// ── Send ─────────────────────────────────────────────────────────────────────

function _lrcWireInput() {
  var input = document.getElementById('lr-chat-text');
  var sendBtn = document.getElementById('lr-chat-send');
  if (sendBtn) sendBtn.onclick = lrcSendMessage;
  if (input) {
    input.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); lrcSendMessage(); }
    };
  }

  // Chat show/hide toggle (top bar). Delegates to the single right-panel
  // controller in live-room.js so chat and participants stay mutually
  // exclusive (one panel open at a time). No local visibility state here.
  var chatToggleBtn = document.getElementById('lr-chat-toggle');
  if (chatToggleBtn) chatToggleBtn.onclick = lrcToggleChat;

  // Emoji picker (Phase 5): 😊 button toggles a native-Unicode picker populated
  // from the local window.CK_EMOJI_GROUPS dataset. Idempotent — safe to call on
  // every room open.
  var emojiBtn = document.getElementById('lr-emoji-btn');
  if (emojiBtn) emojiBtn.onclick = function (e) { e.stopPropagation(); _lrcToggleEmojiPicker(); };

  // Build the picker once (tabs + first category) if not built yet.
  _lrcBuildEmojiPicker();

  // Close the picker on outside click (wired once).
  if (!_lrcOutsideWired) {
    _lrcOutsideWired = true;
    document.addEventListener('click', function (ev) {
      var picker = document.getElementById('lr-emoji-picker');
      var btn = document.getElementById('lr-emoji-btn');
      if (!picker || picker.style.display === 'none') return;
      if ((btn && btn.contains(ev.target)) || picker.contains(ev.target)) return;
      picker.style.display = 'none';
    });
  }
}

// ── Chat show/hide ──────────────────────────────────────────────────────────

// Open the chat in the shared right-panel slot (or toggle it closed). Delegates
// to live-room.js's single controller so chat and participants can never be
// open at the same time. No local visibility/preference state — the controller
// is the single source of truth.
function lrcToggleChat() {
  if (typeof _lrSetRightPanel === 'function') _lrSetRightPanel('chat');
}

// ── Emoji picker ──────────────────────────────────────────────────────────────

var _lrcEmojiBuilt = false;      // picker DOM built?
var _lrcOutsideWired = false;    // outside-click close wired?

// Build the picker's category tabs + render the first category's grid. Reads the
// local dataset (window.CK_EMOJI_GROUPS); no network, no CDN.
function _lrcBuildEmojiPicker() {
  if (_lrcEmojiBuilt) return;
  var tabs = document.getElementById('lr-emoji-tabs');
  var groups = window.CK_EMOJI_GROUPS;
  if (!tabs || !Array.isArray(groups) || groups.length === 0) return;

  tabs.innerHTML = '';
  groups.forEach(function (g, idx) {
    var tab = document.createElement('button');
    tab.className = 'lr-emoji-tab' + (idx === 0 ? ' active' : '');
    tab.type = 'button';
    tab.textContent = g.icon;
    tab.title = g.name;
    tab.onclick = function (e) { e.stopPropagation(); _lrcShowEmojiCategory(idx); };
    tabs.appendChild(tab);
  });

  _lrcShowEmojiCategory(0);
  _lrcEmojiBuilt = true;
}

// Render one category's emojis into the grid + mark its tab active.
function _lrcShowEmojiCategory(idx) {
  var grid = document.getElementById('lr-emoji-grid');
  var groups = window.CK_EMOJI_GROUPS;
  if (!grid || !groups || !groups[idx]) return;

  var tabs = document.querySelectorAll('#lr-emoji-tabs .lr-emoji-tab');
  tabs.forEach(function (t, i) {
    if (i === idx) t.classList.add('active'); else t.classList.remove('active');
  });

  grid.innerHTML = '';
  groups[idx].emojis.forEach(function (emoji) {
    var cell = document.createElement('button');
    cell.className = 'lr-emoji-cell';
    cell.type = 'button';
    cell.textContent = emoji;
    cell.onclick = function (e) { e.stopPropagation(); _lrcInsertEmoji(emoji); };
    grid.appendChild(cell);
  });
}

function _lrcToggleEmojiPicker() {
  var picker = document.getElementById('lr-emoji-picker');
  if (!picker) return;
  if (picker.style.display === 'none' || !picker.style.display) {
    _lrcBuildEmojiPicker();
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

// Insert an emoji into the chat input at the caret position (keeps text + emoji
// together), then refocus so the user can keep typing. The picker stays open so
// multiple emojis can be added quickly (standard chat UX).
function _lrcInsertEmoji(emoji) {
  var input = document.getElementById('lr-chat-text');
  if (!input) return;
  var start = (typeof input.selectionStart === 'number') ? input.selectionStart : input.value.length;
  var end = (typeof input.selectionEnd === 'number') ? input.selectionEnd : input.value.length;
  var before = input.value.slice(0, start);
  var after = input.value.slice(end);
  var next = before + emoji + after;

  // Respect the input's maxlength so a long burst can't overflow it.
  var max = parseInt(input.getAttribute('maxlength') || '0', 10);
  if (max > 0 && next.length > max) return;

  input.value = next;
  var caret = start + emoji.length;
  input.focus();
  try { input.setSelectionRange(caret, caret); } catch (e) {}
}

// Close the picker (used on teardown so it never lingers across rooms).
function _lrcCloseEmojiPicker() {
  var picker = document.getElementById('lr-emoji-picker');
  if (picker) picker.style.display = 'none';
}

async function lrcSendMessage() {
  var input = document.getElementById('lr-chat-text');
  if (!input) return;
  var text = (input.value || '').trim();
  if (!text || !_lrClassId) return;
  input.value = '';

  // 1) Persist via REST (authoritative — gives us the stored message + id).
  var saved = null;
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      body: JSON.stringify({ message: text }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (data && data.success && data.message) saved = data.message;
  } catch (e) {}

  if (!saved) {
    // Save failed — restore the text so the user can retry (nothing lost) +
    // clearly signal the failure (F17): a non-blocking notice (Phase 1 reuse)
    // plus a shake + red border on the input so it's obvious the message did
    // NOT send. The visual cue auto-clears so it never lingers.
    input.value = text;
    if (typeof _lrNotice === 'function') {
      _lrNotice('Message not sent — check your connection and try again.', 'error');
    }
    _lrcFlagSendError();
    return;
  }

  // 2) Show locally immediately.
  _lrcRenderMessage(saved);

  // 3) Broadcast to everyone else in real-time via a Chime data message.
  try {
    if (_lrAV) _lrAV.realtimeSendDataMessage(_lrcTopic, JSON.stringify(saved));
  } catch (e) {}
}

// ── Reactions ────────────────────────────────────────────────────────────────

function _lrcRenderReactionBar() {
  var bar = document.getElementById('lr-chat-reactions');
  if (!bar) return;
  bar.innerHTML = '';
  LRC_REACTIONS.forEach(function (emoji) {
    var btn = document.createElement('button');
    btn.className = 'lr-react-btn';
    btn.textContent = emoji;
    btn.onclick = function () { lrcSendReaction(emoji); };
    bar.appendChild(btn);
  });
}

function lrcSendReaction(emoji) {
  if (!emoji || !_lrClassId) return;

  // Show locally right away.
  _lrcFloatReaction(emoji);

  // Broadcast real-time (best-effort).
  try {
    if (_lrAV) _lrAV.realtimeSendDataMessage(_lrcReactTopic, JSON.stringify({ reaction: emoji }));
  } catch (e) {}

  // Persist (best-effort; toggle semantics handled server-side). We don't need
  // a messageId for a free-floating class reaction, so we skip REST if the
  // backend requires one — the real-time float is the primary UX. Persistence
  // of per-message reactions is used elsewhere; here we keep it lightweight.
}

function _lrcFloatReaction(emoji) {
  var el = document.createElement('div');
  el.className = 'lr-react-float';
  el.textContent = emoji;
  // Rises from the bottom-center (position handled by CSS: left:50% + translateX).
  // A small random horizontal jitter keeps bursts of reactions lively without
  // overriding the CSS centering transform.
  el.style.marginLeft = (Math.floor(Math.random() * 120) - 60) + 'px';
  document.body.appendChild(el);
  setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 2100);
}

// ── Rendering ────────────────────────────────────────────────────────────────

// Format a message's ISO timestamp as a compact local time (e.g. "4:32 PM").
// Native, locale-aware, no date library. Returns '' for a missing/invalid time
// so render never breaks on an older row without createdAt.
function _lrcFormatTime(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch (e) { return ''; }
}

// Visual send-failure cue (F17): shake the chat input + flash a red border,
// then auto-clear so it never sticks. Idempotent — restarting the animation if
// a second failure happens quickly.
function _lrcFlagSendError() {
  var input = document.getElementById('lr-chat-text');
  if (!input) return;
  input.classList.remove('send-error');
  // Force a reflow so re-adding the class restarts the CSS animation.
  void input.offsetWidth;
  input.classList.add('send-error');
  setTimeout(function () { input.classList.remove('send-error'); }, 1200);
}

function _lrcClearMessages() {
  var box = document.getElementById('lr-chat-messages');
  if (box) box.innerHTML = '<div class="lr-chat-empty" id="lr-chat-empty">No messages yet. Say hello! 👋</div>';
}

function _lrcRenderMessage(m) {
  if (!m || !m.id || _lrcSeen[m.id]) return;
  _lrcSeen[m.id] = true;

  var box = document.getElementById('lr-chat-messages');
  if (!box) return;
  var emptyEl = document.getElementById('lr-chat-empty');
  if (emptyEl) emptyEl.remove();

  var mine = _lrcMyId ? (m.senderId === _lrcMyId) : !!m.isMine;
  var isTeacher = m.senderRole === 'teacher';

  var wrap = document.createElement('div');
  wrap.className = 'lr-msg' + (mine ? ' mine' : '') + (isTeacher ? ' teacher' : '');

  var who = (typeof sanitize === 'function' ? sanitize(m.senderName || 'User') : (m.senderName || 'User'))
    + (isTeacher ? ' · Teacher' : '');
  var text = (typeof sanitize === 'function' ? sanitize(m.message || '') : (m.message || ''));
  // Timestamp (F9) — compact local time next to the sender name. sanitize() so
  // the locale string can never inject markup (defensive; it won't contain any).
  var time = _lrcFormatTime(m.createdAt);
  var timeHtml = time
    ? '<span class="lr-msg-time">' + (typeof sanitize === 'function' ? sanitize(time) : time) + '</span>'
    : '';

  wrap.innerHTML =
    '<div class="lr-msg-who">' + who + timeHtml + '</div>' +
    '<div class="lr-msg-bubble">' + text + '</div>';

  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}
