/**
 * CodingKida Desktop — Live Classes (ISOLATED feature)
 *
 * Phase B1: lifecycle UI only (list + join) — NO audio/video yet. Lists the
 * scheduled/live classes across the student's enrolled courses and lets them
 * join (records attendance via the backend). The actual A/V classroom arrives
 * in B2 (live-room.js); this file deliberately stops at the lifecycle so the
 * flow can be tested first.
 *
 * Fully self-contained: everything lives in live*.js + the #page-live block.
 * Reuses existing globals — BASE_URL (config.js), sanitize (utils.js), and the
 * 'ck_token' bearer convention used across the app. No existing file's logic is
 * changed beyond a one-line init hook in navigation.js.
 *
 * Backend (isolated /api/live/*):
 *   GET  /api/live/classes/enrolled      → scheduled+live classes for the user
 *   POST /api/live/classes/:id/join      → join (returns Chime meeting+attendee)
 */

var _liveLoaded = false;      // list fetched at least once this session?
var _liveLoading = false;     // in-flight guard
var _liveJoiningId = null;    // class id currently being joined

function _liveToken() {
  return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
}

// Lazy entry — called by navigation.js when the Live page opens.
function initLivePage() {
  renderLiveClasses();
}

// Fetch + render both the teacher's hosted classes AND the student's joinable
// classes. A user can be both (an instructor who also enrols elsewhere), so we
// show a "Your Classes (Host)" section when hosting is non-empty, followed by
// the joinable list.
async function renderLiveClasses() {
  var list = document.getElementById('live-list');
  var empty = document.getElementById('live-empty');
  var loading = document.getElementById('live-loading');
  if (!list) return;

  var token = _liveToken();
  if (!token) {
    if (loading) loading.style.display = 'none';
    if (empty) { empty.style.display = 'block'; empty.textContent = 'Please log in to see your live classes.'; }
    return;
  }

  // ── Instant paint from cache (stale-while-revalidate), like other pages ──
  // Show cached classes immediately (no spinner) if we have them, then refresh
  // silently in the background. Only show the spinner on a true cold start.
  var cachedHosting = (typeof ckCacheGet === 'function') ? ckCacheGet('/api/live/classes/hosting') : null;
  var cachedEnrolled = (typeof ckCacheGet === 'function') ? ckCacheGet('/api/live/classes/enrolled') : null;
  var hasCache = !!(cachedHosting || cachedEnrolled);

  if (hasCache) {
    _liveRenderLists(
      (cachedHosting && cachedHosting.success && Array.isArray(cachedHosting.classes)) ? cachedHosting.classes : [],
      (cachedEnrolled && cachedEnrolled.success && Array.isArray(cachedEnrolled.classes)) ? cachedEnrolled.classes : []
    );
  } else {
    if (loading) loading.style.display = 'flex';
    if (empty) empty.style.display = 'none';
    list.innerHTML = '';
  }

  // Guard against overlapping network refreshes (but cache paint above always runs).
  if (_liveLoading) return;
  _liveLoading = true;

  try {
    // Fetch hosting + enrolled in parallel. 503 from either = feature off.
    var headers = { Authorization: 'Bearer ' + token };
    var results = await Promise.all([
      fetch(BASE_URL + '/api/live/classes/hosting', { headers: headers }),
      fetch(BASE_URL + '/api/live/classes/enrolled', { headers: headers }),
    ]);

    if (results[0].status === 503 || results[1].status === 503) {
      _liveShowUnavailable();
      return;
    }

    var hostingData = await results[0].json().catch(function () { return {}; });
    var enrolledData = await results[1].json().catch(function () { return {}; });

    // Cache the fresh responses for the next instant paint.
    if (typeof ckCacheSet === 'function') {
      if (hostingData && hostingData.success) ckCacheSet('/api/live/classes/hosting', hostingData);
      if (enrolledData && enrolledData.success) ckCacheSet('/api/live/classes/enrolled', enrolledData);
    }

    var hosting = (hostingData && hostingData.success && Array.isArray(hostingData.classes)) ? hostingData.classes : [];
    var enrolled = (enrolledData && enrolledData.success && Array.isArray(enrolledData.classes)) ? enrolledData.classes : [];

    _liveLoaded = true;
    _liveRenderLists(hosting, enrolled);
  } catch (e) {
    // On a network error, keep any cached list already painted; only show the
    // error message if we had nothing to show.
    if (!hasCache) {
      if (loading) loading.style.display = 'none';
      if (empty) { empty.style.display = 'block'; empty.textContent = 'Could not load live classes. Please try again.'; }
    }
  } finally {
    _liveLoading = false;
  }
}

// Render the hosting + enrolled lists into the page (shared by the instant
// cache paint and the fresh network response — single source of render truth).
function _liveRenderLists(hosting, enrolled) {
  var list = document.getElementById('live-list');
  var empty = document.getElementById('live-empty');
  var loading = document.getElementById('live-loading');
  if (!list) return;

  if (loading) loading.style.display = 'none';
  list.innerHTML = '';

  if ((!hosting || hosting.length === 0) && (!enrolled || enrolled.length === 0)) {
    if (empty) { empty.style.display = 'block'; empty.textContent = 'No live classes scheduled right now. Check back soon!'; }
    return;
  }
  if (empty) empty.style.display = 'none';

  // Teacher section (only when hosting something).
  if (hosting && hosting.length > 0) {
    list.appendChild(_liveSectionHeader('Your Classes (Host)'));
    hosting.forEach(function (c) { list.appendChild(_renderLiveCard(c, true)); });
  }

  // Student / joinable section.
  if (enrolled && enrolled.length > 0) {
    if (hosting && hosting.length > 0) list.appendChild(_liveSectionHeader('Classes You Can Join'));
    enrolled.forEach(function (c) { list.appendChild(_renderLiveCard(c, false)); });
  }
}

// Small section heading between the host + joinable groups.
function _liveSectionHeader(text) {
  var h = document.createElement('h3');
  h.textContent = text;
  h.style.cssText = 'font-size:0.95rem;font-weight:700;color:#fff;margin:8px 0 2px;';
  return h;
}

// Feature-off state (backend returned 503).
function _liveShowUnavailable() {
  var list = document.getElementById('live-list');
  var empty = document.getElementById('live-empty');
  var loading = document.getElementById('live-loading');
  _liveLoading = false;
  if (loading) loading.style.display = 'none';
  if (list) list.innerHTML = '';
  if (empty) { empty.style.display = 'block'; empty.textContent = 'Live classes are not enabled yet.'; }
}

// Build one class card. `isHost` → teacher controls (Start/Rejoin/End); else
// the student join controls.
function _renderLiveCard(c, isHost) {
  var isLive = c.status === 'live';
  var card = document.createElement('div');
  card.className = 'live-card';

  var when = _liveFormatWhen(c.scheduledAt);
  var dur = c.durationMinutes ? (' · ' + c.durationMinutes + ' min') : '';
  var instructor = c.instructorName ? sanitize(c.instructorName) : 'Instructor';
  var courseTitle = c.courseTitle ? sanitize(c.courseTitle) : '';

  var meta = isLive
    ? (instructor + (courseTitle ? ' · ' + courseTitle : ''))
    : (instructor + (courseTitle ? ' · ' + courseTitle : '') + ' · ' + when + dur);

  var titleHtml = (isLive ? '<span class="live-dot"></span>' : '') + sanitize(c.title || 'Live Class');

  if (c.agenda) {
    meta += '<br><span style="opacity:0.75;">' + sanitize(c.agenda) + '</span>';
  }

  var btn;
  if (isHost) {
    // Teacher controls.
    if (isLive) {
      btn =
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-danger" onclick="joinLiveClass(\'' + c.id + '\', this)">Rejoin <i class="fas fa-arrow-right"></i></button>' +
          '<button class="btn btn-outline" onclick="endLiveClass(\'' + c.id + '\', this)">End</button>' +
        '</div>';
    } else {
      btn = '<button class="btn btn-danger" onclick="startLiveClass(\'' + c.id + '\', this)">Start Now <i class="fas fa-bolt"></i></button>';
    }
  } else {
    // Student controls.
    btn = isLive
      ? '<button class="btn btn-danger" onclick="joinLiveClass(\'' + c.id + '\', this)">Join Now <i class="fas fa-arrow-right"></i></button>'
      : '<button class="btn btn-outline" disabled title="Starts at the scheduled time"><i class="fas fa-clock"></i> Scheduled</button>';
  }

  card.innerHTML =
    '<div class="live-info">' +
      '<h4>' + titleHtml + '</h4>' +
      '<p>' + meta + '</p>' +
    '</div>' + btn;

  return card;
}

// Join a live class (B1: records attendance + fetches the Chime join payload).
// The actual A/V room opens in B2; for now we confirm a successful join so the
// lifecycle can be verified end-to-end.
async function joinLiveClass(classId, btnEl) {
  if (!classId || _liveJoiningId) return;
  _liveJoiningId = classId;

  var original = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...'; }

  try {
    var token = _liveToken();
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(classId) + '/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ clientType: 'STUDENT_DESKTOP' }),
    });
    var data = await res.json().catch(function () { return {}; });

    if (!data || !data.success) {
      // Phase 4: a host-removed user gets 403. Offer to request a rejoin — the
      // host then sees an Accept/Reject prompt.
      if (res.status === 403) {
        if (confirm('The host removed you from this class. Ask the host to let you back in?')) {
          try {
            await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(classId) + '/rejoin-request', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            });
            alert('⏳ Request sent. Please wait for the host to approve, then Join again.');
          } catch (e) {}
        }
        return;
      }
      alert('⚠️ ' + ((data && data.message) || 'Could not join the class.'));
      return;
    }

    // B1 stop point: join succeeded (attendance recorded, Chime meeting+attendee
    // returned). The live A/V room is wired in B2 (live-room.js).
    if (typeof openLiveRoom === 'function') {
      openLiveRoom(classId, data);
    } else {
      alert('✅ Joined successfully! The live video room will open here (coming in the next step).');
    }
  } catch (e) {
    alert('⚠️ Something went wrong while joining. Please try again.');
  } finally {
    _liveJoiningId = null;
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = original; }
  }
}

// Teacher: start a scheduled class. Flow = POST /start (creates the Chime
// meeting + flips status to live) → POST /join (teacher's own attendee) →
// openLiveRoom. Keeping start+join separate means the room always receives the
// same { meeting, attendee } payload (no special host path, no backend change).
async function startLiveClass(classId, btnEl) {
  if (!classId || _liveJoiningId) return;
  _liveJoiningId = classId;

  var original = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...'; }

  try {
    var token = _liveToken();

    // 1) Start — create the Chime meeting + mark the class live.
    var startRes = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(classId) + '/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    });
    var startData = await startRes.json().catch(function () { return {}; });
    if (!startData || !startData.success) {
      alert('⚠️ ' + ((startData && startData.message) || 'Could not start the class.'));
      return;
    }

    // 2) Join — get the host's own attendee (token) for the room.
    var joinRes = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(classId) + '/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ clientType: 'TEACHER_DESKTOP' }),
    });
    var joinData = await joinRes.json().catch(function () { return {}; });
    if (!joinData || !joinData.success) {
      alert('⚠️ ' + ((joinData && joinData.message) || 'Class started, but could not open the room.'));
      return;
    }

    if (typeof openLiveRoom === 'function') {
      openLiveRoom(classId, joinData);
    }
  } catch (e) {
    alert('⚠️ Something went wrong while starting the class. Please try again.');
  } finally {
    _liveJoiningId = null;
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = original; }
  }
}

// Teacher: end a class (stops the Chime meeting, marks it ended, closes out
// attendance). Confirms first since this ends it for everyone.
async function endLiveClass(classId, btnEl) {
  if (!classId) return;
  if (!confirm('End this live class for everyone?')) return;

  var original = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ending...'; }

  try {
    var token = _liveToken();
    var res = await fetch(BASE_URL + '/api/live/classes/' + encodeURIComponent(classId) + '/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    });
    var data = await res.json().catch(function () { return {}; });
    if (!data || !data.success) {
      alert('⚠️ ' + ((data && data.message) || 'Could not end the class.'));
      return;
    }
    // The class just ended — invalidate the cached lists so the refresh shows
    // the up-to-date state immediately (not a stale "live" entry).
    if (typeof ckCacheRemove === 'function') {
      ckCacheRemove('/api/live/classes/hosting');
      ckCacheRemove('/api/live/classes/enrolled');
    }
    // Refresh the list so the ended class drops off.
    renderLiveClasses();
  } catch (e) {
    alert('⚠️ Something went wrong while ending the class.');
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = original; }
  }
}

// Human-friendly schedule time.
function _liveFormatWhen(iso) {
  if (!iso) return 'Not scheduled';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'Not scheduled';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return 'Not scheduled';
  }
}
