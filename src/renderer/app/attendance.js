/**
 * CodingKida Desktop — learning-time tracking.
 *
 * The SERVER (DailyActivity) is the only place time is read from, so the desktop
 * app, the mobile app and the weekly parent report always show the same numbers.
 * This file only measures time and sends it:
 *  - a tick every minute adds the time since the last tick, but only while the
 *    student is really learning: a lesson/live video is playing, OR they are on
 *    a learning page (lesson, coding, live class, AI mentor, downloads) with the
 *    window focused and mouse/keyboard used in the last 5 minutes. Menus, home,
 *    shop, report and idle time do not count;
 *  - every 5 minutes, when the window is hidden, on logout and on close, whole
 *    minutes are sent to POST /api/attendance under the LOCAL calendar day;
 *  - sends that fail are queued in localStorage and retried on the next send.
 */

var CK_ATT_TICK_MS = 60 * 1000;
var CK_ATT_FLUSH_MS = 5 * 60 * 1000;
var CK_ATT_MAX_GAP_MS = 3 * 60 * 1000;
var CK_ATT_IDLE_MS = 5 * 60 * 1000; // no mouse/keyboard for 5 minutes = idle

var _ckAtt = { timer: null, lastTick: 0, lastInput: Date.now(), pendingMs: 0, pendingDay: null, sessionSent: false };

/** Local calendar day 'YYYY-MM-DD'. */
function _ckDay(ms) {
  var d = new Date(ms == null ? Date.now() : ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _ckAttToken() {
  return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
}

function _ckAttQueueKey() {
  return 'ck_attendance_queue_' + (getCurrentUserId() || 'anon');
}

['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
  window.addEventListener(ev, function () { _ckAtt.lastInput = Date.now(); }, { passive: true });
});

/** A lesson video is playing (watching counts even without touching the mouse). */
function _ckVideoPlaying() {
  try {
    var vids = document.getElementsByTagName('video');
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (!v.paused && !v.ended && v.readyState > 2) return true;
    }
  } catch (e) {}
  return false;
}

// Pages where time counts as learning (like Khan Academy, time spent browsing
// menus, the home page, the shop or the report does not count).
var CK_LEARNING_PAGES = { 'video': 1, 'coding': 1, 'live-room': 1, 'ai': 1, 'offline-downloads': 1 };

function _ckOnLearningPage() {
  try {
    if (typeof getCurrentActivePage !== 'function') return true;
    return !!CK_LEARNING_PAGES[getCurrentActivePage()];
  } catch (e) { return true; }
}

/**
 * Is the student learning right now? Either a video (lesson or live class) is
 * playing, or the student is on a learning page with the window visible and
 * focused and used the mouse/keyboard in the last 5 minutes.
 */
function _ckIsActive(now) {
  if (_ckVideoPlaying()) return true;
  if (!_ckOnLearningPage()) return false;
  if (document.visibilityState === 'hidden') return false;
  if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
  return (now - _ckAtt.lastInput) < CK_ATT_IDLE_MS;
}

function _attendanceTick() {
  var now = Date.now();
  var gap = _ckAtt.lastTick ? now - _ckAtt.lastTick : 0;
  _ckAtt.lastTick = now;
  // Gaps over 3 minutes mean the computer slept or the app froze: not counted.
  if (gap > 0 && gap <= CK_ATT_MAX_GAP_MS && _ckIsActive(now)) {
    var day = _ckDay(now);
    if (_ckAtt.pendingDay && _ckAtt.pendingDay !== day) _attendanceFlush(true); // midnight: close yesterday
    _ckAtt.pendingDay = day;
    _ckAtt.pendingMs += gap;
  }
  if (_ckAtt.pendingMs >= CK_ATT_FLUSH_MS) _attendanceFlush(false);
}

function _ckReadQueue(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { return []; }
}
function _ckWriteQueue(key, q) {
  try { localStorage.setItem(key, JSON.stringify(q.slice(-200))); } catch (e) {}
}
function _ckPost(token, it) {
  return fetch(BASE_URL + '/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ date: it.date, minutes: it.minutes, sessions: it.sessions }),
    keepalive: true, // lets the request finish while the app closes
  });
}

var _ckSending = false;

/**
 * Send measured minutes to the server. `all` also sends a final part-minute
 * (30 s or more rounds up). `closing` = the app is closing/logging out: send
 * everything at once without waiting for answers.
 *
 * Minutes are taken out synchronously, so two calls never take the same
 * minutes. Normally items are sent one at a time and leave the queue only after
 * the server confirmed them (nothing lost when offline).
 */
function _attendanceFlush(all, closing) {
  try {
    var mins = Math.floor(_ckAtt.pendingMs / 60000);
    if (all && _ckAtt.pendingMs - mins * 60000 >= 30000) mins += 1;
    var day = _ckAtt.pendingDay || _ckDay();
    _ckAtt.pendingMs = all ? 0 : Math.max(0, _ckAtt.pendingMs - mins * 60000);
    if (all) _ckAtt.pendingDay = null;

    var token = _ckAttToken();
    var key = _ckAttQueueKey();
    if (!token || !getCurrentUserId()) return Promise.resolve(); // signed out: not counted

    var queue = _ckReadQueue(key);
    if (mins > 0) {
      queue.push({ date: day, minutes: mins, sessions: _ckAtt.sessionSent ? 0 : 1 });
      _ckAtt.sessionSent = true;
      _ckWriteQueue(key, queue);
    }
    if (!queue.length) return Promise.resolve();

    if (closing) {
      // The page is going away: fire everything now (keepalive) and clear the queue.
      if (_ckSending) return Promise.resolve(); // a send in progress owns the queue
      _ckWriteQueue(key, []);
      queue.forEach(function (it) { _ckPost(token, it).catch(function () {}); });
      return Promise.resolve();
    }

    if (_ckSending) return Promise.resolve(); // the running send will pick these up
    _ckSending = true;
    var sendNext = function () {
      var q = _ckReadQueue(key);
      if (!q.length) return Promise.resolve();
      return _ckPost(token, q[0]).then(function (r) {
        if (!r.ok) throw new Error('not saved');
        _ckWriteQueue(key, _ckReadQueue(key).slice(1)); // confirmed: remove it
        return sendNext();
      });
    };
    return sendNext().catch(function () {}).then(function () { _ckSending = false; });
  } catch (e) { _ckSending = false; return Promise.resolve(); }
}

/** Start measuring (called after login / app start). */
function _attendanceRecordLogin() {
  try {
    if (!getCurrentUserId()) return;
    _ckAtt.lastTick = Date.now();
    _ckAtt.lastInput = Date.now();
    _ckAtt.sessionSent = false;
    if (!_ckAtt.timer) _ckAtt.timer = setInterval(_attendanceTick, CK_ATT_TICK_MS);
    _attendanceFlush(false); // retry anything queued from last time
  } catch (e) {}
}

/** Stop measuring and send everything (called on logout, before the token is removed). */
function _attendanceRecordLogout() {
  try {
    _attendanceTick();
    if (_ckAtt.timer) { clearInterval(_ckAtt.timer); _ckAtt.timer = null; }
    _ckAtt.lastTick = 0;
    _attendanceFlush(true, true);
  } catch (e) {}
}

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') {
    // Minimised: count up to now, send, and pause (time while hidden is not counted
    // unless a video keeps playing, which the minute tick still checks).
    _attendanceTick();
    _attendanceFlush(false);
  } else {
    // Back on screen: a new "time opened".
    _ckAtt.lastTick = Date.now();
    _ckAtt.lastInput = Date.now();
    _ckAtt.sessionSent = false;
  }
});
window.addEventListener('beforeunload', function () {
  try { _attendanceTick(); _attendanceFlush(true, true); } catch (e) {}
});

/** Kept for older callers: sends one day's minutes to the server. */
function _attendanceSyncToServer(dateStr, minutes, sessions) {
  try {
    var token = _ckAttToken();
    if (!token || !dateStr || !(minutes > 0)) return;
    fetch(BASE_URL + '/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ date: dateStr, minutes: minutes, sessions: sessions || 0 }),
      keepalive: true,
    }).catch(function () {});
  } catch (e) {}
}

/**
 * Server history for the current user:
 * { joinedAt: 'YYYY-MM-DD'|null, days: [{date, minutes, sessions}] }.
 */
async function _attendanceFetchServerHistory() {
  try {
    var token = _ckAttToken();
    if (!token) return { joinedAt: null, days: [] };
    var res = await fetch(BASE_URL + '/api/attendance', { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) return { joinedAt: null, days: [] };
    var data = await res.json();
    if (data && data.success) {
      return { joinedAt: data.joinedAt || null, days: Array.isArray(data.days) ? data.days : [] };
    }
  } catch (e) {}
  return { joinedAt: null, days: [] };
}

function _attendanceServerMaps() {
  var mins = {}, sessions = {};
  var hist = (typeof _prServerHistory !== 'undefined' && _prServerHistory) ? _prServerHistory : null;
  ((hist && hist.days) || []).forEach(function (d) {
    if (!d || !d.date) return;
    mins[d.date] = d.minutes || 0;
    sessions[d.date] = d.sessions || 0;
  });
  return { mins: mins, sessions: sessions };
}

/**
 * Summary for the report, from the SERVER history only (same numbers as the
 * mobile app and the weekly parent report). "This week" = Monday → today.
 */
function _attendanceGetSummary() {
  try {
    var maps = _attendanceServerMaps();
    var now = new Date();
    var todayMins = maps.mins[_ckDay(now.getTime())] || 0;
    var back = now.getDay() === 0 ? 6 : now.getDay() - 1;
    var weekMins = 0;
    for (var w = back; w >= 0; w--) {
      weekMins += maps.mins[_ckDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - w).getTime())] || 0;
    }
    var calendar = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var key = _ckDay(d.getTime());
      var m = maps.mins[key] || 0;
      calendar.push({ date: key, day: d.getDate(), mins: m, active: m > 0 });
    }
    var activeDays = calendar.filter(function (c) { return c.active; }).length;
    return { todayMins: todayMins, weekMins: weekMins, calendar: calendar, activeDays: activeDays };
  } catch (e) { return { todayMins: 0, weekMins: 0, calendar: [], activeDays: 0 }; }
}

function _fmtMins(mins) {
  if (!mins || mins <= 0) return '0 min';
  if (mins < 60) return mins + ' min';
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
}

/** One day's minutes and times opened, from the server history. */
function _attendanceGetDayDetail(dateStr) {
  var maps = _attendanceServerMaps();
  return { date: dateStr, mins: maps.mins[dateStr] || 0, sessions: maps.sessions[dateStr] || 0, firstTime: null, lastTime: null };
}
