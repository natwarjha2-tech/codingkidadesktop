/**
 * CodingKida Desktop — Lesson Q&A Doubt Chat
 *
 * Replaces the old video-player "AI Mentor" tab. A lesson-level group chat where
 * enrolled students ask doubts and the course instructor replies. Backed by:
 *   REST : GET/POST /api/lesson-chat        (history + send)
 *   SSE  : GET /api/lesson-chat/stream      (near-real-time new messages)
 *
 * Reuses existing globals: BASE_URL (api.js), sanitize (utils.js),
 * _currentVideoData (video-player.js). Reuses .vp-ai-messages / .vp-ai-input CSS.
 */

// ── State ──
var _chatLessonId = null;      // lesson currently bound to the chat panel
var _chatLoaded = false;       // history fetched for this lesson?
var _chatIsInstructor = false; // is the viewer the course instructor?
var _chatSeenIds = {};         // de-dupe map (message id → true)
var _chatEventSource = null;   // active SSE connection

function _chatToken() {
  return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
}

// Render one message bubble. Instructor and own messages are visually distinct.
function _renderChatMessage(m) {
  if (!m || _chatSeenIds[m.id]) return;
  _chatSeenIds[m.id] = true;

  var messages = document.getElementById('vp-doubts-messages');
  if (!messages) return;

  var empty = document.getElementById('vp-doubts-empty');
  if (empty) empty.remove();

  var isInstructor = m.senderRole === 'instructor';
  var isAi = m.senderRole === 'ai';
  var mine = !!m.isMine;

  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:10px;align-items:flex-start;' + (mine ? 'flex-direction:row-reverse;' : '');

  var avatarBg = isAi
    ? 'linear-gradient(135deg,#60a5fa,#a78bfa)'   // Codo AI = blue/violet
    : isInstructor
    ? 'linear-gradient(135deg,#f59e0b,#f97316)'   // instructor = amber
    : (mine ? 'linear-gradient(135deg,#10b981,#34d399)' : 'linear-gradient(135deg,var(--primary),#ec4899)');

  // Codo uses the mascot image as its avatar; others use initials.
  var avatarInner = isAi
    ? '<img src="assets/codo.jpg" alt="Codo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>'
    : sanitize(isInstructor ? 'IN' : (m.senderName ? m.senderName.charAt(0).toUpperCase() : 'U'));

  var bubbleBg = isAi ? 'rgba(96,165,250,0.1)' : (mine ? 'rgba(108,71,255,0.15)' : 'rgba(255,255,255,0.04)');
  var bubbleBorder = isAi ? 'rgba(96,165,250,0.3)' : (mine ? 'rgba(108,71,255,0.3)' : 'var(--border)');
  var radius = mine ? '10px 0 10px 10px' : '0 10px 10px 10px';

  var who = sanitize(m.senderName || 'User') + (isAi ? ' · AI Helper' : (isInstructor ? ' · Instructor' : ''));

  // Offer "Connect with our Expert" on Codo's answers AND on the auto-escalation
  // message (so the student can re-ping). Hide it only on the confirmation
  // message (which already says the expert "has been notified"), and for the
  // instructor's own view.
  var isConfirmation = /has been notified|asked to connect with our expert/i.test(m.text || '');
  var showExpertBtn = isAi && !isConfirmation && !_chatIsInstructor;
  var expertBtnHtml = showExpertBtn
    ? '<div style="margin-top:8px;"><button onclick="connectWithExpert(this)" style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:20px;padding:6px 14px;color:#fbbf24;font-size:0.76rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-user-graduate"></i> Connect with our Expert</button></div>'
    : '';

  wrap.innerHTML =
    '<div style="width:30px;height:30px;border-radius:50%;background:' + avatarBg + ';display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;">' + avatarInner + '</div>' +
    '<div style="max-width:78%;">' +
      '<div style="font-size:0.68rem;color:var(--muted);margin-bottom:3px;' + (mine ? 'text-align:right;' : '') + '">' + who + '</div>' +
      '<div style="background:' + bubbleBg + ';border:1px solid ' + bubbleBorder + ';border-radius:' + radius + ';padding:10px 14px;font-size:0.85rem;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word;">' + sanitize(m.text) + expertBtnHtml + '</div>' +
    '</div>';

  messages.appendChild(wrap);
  var vpCenter = messages.closest('.vp-center');
  if (vpCenter) vpCenter.scrollTop = vpCenter.scrollHeight;
}

// Open the SSE stream for near-real-time new messages.
function _chatOpenStream(lessonId) {
  _chatCloseStream();
  var token = _chatToken();
  if (!token || !lessonId) return;
  try {
    var url = BASE_URL + '/api/lesson-chat/stream?lessonId=' + encodeURIComponent(lessonId) +
              '&token=' + encodeURIComponent(token);
    _chatEventSource = new EventSource(url);
    _chatEventSource.addEventListener('message', function (evt) {
      // Only apply if the panel is still bound to this lesson.
      if (_chatLessonId !== lessonId) return;
      try { _renderChatMessage(JSON.parse(evt.data)); } catch (e) {}
    });
    _chatEventSource.onerror = function () {
      // EventSource auto-reconnects on transient errors; nothing to do here.
    };
  } catch (e) {
    // SSE unavailable — history + send still work; live updates simply won't push.
  }
}

function _chatCloseStream() {
  if (_chatEventSource) {
    try { _chatEventSource.close(); } catch (e) {}
    _chatEventSource = null;
  }
}

/**
 * Initialize the Doubts chat for a lesson. Called lazily when the Doubts tab is
 * first opened (from switchVpTab). Loads history once, then opens the SSE stream.
 */
async function initLessonChat(lessonId) {
  if (!lessonId) return;

  // Same lesson already loaded → ensure the stream is alive and stop.
  if (_chatLessonId === lessonId && _chatLoaded) {
    if (!_chatEventSource) _chatOpenStream(lessonId);
    return;
  }

  // New lesson → reset panel state.
  _chatLessonId = lessonId;
  _chatLoaded = false;
  _chatSeenIds = {};
  _chatCloseStream();

  var messages = document.getElementById('vp-doubts-messages');
  var roleTag = document.getElementById('vp-doubts-role');
  if (messages) {
    messages.innerHTML = '<div id="vp-doubts-empty" style="color:var(--muted);font-size:0.85rem;text-align:center;padding:20px 0;">Loading discussion…</div>';
  }

  var token = _chatToken();
  if (!token) return;

  try {
    var res = await fetch(BASE_URL + '/api/lesson-chat?lessonId=' + encodeURIComponent(lessonId), {
      headers: { Authorization: 'Bearer ' + token },
    });
    var data = await res.json();
    // A different lesson was opened while we were fetching → discard.
    if (_chatLessonId !== lessonId) return;

    if (!data || !data.success) {
      if (messages) messages.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;text-align:center;padding:20px 0;">' + sanitize((data && data.message) || 'Unable to load discussion.') + '</div>';
      return;
    }

    _chatIsInstructor = !!data.isInstructor;
    if (roleTag) roleTag.textContent = _chatIsInstructor ? '(you are the instructor)' : '';

    // Reset panel then render history.
    if (messages) messages.innerHTML = '';
    var list = data.messages || [];
    if (list.length === 0) {
      if (messages) messages.innerHTML = '<div id="vp-doubts-empty" style="color:var(--muted);font-size:0.85rem;text-align:center;padding:20px 0;">' +
        (_chatIsInstructor ? 'No questions yet. Students\' questions will appear here.' : 'Ask a question about this lesson. Codo answers instantly from your course material, and your instructor can add more. Everyone enrolled can see the discussion.') +
        '</div>';
    } else {
      list.forEach(_renderChatMessage);
    }

    _chatLoaded = true;
    _chatOpenStream(lessonId);
  } catch (e) {
    if (_chatLessonId === lessonId && messages) {
      messages.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;text-align:center;padding:20px 0;">Network error. Please check your connection.</div>';
    }
  }
}

/** Send the current input as a message to this lesson's chat. */
async function sendLessonChat() {
  var input = document.getElementById('vp-doubts-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text || !_chatLessonId) return;

  var token = _chatToken();
  if (!token) return;

  var sendBtn = input.nextElementSibling;
  input.disabled = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

  try {
    var res = await fetch(BASE_URL + '/api/lesson-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ lessonId: _chatLessonId, text: text }),
    });
    var data = await res.json();
    if (data && data.success && data.message) {
      input.value = '';
      _renderChatMessage(data.message); // optimistic render (SSE de-dupes by id)
    } else {
      alert((data && data.message) || 'Failed to send. Please try again.');
    }
  } catch (e) {
    alert('Network error. Please try again.');
  } finally {
    input.disabled = false;
    if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
    input.focus();
  }
}

/**
 * Reset the chat when leaving a lesson / opening a new one. Called from the
 * video-player lesson loader so a stale stream never lingers.
 */
function resetLessonChat() {
  _chatCloseStream();
  _chatLessonId = null;
  _chatLoaded = false;
  _chatIsInstructor = false;
  _chatSeenIds = {};
}

/**
 * Deep-link: open a lesson from a notification and jump straight to its Doubts
 * chat tab. Used by the notification click handler for lesson_question /
 * lesson_answer notifications. Reuses openVideoFromBackend (module resolved from
 * lessonId inside it) — no duplicated navigation logic.
 */
async function openLessonDoubts(courseId, lessonId) {
  if (!courseId || !lessonId) return;
  if (typeof openVideoFromBackend !== 'function') return;

  // moduleId is unknown from the notification — openVideoFromBackend resolves it
  // from the lessonId. Pass null for moduleId.
  await openVideoFromBackend(courseId, null, lessonId);

  // After the lesson view is up, activate the Doubts tab (retry briefly in case
  // the tabs are still rendering).
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var doubtsTab = document.querySelector('.vp-tabs .vp-tab[onclick*="vp-doubts"]');
    if (doubtsTab) {
      clearInterval(timer);
      switchVpTab(doubtsTab, 'vp-doubts');
    } else if (tries > 20) {
      clearInterval(timer); // give up after ~2s; the lesson still opened
    }
  }, 100);
}

/**
 * "Connect with our Expert" — student taps this under a Codo answer to pull in
 * the human expert/instructor. Calls the escalate endpoint, which notifies the
 * instructor and posts a confirmation into the thread (arrives via SSE).
 */
async function connectWithExpert(btn) {
  if (!btn || !_chatLessonId) return;
  var token = _chatToken();
  if (!token) return;

  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

  try {
    var res = await fetch(BASE_URL + '/api/lesson-chat/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ lessonId: _chatLessonId }),
    });
    var data = await res.json();
    if (data && data.success) {
      // Confirmation message arrives via SSE (de-duped). Mark this button done.
      btn.innerHTML = '<i class="fas fa-check"></i> Expert notified';
      btn.style.cursor = 'default';
      btn.style.borderColor = 'rgba(34,197,94,0.4)';
      btn.style.color = '#22c55e';
      // Optimistic render in case SSE is slow.
      if (data.message) _renderChatMessage(data.message);
    } else {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = orig;
      alert((data && data.message) || 'Could not connect right now. Please try again.');
    }
  } catch (e) {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerHTML = orig;
    alert('Network error. Please try again.');
  }
}
