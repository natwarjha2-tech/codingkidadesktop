/**
 * CodingKida Desktop — Live Class Recordings library (ISOLATED feature, P11)
 *
 * A "Recordings" button on the Live page opens this panel: the user's recorded
 * live classes, grouped Course → Class → Recording (a clean hierarchy, like the
 * downloads section). Scope is resolved server-side from the JWT:
 *   • student → recordings from their enrolled courses' classes
 *   • host    → recordings from the classes they host
 * Backend: GET /api/live/classes/recordings/mine (already built) returns the
 * grouped tree with time-limited signed playback URLs.
 *
 * Playback is PLAY-ONLY (no download, per product decision): clicking a
 * recording opens a self-contained overlay with a native <video controls>
 * element and the signed URL — isolated from the course video player so this
 * feature can never affect course playback.
 *
 * Fully self-contained: everything lives in this file + the #live-recordings-*
 * markup in index.html. Reuses existing globals only — BASE_URL (config),
 * sanitize (utils), ckCacheGet/Set (cache), and the 'ck_token' convention.
 */

var _lrecOpen = false;       // is the panel currently shown?
var _lrecLoading = false;    // in-flight guard
var _lrecLoaded = false;     // fetched at least once this session?

function _lrecToken() {
  return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
}

// Toggle the recordings panel. Opening hides the class list + loads the library
// (instant paint from cache, then a silent refresh). Closing restores the list.
function lrecToggle() {
  var panel = document.getElementById('live-recordings-panel');
  var list = document.getElementById('live-list');
  var empty = document.getElementById('live-empty');
  var btn = document.getElementById('live-recordings-btn');
  if (!panel) return;

  _lrecOpen = !_lrecOpen;

  if (_lrecOpen) {
    if (list) list.style.display = 'none';
    if (empty) empty.style.display = 'none';
    panel.style.display = 'block';
    if (btn) { btn.classList.add('btn-primary'); btn.classList.remove('btn-outline'); }
    _lrecRender();
  } else {
    panel.style.display = 'none';
    if (list) list.style.display = 'flex';
    if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-outline'); }
  }
}

// Render the library: instant paint from cache if present, then refresh from
// the network. Single render path (no duplicated DOM building).
async function _lrecRender() {
  var panel = document.getElementById('live-recordings-panel');
  if (!panel) return;

  var token = _lrecToken();
  if (!token) {
    panel.innerHTML = _lrecMsg('Please log in to see your recordings.');
    return;
  }

  // Instant paint from cache (stale-while-revalidate), like the class list.
  var cached = (typeof ckCacheGet === 'function') ? ckCacheGet('/api/live/classes/recordings/mine') : null;
  var hasCache = !!(cached && cached.success && Array.isArray(cached.courses));
  if (hasCache) {
    _lrecRenderTree(cached.courses);
  } else {
    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;padding:40px 0;">' +
      '<i class="fas fa-spinner fa-spin" style="font-size:1.4rem;color:var(--primary);"></i></div>';
  }

  if (_lrecLoading) return;
  _lrecLoading = true;
  try {
    var res = await fetch(BASE_URL + '/api/live/classes/recordings/mine', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (res.status === 503) {
      panel.innerHTML = _lrecMsg('Live classes are not enabled yet.');
      return;
    }
    var data = await res.json().catch(function () { return {}; });
    if (data && data.success && Array.isArray(data.courses)) {
      if (typeof ckCacheSet === 'function') ckCacheSet('/api/live/classes/recordings/mine', data);
      _lrecLoaded = true;
      // Only repaint if the panel is still open (user may have toggled away).
      if (_lrecOpen) _lrecRenderTree(data.courses);
    } else if (!hasCache) {
      panel.innerHTML = _lrecMsg('Could not load recordings. Please try again.');
    }
  } catch (e) {
    if (!hasCache) panel.innerHTML = _lrecMsg('Could not load recordings. Please try again.');
  } finally {
    _lrecLoading = false;
  }
}

// Build the Course → Class → Recording tree into the panel. Courses are
// collapsible; each recording is a play-only row.
function _lrecRenderTree(courses) {
  var panel = document.getElementById('live-recordings-panel');
  if (!panel) return;

  if (!courses || courses.length === 0) {
    panel.innerHTML = _lrecMsg('No recordings yet. Recorded classes will appear here once available.');
    return;
  }

  var html = '';
  courses.forEach(function (course, ci) {
    var classes = Array.isArray(course.classes) ? course.classes : [];
    var recCount = 0;
    classes.forEach(function (c) { recCount += (c.recordings ? c.recordings.length : 0); });

    html +=
      '<div class="lrec-course">' +
        '<button type="button" class="lrec-course-head" onclick="lrecToggleCourse(' + ci + ')">' +
          '<span class="lrec-course-title"><i class="fas fa-folder"></i> ' + sanitize(course.courseTitle || 'Course') + '</span>' +
          '<span class="lrec-course-meta">' + recCount + ' recording' + (recCount === 1 ? '' : 's') +
            ' <i class="fas fa-chevron-down lrec-caret" id="lrec-caret-' + ci + '"></i></span>' +
        '</button>' +
        '<div class="lrec-course-body" id="lrec-body-' + ci + '">';

    classes.forEach(function (c) {
      var recs = Array.isArray(c.recordings) ? c.recordings : [];
      if (recs.length === 0) return;
      html +=
        '<div class="lrec-class">' +
          '<div class="lrec-class-title"><i class="fas fa-chalkboard"></i> ' + sanitize(c.title || 'Live Class') +
            (c.endedAt ? ' <span class="lrec-class-date">· ' + sanitize(_lrecFmtDate(c.endedAt)) + '</span>' : '') +
          '</div>';
      recs.forEach(function (r, ri) {
        var label = 'Recording' + (recs.length > 1 ? ' ' + (ri + 1) : '');
        var dur = (typeof r.duration === 'number' && r.duration > 0) ? _lrecFmtDuration(r.duration) : '';
        // Stash the signed URL on a data-attr and play via a delegated click so
        // we never inject the (long, quoted) URL into an inline onclick.
        html +=
          '<button type="button" class="lrec-item" data-url="' + encodeURIComponent(r.url || '') + '" ' +
            'data-title="' + encodeURIComponent((c.title || 'Live Class') + ' — ' + label) + '">' +
            '<span class="lrec-item-left"><i class="fas fa-circle-play"></i> ' + label + '</span>' +
            (dur ? '<span class="lrec-item-dur">' + dur + '</span>' : '') +
          '</button>';
      });
      html += '</div>';
    });

    html += '</div></div>';
  });

  panel.innerHTML = html;

  // Delegate play clicks (single listener, no per-item closures/duplication).
  panel.querySelectorAll('.lrec-item').forEach(function (btn) {
    btn.onclick = function () {
      var url = decodeURIComponent(btn.getAttribute('data-url') || '');
      var title = decodeURIComponent(btn.getAttribute('data-title') || 'Recording');
      if (url) _lrecPlay(url, title);
    };
  });
}

// Collapse/expand a course bucket.
function lrecToggleCourse(ci) {
  var body = document.getElementById('lrec-body-' + ci);
  var caret = document.getElementById('lrec-caret-' + ci);
  if (!body) return;
  var hidden = body.style.display === 'none';
  body.style.display = hidden ? 'block' : 'none';
  if (caret) caret.style.transform = hidden ? '' : 'rotate(-90deg)';
}

// ── Play-only overlay (self-contained; isolated from the course player) ───────

// Open a full-screen overlay with a native video player for the signed URL.
function _lrecPlay(url, title) {
  _lrecClosePlayer(); // never stack two players

  var overlay = document.createElement('div');
  overlay.id = 'lrec-player-overlay';
  overlay.className = 'lrec-player-overlay';
  overlay.onclick = function (e) { if (e.target === overlay) _lrecClosePlayer(); };

  var box = document.createElement('div');
  box.className = 'lrec-player-box';

  var head = document.createElement('div');
  head.className = 'lrec-player-head';
  head.innerHTML = '<span class="lrec-player-title">' + sanitize(title) + '</span>';

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'lrec-player-close';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.onclick = _lrecClosePlayer;
  head.appendChild(closeBtn);

  var video = document.createElement('video');
  video.className = 'lrec-player-video';
  video.src = url;
  video.controls = true;
  video.autoplay = true;
  video.setAttribute('controlslist', 'nodownload'); // play-only (no download)
  video.setAttribute('disablepictureinpicture', '');

  box.appendChild(head);
  box.appendChild(video);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Esc closes the player.
  document.addEventListener('keydown', _lrecPlayerKeydown, true);
}

function _lrecPlayerKeydown(e) {
  if (e.key === 'Escape') _lrecClosePlayer();
}

function _lrecClosePlayer() {
  var overlay = document.getElementById('lrec-player-overlay');
  if (overlay) {
    var v = overlay.querySelector('video');
    if (v) { try { v.pause(); v.src = ''; v.load(); } catch (e) {} }
    overlay.remove();
  }
  document.removeEventListener('keydown', _lrecPlayerKeydown, true);
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function _lrecMsg(text) {
  return '<div style="text-align:center;color:var(--muted);padding:40px 16px;border:1px dashed var(--border);' +
    'border-radius:12px;background:rgba(255,255,255,0.02);">' + sanitize(text) + '</div>';
}

function _lrecFmtDate(iso) {
  if (!iso) return '';
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) { return ''; }
}

function _lrecFmtDuration(seconds) {
  var s = Math.max(0, Math.floor(seconds));
  var m = Math.floor(s / 60);
  var sec = s % 60;
  var h = Math.floor(m / 60);
  var mm = m % 60;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  if (h > 0) return h + ':' + pad(mm) + ':' + pad(sec);
  return m + ':' + pad(sec);
}

// Ensure the recordings panel is closed + the class list restored. Called when
// the Live page (re)opens so navigating away and back always lands on the class
// list, never a stale-open recordings panel. Idempotent + safe if markup absent.
function lrecEnsureClosed() {
  _lrecClosePlayer();
  if (!_lrecOpen) return;
  _lrecOpen = false;
  var panel = document.getElementById('live-recordings-panel');
  var list = document.getElementById('live-list');
  var btn = document.getElementById('live-recordings-btn');
  if (panel) panel.style.display = 'none';
  if (list) list.style.display = 'flex';
  if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-outline'); }
}
