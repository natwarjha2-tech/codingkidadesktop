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
var _lrcReactTopic = 'ck-live-react'; // Chime data-message topic for free-floating class reactions
var _lrcMsgReactTopic = 'ck-live-msg-react'; // Chime topic for PER-MESSAGE reactions (P6)
var _lrcSeen = {};                   // de-dupe map (message id → true)
var _lrcStarted = false;             // subscribed to data messages?
var _lrcMyId = null;                 // current user id (sender identity)

// Per-message reaction aggregate (P6 — WhatsApp-style). Shape:
//   { [messageId]: { counts: { emoji → n }, mine: { emoji → true } } }
// Session-scoped + seeded from history (reactions aggregate on each message DTO)
// so reloads/late-joins show existing reactions. Reset on teardown.
var _lrcReactions = {};

// Live-class reaction set (Phase 3): tuned for a classroom — thumbs up/down,
// raise hand, clap, celebrate, love. SINGLE source of truth: both the top-bar
// reaction bar (_lrcRenderReactionBar) and the per-message mini-picker
// (_lrcEnsureMsgReactPicker) render from this array, so adding one emoji here
// updates BOTH places with no duplication.
var LRC_REACTIONS = ['👍', '👎', '✋', '👏', '🎉', '❤️'];

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
  try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_lrcMsgReactTopic); } catch (e) {}

  _lrcStarted = true;
  _lrcSeen = {};
  _lrcReactions = {};
  _lrcMyId = (typeof _lrCurrentUserId === 'function') ? _lrCurrentUserId() : null;

  _lrcClearMessages();
  _lrcRenderReactionBar();
  _lrcWireInput();

  // Subscribe to incoming chat + reaction data messages (real-time).
  try {
    _lrAV.realtimeSubscribeToReceiveDataMessage(_lrcTopic, _lrcOnChatData);
    _lrAV.realtimeSubscribeToReceiveDataMessage(_lrcReactTopic, _lrcOnReactData);
    _lrAV.realtimeSubscribeToReceiveDataMessage(_lrcMsgReactTopic, _lrcOnMsgReactData);
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
    try { _lrAV.realtimeUnsubscribeFromReceiveDataMessage(_lrcMsgReactTopic); } catch (e) {}
  }
  _lrcStarted = false;
  _lrcSeen = {};
  _lrcReactions = {};
  _lrcMyId = null;
  _lrcCloseMsgReactPicker();

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

// Incoming PER-MESSAGE reaction (P6). Payload: { messageId, reaction, reacted,
// userId }. We apply the remote user's toggle to our local aggregate and
// re-render only THAT message's badge row (not the whole chat) for efficiency.
function _lrcOnMsgReactData(dataMessage) {
  try {
    var r = JSON.parse(dataMessage.text());
    if (!r || !r.messageId || !r.reaction || !r.userId) return;
    _lrcApplyReactionDelta(r.messageId, r.reaction, !!r.reacted, r.userId);
    _lrcRenderMsgReactions(r.messageId);
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

// ── Per-message reactions (P6 — WhatsApp-style) ──────────────────────────────
//
// Any participant can react to a SPECIFIC chat message with one of the same 5
// class reactions (LRC_REACTIONS). Reactions toggle (tap again to remove),
// persist via the existing REST endpoint, and fan out in real-time over a
// dedicated Chime data topic (_lrcMsgReactTopic) so everyone's badges stay in
// sync. State lives in _lrcReactions; badges render under each message bubble.

// Seed a message's reaction aggregate from its history DTO (counts + mine).
// Called from _lrcRenderMessage so reloads/late-joins show existing reactions.
function _lrcSeedReactions(m) {
  if (!m || !m.id || !m.reactions) return;
  var agg = { counts: {}, mine: {} };
  var counts = m.reactions.counts || {};
  Object.keys(counts).forEach(function (emoji) {
    var n = counts[emoji] | 0;
    if (n > 0) agg.counts[emoji] = n;
  });
  var mine = Array.isArray(m.reactions.mine) ? m.reactions.mine : [];
  mine.forEach(function (emoji) { agg.mine[emoji] = true; });
  _lrcReactions[m.id] = agg;
}

// Apply a single toggle delta to the local aggregate. `byMe` marks whether the
// toggling user is the current user (so we can track the `mine` highlight for
// our own reactions; remote users only affect counts).
function _lrcApplyReactionDelta(messageId, emoji, reacted, userId) {
  var agg = _lrcReactions[messageId];
  if (!agg) { agg = { counts: {}, mine: {} }; _lrcReactions[messageId] = agg; }
  var byMe = _lrcMyId && userId === _lrcMyId;

  if (reacted) {
    agg.counts[emoji] = (agg.counts[emoji] || 0) + 1;
    if (byMe) agg.mine[emoji] = true;
  } else {
    agg.counts[emoji] = Math.max(0, (agg.counts[emoji] || 0) - 1);
    if (agg.counts[emoji] === 0) delete agg.counts[emoji];
    if (byMe) delete agg.mine[emoji];
  }
}

// Render (or refresh) the badge row under a single message. Rebuilds just that
// message's `.lr-msg-reactions` container — never the whole chat list.
function _lrcRenderMsgReactions(messageId) {
  var wrap = document.querySelector('.lr-msg[data-mid="' + _lrcCssEscape(messageId) + '"]');
  if (!wrap) return;
  var row = wrap.querySelector('.lr-msg-reactions');
  if (!row) return;

  var agg = _lrcReactions[messageId];
  var counts = agg ? agg.counts : {};
  var emojis = Object.keys(counts);
  if (!emojis.length) { row.innerHTML = ''; row.style.display = 'none'; return; }

  row.innerHTML = '';
  row.style.display = 'flex';
  // Keep a stable order (the LRC_REACTIONS order), then any extras.
  var ordered = LRC_REACTIONS.filter(function (e) { return counts[e] > 0; });
  emojis.forEach(function (e) { if (ordered.indexOf(e) === -1) ordered.push(e); });

  ordered.forEach(function (emoji) {
    var n = counts[emoji];
    var mine = agg && agg.mine && agg.mine[emoji];
    var badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'lr-msg-react-badge' + (mine ? ' mine' : '');
    badge.textContent = emoji + ' ' + n;
    // Tapping a badge toggles your own reaction of that emoji (WhatsApp-style).
    badge.onclick = function (ev) { ev.stopPropagation(); lrcToggleMsgReaction(messageId, emoji); };
    row.appendChild(badge);
  });
}

// Minimal CSS.escape fallback (message ids are uuids, so this is belt-and-braces
// for the attribute selector; avoids a hard dependency on CSS.escape support).
function _lrcCssEscape(s) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
  return String(s).replace(/["\\\]]/g, '\\$&');
}

// Toggle the current user's reaction on a message: optimistic local update +
// badge refresh, real-time broadcast, then REST persist (authoritative). If the
// REST call fails we roll back the optimistic change so state stays truthful.
async function lrcToggleMsgReaction(messageId, emoji) {
  if (!messageId || !emoji || !_lrClassId) return;
  _lrcCloseMsgReactPicker();

  // Current `mine` state decides the next toggle direction.
  var agg = _lrcReactions[messageId];
  var currentlyMine = !!(agg && agg.mine && agg.mine[emoji]);
  var nextReacted = !currentlyMine;

  // 1) Optimistic local apply + badge refresh (instant UX).
  _lrcApplyReactionDelta(messageId, emoji, nextReacted, _lrcMyId);
  _lrcRenderMsgReactions(messageId);

  // 2) Real-time broadcast so other participants update immediately.
  try {
    if (_lrAV) {
      _lrAV.realtimeSendDataMessage(_lrcMsgReactTopic, JSON.stringify({
        messageId: messageId, reaction: emoji, reacted: nextReacted, userId: _lrcMyId,
      }));
    }
  } catch (e) {}

  // 3) Persist (authoritative toggle). The server recomputes the real toggle
  // state; if it disagrees with our optimistic guess, reconcile. On failure,
  // roll back so we never show a reaction that wasn't saved.
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(_lrClassId) + '/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _lrToken() },
      body: JSON.stringify({ messageId: messageId, reaction: emoji }),
    });
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success) throw new Error('react failed');
    // Reconcile if the server's actual state differs from our optimistic one.
    if (typeof data.reacted === 'boolean' && data.reacted !== nextReacted) {
      _lrcApplyReactionDelta(messageId, emoji, data.reacted, _lrcMyId);
      _lrcRenderMsgReactions(messageId);
      try {
        if (_lrAV) {
          _lrAV.realtimeSendDataMessage(_lrcMsgReactTopic, JSON.stringify({
            messageId: messageId, reaction: emoji, reacted: data.reacted, userId: _lrcMyId,
          }));
        }
      } catch (e) {}
    }
  } catch (e) {
    // Roll back the optimistic change (and tell peers) so state stays truthful.
    _lrcApplyReactionDelta(messageId, emoji, currentlyMine, _lrcMyId);
    _lrcRenderMsgReactions(messageId);
    try {
      if (_lrAV) {
        _lrAV.realtimeSendDataMessage(_lrcMsgReactTopic, JSON.stringify({
          messageId: messageId, reaction: emoji, reacted: currentlyMine, userId: _lrcMyId,
        }));
      }
    } catch (e2) {}
  }
}

// ── Per-message reaction mini-picker (the 5 LRC_REACTIONS) ───────────────────
//
// A single reusable popup (one in the DOM, moved next to whichever message's
// react trigger was clicked) — no per-message picker DOM, no duplication.

var _lrcMsgPickerWired = false;

function _lrcEnsureMsgReactPicker() {
  var picker = document.getElementById('lr-msg-react-picker');
  if (picker) return picker;
  picker = document.createElement('div');
  picker.id = 'lr-msg-react-picker';
  picker.className = 'lr-msg-react-picker';
  picker.style.display = 'none';
  LRC_REACTIONS.forEach(function (emoji) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'lr-msg-react-opt';
    b.textContent = emoji;
    b.onclick = function (ev) {
      ev.stopPropagation();
      var mid = picker.getAttribute('data-mid');
      if (mid) lrcToggleMsgReaction(mid, emoji);
    };
    picker.appendChild(b);
  });
  document.body.appendChild(picker);

  // Close on outside click / scroll (wired once).
  if (!_lrcMsgPickerWired) {
    _lrcMsgPickerWired = true;
    document.addEventListener('click', function (ev) {
      var p = document.getElementById('lr-msg-react-picker');
      if (!p || p.style.display === 'none') return;
      if (p.contains(ev.target)) return;
      if (ev.target && ev.target.classList && ev.target.classList.contains('lr-msg-react-trigger')) return;
      _lrcCloseMsgReactPicker();
    }, true);
    var box = document.getElementById('lr-chat-messages');
    if (box) box.addEventListener('scroll', _lrcCloseMsgReactPicker, true);
  }
  return picker;
}

// Open the picker anchored to a message's react trigger button.
function _lrcOpenMsgReactPicker(messageId, anchorEl) {
  var picker = _lrcEnsureMsgReactPicker();
  picker.setAttribute('data-mid', messageId);
  picker.style.display = 'flex';
  // Position just above the trigger, clamped to the viewport.
  var r = anchorEl.getBoundingClientRect();
  var pw = picker.offsetWidth || 190;
  var ph = picker.offsetHeight || 40;
  var left = Math.max(8, Math.min(r.left, window.innerWidth - pw - 8));
  var top = r.top - ph - 6;
  if (top < 8) top = r.bottom + 6; // flip below if no room above
  picker.style.left = left + 'px';
  picker.style.top = top + 'px';
}

function _lrcCloseMsgReactPicker() {
  var picker = document.getElementById('lr-msg-react-picker');
  if (picker) { picker.style.display = 'none'; picker.removeAttribute('data-mid'); }
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

  // Seed this message's reaction aggregate from history (if present) so badges
  // render immediately on reload/late-join (P6).
  _lrcSeedReactions(m);

  var mine = _lrcMyId ? (m.senderId === _lrcMyId) : !!m.isMine;
  var isTeacher = m.senderRole === 'teacher';

  var wrap = document.createElement('div');
  wrap.className = 'lr-msg' + (mine ? ' mine' : '') + (isTeacher ? ' teacher' : '');
  wrap.setAttribute('data-mid', m.id); // anchor for per-message reactions (P6)

  var who = (typeof sanitize === 'function' ? sanitize(m.senderName || 'User') : (m.senderName || 'User'))
    + (isTeacher ? ' · Teacher' : '');
  var text = (typeof sanitize === 'function' ? sanitize(m.message || '') : (m.message || ''));
  // Timestamp (F9) — compact local time next to the sender name. sanitize() so
  // the locale string can never inject markup (defensive; it won't contain any).
  var time = _lrcFormatTime(m.createdAt);
  var timeHtml = time
    ? '<span class="lr-msg-time">' + (typeof sanitize === 'function' ? sanitize(time) : time) + '</span>'
    : '';

  // Bubble + a hover react trigger (😊) that opens the 5-emoji mini-picker (P6),
  // plus an (initially empty) badge row shown under the bubble. The trigger icon
  // uses a static emoji so no extra icon dependency is introduced.
  wrap.innerHTML =
    '<div class="lr-msg-who">' + who + timeHtml + '</div>' +
    '<div class="lr-msg-row">' +
      '<div class="lr-msg-bubble">' + text + '</div>' +
      '<button type="button" class="lr-msg-react-trigger" title="React" aria-label="React">🙂</button>' +
    '</div>' +
    '<div class="lr-msg-reactions" style="display:none"></div>';

  // Wire the react trigger to open the picker anchored to it.
  var trigger = wrap.querySelector('.lr-msg-react-trigger');
  if (trigger) {
    trigger.onclick = function (ev) {
      ev.stopPropagation();
      _lrcOpenMsgReactPicker(m.id, trigger);
    };
  }

  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;

  // Paint any seeded reactions now that the row is in the DOM.
  _lrcRenderMsgReactions(m.id);
}
