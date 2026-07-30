/**
 * CodingKida Desktop — Attendance Tracking
 * localStorage-only session tracking (no backend needed).
 * Stores per-user session log: { date, loginTime, logoutTime, durationMins }
 * Key: ck_attendance_<userId>  →  array of last 60 session records
 */

function _attendanceKey(userId) {
  return 'ck_attendance_' + (userId || getCurrentUserId());
}

function _attendanceRecordLogin() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return;
    const key = _attendanceKey(userId);
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    const dateStr = new Date(now).toISOString().split('T')[0];
    // If already have an open session today (no logoutTime), close it first
    sessions.forEach(function(s) { if (!s.logoutTime) s.logoutTime = now; });
    sessions.push({ date: dateStr, loginTime: now, logoutTime: null });
    // Keep last 60 sessions only
    if (sessions.length > 60) sessions.splice(0, sessions.length - 60);
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {}
}

function _attendanceRecordLogout(userId) {
  try {
    const key = _attendanceKey(userId);
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    // Close the most recent open session
    for (var i = sessions.length - 1; i >= 0; i--) {
      if (!sessions[i].logoutTime) {
        sessions[i].logoutTime = now;
        sessions[i].durationMins = Math.round((now - sessions[i].loginTime) / 60000);
        break;
      }
    }
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {}
}

// Returns attendance summary for the report
function _attendanceGetSummary() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return { todayMins: 0, weekMins: 0, calendar: [], activeDays: 0 };
    const key = _attendanceKey(userId);
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    const todayStr = new Date(now).toISOString().split('T')[0];
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Build per-day totals — always compute live from loginTime/logoutTime
    var dayMap = {};
    sessions.forEach(function(s) {
      var logout = s.logoutTime || now; // open session = still active
      var mins = Math.round((logout - s.loginTime) / 60000);
      if (mins < 0) mins = 0;
      if (mins > 1440) mins = 1440; // cap at 24h
      dayMap[s.date] = (dayMap[s.date] || 0) + mins;
    });

    var todayMins = dayMap[todayStr] || 0;
    var weekMins = 0;
    Object.keys(dayMap).forEach(function(d) {
      if (new Date(d).getTime() >= weekAgo) weekMins += dayMap[d];
    });

    // 30-day calendar
    var calendar = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(now - i * 24 * 60 * 60 * 1000);
      var dStr = d.toISOString().split('T')[0];
      var m = dayMap[dStr] || 0;
      calendar.push({ date: dStr, day: d.getDate(), mins: m, active: m > 0 });
    }

    var activeDays = calendar.filter(function(c) { return c.active; }).length;
    return { todayMins: todayMins, weekMins: weekMins, calendar: calendar, activeDays: activeDays };
  } catch { return { todayMins: 0, weekMins: 0, calendar: [], activeDays: 0 }; }
}

function _fmtMins(mins) {
  if (!mins || mins <= 0) return '0 min';
  if (mins < 60) return mins + ' min';
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
}
