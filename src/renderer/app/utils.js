/**
 * CodingKida Desktop — Shared Utilities
 * Core helper functions used across all modules.
 */

// ─── DOM Sanitize (XSS prevention) ──────────────────────────────────────────
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── Auth UI Helpers ─────────────────────────────────────────────────────────
function showAuthError(formId, message) {
  const el = document.getElementById(formId + '-error');
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function hideAuthError(formId) {
  const el = document.getElementById(formId + '-error');
  if (el) el.style.display = 'none';
}

function setButtonLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : defaultText;
}

// ─── User Identity ───────────────────────────────────────────────────────────
function getCurrentUserId() {
  const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
  return cached.id || cached.userId || '';
}

// ─── URL Helpers ─────────────────────────────────────────────────────────────
function _openUrl(url) {
  if (window.electron && window.electron.openExternal) {
    window.electron.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

// ─── Video Duration Detection (HTML5 metadata) ───────────────────────────────

/**
 * In-memory cache for detected video durations.
 * Key = videoUrl, Value = duration in seconds (number)
 */
var _videoDurationCache = {};

/**
 * Detect the real duration of a video using HTML5 video metadata.
 * Returns a Promise that resolves to duration in seconds (number).
 * Uses preload="metadata" — only downloads headers, not full video.
 * Results are cached per URL.
 *
 * @param {string} videoUrl - The video URL to detect duration for
 * @returns {Promise<number>} Duration in seconds, or 0 on failure
 */
function detectVideoDuration(videoUrl) {
  if (!videoUrl || videoUrl === '') return Promise.resolve(0);

  // Return cached value if available
  if (_videoDurationCache[videoUrl] !== undefined) {
    return Promise.resolve(_videoDurationCache[videoUrl]);
  }

  return new Promise(function(resolve) {
    var video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.style.display = 'none';

    var timeout = setTimeout(function() {
      cleanup();
      _videoDurationCache[videoUrl] = 0;
      resolve(0);
    }, 8000); // 8s timeout

    function cleanup() {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      video.remove();
    }

    video.onloadedmetadata = function() {
      var dur = video.duration;
      cleanup();
      if (isFinite(dur) && dur > 0) {
        _videoDurationCache[videoUrl] = dur;
        resolve(dur);
      } else {
        _videoDurationCache[videoUrl] = 0;
        resolve(0);
      }
    };

    video.onerror = function() {
      cleanup();
      _videoDurationCache[videoUrl] = 0;
      resolve(0);
    };

    document.body.appendChild(video);
    video.src = videoUrl;
  });
}

/**
 * Detect durations for multiple video URLs in parallel.
 * @param {Array<{id: string, videoUrl: string}>} lessons - Array of lesson objects with videoUrl
 * @returns {Promise<Object>} Map of lessonId → duration in seconds
 */
function detectAllDurations(lessons) {
  var promises = lessons.map(function(l) {
    return detectVideoDuration(l.videoUrl || '').then(function(dur) {
      return { id: l.id, duration: dur };
    });
  });
  return Promise.all(promises).then(function(results) {
    var map = {};
    results.forEach(function(r) { map[r.id] = r.duration; });
    return map;
  });
}

/**
 * Format seconds into a human-readable duration string.
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted string: "HH:MM:SS" or "MM:SS"
 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '--';
  seconds = Math.round(seconds);
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  if (h > 0) {
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

/**
 * Format total seconds into a readable course duration.
 * @param {number} totalSec - Total seconds
 * @returns {string} e.g. "2 Hours 15 Mins", "45 Mins", "30 Sec"
 */
function formatCourseDuration(totalSec) {
  if (!totalSec || totalSec <= 0) return '0 Mins';
  totalSec = Math.round(totalSec);
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  if (h > 0) return h + ' Hour' + (h > 1 ? 's' : '') + (m > 0 ? ' ' + m + ' Mins' : '');
  if (m > 0) return m + ' Min' + (m > 1 ? 's' : '') + (s > 0 ? ' ' + s + ' Sec' : '');
  return s + ' Sec';
}
