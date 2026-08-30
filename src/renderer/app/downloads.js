/**
 * CodingKida Desktop — Downloads & Offline Content
 * Watchlist (localStorage), offline downloads (Electron IPC).
 */

// ─── Downloads (Watchlist) ───────────────────────────────────────────────────

function _showWatchlistToast(message, isError) {
  let toast = document.getElementById('watchlist-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'watchlist-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:600;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.background = isError ? 'rgba(239,68,68,0.95)' : 'rgba(34,197,94,0.95)';
  toast.style.color = '#fff';
  toast.style.opacity = '1';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function _updateSaveBtn(isSaved) {
  const btn = document.getElementById('save-download-btn');
  if (!btn) return;
  if (isSaved) {
    btn.innerHTML = '<i class="fas fa-check"></i> Already Saved!';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  } else {
    btn.innerHTML = '<i class="fas fa-bookmark"></i> Save to Watchlist';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

function saveToDownloads() {
  if (!_currentVideoData) return;
  const { lessonId, title, courseTitle, moduleTitle, videoUrl } = _currentVideoData;
  if (!videoUrl) {
    _showWatchlistToast('No video available for this lesson.', true);
    return;
  }
  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const exists = downloads.find(d => d.lessonId === lessonId);
  if (exists) {
    _showWatchlistToast('\u2139\ufe0f This video is already saved in your Watchlist!', false);
    _updateSaveBtn(true);
    return;
  }
  downloads.push({ lessonId, title, courseTitle, moduleTitle, videoUrl: videoUrl.split('?')[0], savedAt: new Date().toISOString(), courseId: (_currentLessonContext ? _currentLessonContext.courseId : null), moduleId: (_currentLessonContext ? _currentLessonContext.moduleId : null) });
  localStorage.setItem(storageKey, JSON.stringify(downloads));
  _updateSaveBtn(true);
  _showWatchlistToast('\u2705 Saved to Watchlist: ' + (courseTitle || '') + (moduleTitle ? ' · ' + moduleTitle : '') + ' · ' + title, false);
}

var _wlFilter = 'all';
var _wlCompletedCache = {}; // courseId → Set of completed lessonIds

function setWlFilter(filter, btn) {
  _wlFilter = filter;
  document.querySelectorAll('.wl-filter').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  _renderWlList();
}

function renderDownloads() {
  const container = document.getElementById('downloads-list');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');

  if(downloads.length === 0) {
    _renderWlList();
    return;
  }

  // Fetch completion data for courses that have courseId
  var courseIds = [];
  downloads.forEach(function(d) {
    if(d.courseId && courseIds.indexOf(d.courseId) === -1) courseIds.push(d.courseId);
  });

  if(courseIds.length === 0) {
    _renderWlList();
    return;
  }

  // Fetch completion for each unique course (reuse existing API)
  var fetched = 0;
  courseIds.forEach(function(cid) {
    CoursesAPI.getById(cid).then(function(data) {
      if(data.success && data.course && data.course.completedLessons) {
        _wlCompletedCache[cid] = new Set(data.course.completedLessons);
      }
    }).catch(function(){}).finally(function() {
      fetched++;
      if(fetched >= courseIds.length) _renderWlList();
    });
  });
}

function _getWlLessonStatus(d) {
  // Completed = in completedLessons from backend
  if(d.courseId && _wlCompletedCache[d.courseId]) {
    var completedSet = _wlCompletedCache[d.courseId];
    if(completedSet.has(d.lessonId)) return 'completed';
  }
  // In Progress = user opened the lesson (tracked in localStorage) but not completed
  var userId = getCurrentUserId();
  var startedKey = userId ? 'ck_started_' + userId : 'ck_started';
  var startedLessons = JSON.parse(localStorage.getItem(startedKey) || '[]');
  if(startedLessons.indexOf(d.lessonId) !== -1) return 'in-progress';
  return 'not-started';
}

function _renderWlList() {
  const container = document.getElementById('downloads-list');
  if (!container) return;
  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');

  // Search
  var searchVal = (document.getElementById('wl-search') || {}).value || '';
  searchVal = searchVal.trim().toLowerCase();

  var filtered = downloads;
  if(searchVal) {
    filtered = filtered.filter(function(d) {
      return (d.title || '').toLowerCase().includes(searchVal) ||
        (d.courseTitle || '').toLowerCase().includes(searchVal) ||
        (d.moduleTitle || '').toLowerCase().includes(searchVal);
    });
  }

  // Status filter
  if(_wlFilter === 'completed') {
    filtered = filtered.filter(function(d){ return _getWlLessonStatus(d) === 'completed'; });
  } else if(_wlFilter === 'in-progress') {
    filtered = filtered.filter(function(d){ return _getWlLessonStatus(d) === 'in-progress'; });
  }

  // Empty states
  if(downloads.length === 0) {
    container.innerHTML =
      '<div class="wl-empty">' +
      '<div class="wl-empty-icon"><i class="fas fa-bookmark"></i></div>' +
      '<h3 class="wl-empty-title">My Watchlist is empty</h3>' +
      '<p class="wl-empty-desc">Save lessons you want to learn later and they\'ll appear here.</p>' +
      '<button class="wl-empty-btn" onclick="navigate(\'courses\')"><i class="fas fa-compass"></i> Explore Courses</button>' +
      '</div>';
    return;
  }

  if(filtered.length === 0) {
    var emptyMsg = 'No lessons found';
    if(_wlFilter === 'completed') emptyMsg = 'No completed lessons yet';
    else if(_wlFilter === 'in-progress') emptyMsg = 'No lessons in progress';
    else if(searchVal) emptyMsg = 'No lessons match "' + sanitize(searchVal) + '"';
    container.innerHTML =
      '<div class="wl-empty">' +
      '<div class="wl-empty-icon"><i class="fas fa-search"></i></div>' +
      '<h3 class="wl-empty-title">' + emptyMsg + '</h3>' +
      '<p class="wl-empty-desc">Try a different search or filter.</p>' +
      '</div>';
    return;
  }

  // Group
  var grouped = {};
  filtered.forEach(function(d) {
    var course = d.courseTitle || 'Uncategorized';
    var module = d.moduleTitle || 'General';
    if (!grouped[course]) grouped[course] = {};
    if (!grouped[course][module]) grouped[course][module] = [];
    grouped[course][module].push({ data: d, index: downloads.indexOf(d) });
  });

  var html = '';
  var courseIdx = 0;
  Object.keys(grouped).forEach(function(course) {
    var lessonCount = 0;
    Object.keys(grouped[course]).forEach(function(m){ lessonCount += grouped[course][m].length; });

    // Determine course logo
    var cLower = course.toLowerCase().trim();
    var logoSrc = '';
    if(cLower === 'c' || cLower.includes('c programming')) logoSrc = 'assets/c-logo.png';
    else if(cLower.includes('java')) logoSrc = 'assets/java-logo.png';
    else if(cLower.includes('python')) logoSrc = 'assets/python-logo.png';

    var isFirst = courseIdx === 0;
    courseIdx++;

    html += '<div class="wl-course' + (isFirst ? ' wl-course-open' : '') + '">';
    // Course header with logo + expand/collapse
    html += '<div class="wl-course-header" onclick="this.parentElement.classList.toggle(\'wl-course-open\')">';
    if(logoSrc) {
      html += '<img src="' + logoSrc + '" class="wl-course-logo" draggable="false"/>';
    } else {
      html += '<div class="wl-course-avatar">' + sanitize(course).charAt(0) + '</div>';
    }
    html += '<div class="wl-course-info"><span class="wl-course-name">' + sanitize(course) + '</span><span class="wl-course-meta">' + lessonCount + ' saved lesson' + (lessonCount > 1 ? 's' : '') + '</span></div>';
    html += '<i class="fas fa-chevron-down wl-course-chevron"></i>';
    html += '</div>';

    // Course body (collapsible)
    html += '<div class="wl-course-body">';

    Object.keys(grouped[course]).forEach(function(module) {
      html += '<div class="wl-module">';
      html += '<div class="wl-module-header"><span class="wl-module-accent"></span><span class="wl-module-name">' + sanitize(module) + '</span><span class="wl-module-count">' + grouped[course][module].length + '</span></div>';

      grouped[course][module].forEach(function(item, lessonIdx) {
        var d = item.data;
        var idx = item.index;
        var hasFullContext = d.courseId && d.moduleId;
        var status = _getWlLessonStatus(d);

        var actionLabel, actionIcon, statusHtml, statusClass;
        if(status === 'completed') {
          actionLabel = 'Watch Again'; actionIcon = 'fa-redo';
          statusHtml = '<span class="wl-lesson-status wl-ls-done"><i class="fas fa-check-circle"></i> Completed</span>';
          statusClass = ' wl-lesson-done';
        } else if(status === 'in-progress') {
          actionLabel = 'Continue'; actionIcon = 'fa-arrow-right';
          statusHtml = '<span class="wl-lesson-status wl-ls-progress"><i class="fas fa-play-circle"></i> In Progress</span>';
          statusClass = ' wl-lesson-progress';
        } else {
          actionLabel = 'Start Learning'; actionIcon = 'fa-arrow-right';
          statusHtml = '';
          statusClass = '';
        }

        html += '<div class="wl-lesson' + statusClass + '">';
        html += '<div class="wl-lesson-body">';
        html += '<div class="wl-lesson-num">' + (lessonIdx < 9 ? '0' : '') + (lessonIdx + 1) + '</div>';
        html += '<div class="wl-lesson-content">';
        html += '<span class="wl-lesson-title">' + sanitize(d.title) + '</span>';
        html += '<span class="wl-lesson-context">' + sanitize(d.moduleTitle || module) + '</span>';
        if(statusHtml) html += statusHtml;
        html += '</div>';
        html += '</div>';
        html += '<div class="wl-lesson-actions">';
        if(hasFullContext) {
          html += '<button class="wl-action-btn' + (status === 'completed' ? ' wl-action-done' : (status === 'in-progress' ? ' wl-action-continue' : '')) + '" onclick="openVideoFromBackend(\'' + d.courseId + '\',\'' + d.moduleId + '\',\'' + d.lessonId + '\')"><span>' + actionLabel + '</span> <i class="fas ' + actionIcon + '"></i></button>';
        } else {
          html += '<button class="wl-action-btn wl-action-done" onclick="playDownloadedVideo(' + idx + ')"><span>Watch</span> <i class="fas fa-play"></i></button>';
        }
        html += '<button class="wl-bookmark-btn" onclick="removeFromWatchlist(' + idx + ')" title="Remove"><i class="fas fa-bookmark"></i></button>';
        html += '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>'; // wl-course-body
    html += '</div>'; // wl-course
  });

  container.innerHTML = html;
}

var _wlUndoTimer = null;
function removeFromWatchlist(index) {
  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');
  var removed = downloads.splice(index, 1)[0];
  localStorage.setItem(storageKey, JSON.stringify(downloads));
  renderDownloads();
  // Show toast with undo
  var toast = document.getElementById('watchlist-toast');
  if(!toast) {
    toast = document.createElement('div');
    toast.id = 'watchlist-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:600;z-index:9999;transition:opacity 0.3s;display:flex;align-items:center;gap:12px;';
    document.body.appendChild(toast);
  }
  toast.style.background = 'rgba(15,15,35,0.95)';
  toast.style.border = '1px solid rgba(139,92,246,0.3)';
  toast.style.color = '#fff';
  toast.style.opacity = '1';
  toast.innerHTML = '<span>Removed from Watchlist</span><button onclick="undoWatchlistRemove()" style="background:rgba(139,92,246,0.2);border:1px solid rgba(139,92,246,0.4);color:#a78bfa;padding:4px 10px;border-radius:6px;font-size:0.75rem;font-weight:700;cursor:pointer;">Undo</button>';
  // Store for undo
  window._wlUndoData = { item: removed, index: index, storageKey: storageKey };
  clearTimeout(_wlUndoTimer);
  _wlUndoTimer = setTimeout(function() { toast.style.opacity = '0'; window._wlUndoData = null; }, 5000);
}

function undoWatchlistRemove() {
  if(!window._wlUndoData) return;
  var data = window._wlUndoData;
  var downloads = JSON.parse(localStorage.getItem(data.storageKey) || '[]');
  downloads.splice(data.index, 0, data.item);
  localStorage.setItem(data.storageKey, JSON.stringify(downloads));
  window._wlUndoData = null;
  renderDownloads();
  var toast = document.getElementById('watchlist-toast');
  if(toast) { toast.innerHTML = '<span>Restored!</span>'; setTimeout(function(){ toast.style.opacity = '0'; }, 1500); }
}

async function playDownloadedVideo(index) {
  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');
  const d = downloads[index];
  if (!d) return;
  try {
    document.getElementById('video-title').textContent = d.title || '';
    document.getElementById('video-meta').textContent = (d.courseTitle || '') + (d.moduleTitle ? ' · ' + d.moduleTitle : '');
    // Get fresh signed URL before playing — stored URL may be expired
    let playUrl = d.videoUrl || '';
    if (playUrl && playUrl.includes('amazonaws.com')) {
      const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
      try {
        const res = await fetch(BASE_URL + '/api/media/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ url: playUrl }),
        });
        if (res.ok) { const data = await res.json(); if (data.signedUrl) playUrl = data.signedUrl; }
      } catch {}
    }
    await loadVideo(playUrl);
    _currentVideoData = { ...d, videoUrl: playUrl };
    _updateSaveBtn(true);
    const notesEl = document.getElementById('vp-notes');
    if (notesEl) renderNotesTab('', []);
    const quizEl = document.getElementById('vp-quiz');
    if (quizEl) renderQuizTab(null);
    const exEl = document.getElementById('vp-exercise');
    if (exEl) renderExerciseTab(null);
    document.querySelectorAll('.vp-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.querySelectorAll('.vp-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));
    navigate('video');
  } catch { alert('Could not play video. Please try again.'); }
}

function removeDownload(index) {
  removeFromWatchlist(index);
}

// ─── Offline Downloads ───────────────────────────────────────────────────────────────

async function downloadOffline() {
  if (!window.electron || !window.electron.downloadContent) {
    alert('Downloads only available in the desktop app.');
    return;
  }
  if (!_currentVideoData) return;

  const userId = getCurrentUserId();
  if (!userId) { alert('Please log in to download.'); return; }

  const btn = document.getElementById('offline-download-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...'; btn.style.background = 'rgba(255,255,255,0.1)'; }

  const { lessonId, title, courseTitle, moduleTitle, videoUrl } = _currentVideoData;
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  // Get signed URL immediately before passing to main process — minimises TTL gap
  async function getSignedUrl(url) {
    if (!url || !url.includes('amazonaws.com')) return url;
    try {
      const res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ url, forDownload: true }),
      });
      if (res.ok) { const d = await res.json(); if (d.signedUrl) return d.signedUrl; }
    } catch {}
    return url;
  }

  if (!videoUrl) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Download Lesson'; btn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)'; }
    alert('No video available for this lesson.');
    return;
  }

  try {
    const dlUrl = await getSignedUrl(videoUrl);
    const result = await window.electron.downloadContent({ url: dlUrl, lessonId, title, type: 'video', userId, courseTitle, moduleTitle });
    if (btn) {
      btn.disabled = result.success;
      btn.innerHTML = result.success
        ? '<i class="fas fa-check"></i> Downloaded!'
        : '<i class="fas fa-download"></i> Download Lesson';
      btn.style.background = result.success ? 'var(--success)' : 'linear-gradient(135deg,#6c47ff,#ec4899)';
    }
    if (!result.success && result.message !== 'Already downloaded.') {
      alert('Download failed: ' + result.message);
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-download"></i> Download Lesson'; btn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)'; }
    alert('Download failed: ' + (err.message || 'Please try again.'));
  }
}

// Download PDF separately for offline viewing
async function downloadPdfOffline(notesUrl) {
  if (!window.electron || !window.electron.downloadContent) {
    alert('Downloads only available in the desktop app.');
    return;
  }
  if (!notesUrl) { alert('No PDF available.'); return; }
  const userId = getCurrentUserId();
  if (!userId) { alert('Please log in to download.'); return; }
  if (!_currentVideoData) { alert('Please open a lesson first.'); return; }

  const { lessonId, title, courseTitle, moduleTitle } = _currentVideoData;
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  const pdfBtn = document.getElementById('pdf-download-btn');
  if (pdfBtn) { pdfBtn.disabled = true; pdfBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...'; }

  try {
    // Get signed URL immediately before passing to main process
    let dlUrl = notesUrl;
    if (notesUrl.includes('amazonaws.com')) {
      const res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ url: notesUrl, forDownload: true }),
      });
      if (res.ok) { const d = await res.json(); if (d.signedUrl) dlUrl = d.signedUrl; }
    }
    const result = await window.electron.downloadContent({ url: dlUrl, lessonId, title: title + ' (PDF)', type: 'pdf', userId, courseTitle, moduleTitle });
    if (result.success) {
      if (pdfBtn) {
        pdfBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded';
        pdfBtn.style.borderColor = 'rgba(34,197,94,0.6)';
        pdfBtn.style.color = '#22c55e';
        pdfBtn.style.pointerEvents = 'none';
        pdfBtn.style.opacity = '0.8';
      }
    } else {
      if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.innerHTML = '<i class="fas fa-download"></i> Download PDF'; }
      if (result.message !== 'Already downloaded.') alert('PDF download failed: ' + result.message);
    }
  } catch (err) {
    if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.innerHTML = '<i class="fas fa-download"></i> Download PDF'; }
    alert('PDF download failed: ' + (err.message || 'Please try again.'));
  }
}

async function renderOfflineDownloads() {
  const container = document.getElementById('offline-downloads-list');
  if (!container) return;

  if (!window.electron || !window.electron.getDownloads) {
    container.innerHTML = '<div class="dl-empty"><div class="dl-empty-icon"><i class="fas fa-desktop"></i></div><h3 class="dl-empty-title">Desktop App Required</h3><p class="dl-empty-desc">Downloads are only available in the CodingKida desktop app.</p></div>';
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    container.innerHTML = '<div class="dl-empty"><div class="dl-empty-icon"><i class="fas fa-user-lock"></i></div><h3 class="dl-empty-title">Please Log In</h3><p class="dl-empty-desc">Log in to view your downloaded lessons.</p></div>';
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:0.82rem;"><i class="fas fa-spinner fa-spin"></i> Loading downloads...</div>';
  const result = await window.electron.getDownloads({ userId });

  if (!result.success || result.downloads.length === 0) {
    container.innerHTML =
      '<div class="dl-empty">' +
      '<div class="dl-empty-icon"><i class="fas fa-cloud-download-alt"></i></div>' +
      '<h3 class="dl-empty-title">No Offline Lessons Yet</h3>' +
      '<p class="dl-empty-desc">Download lessons to keep learning even without an internet connection.</p>' +
      '<button class="dl-empty-btn" onclick="navigate(\'courses\')"><i class="fas fa-compass"></i> Explore Courses</button>' +
      '</div>';
    return;
  }

  // Group by courseTitle → moduleTitle → items
  var searchVal = (document.getElementById('dl-search') || {}).value || '';
  searchVal = searchVal.trim().toLowerCase();
  var dlFiltered = result.downloads;
  if(searchVal) {
    dlFiltered = dlFiltered.filter(function(d) {
      return (d.title || '').toLowerCase().includes(searchVal) ||
        (d.courseTitle || '').toLowerCase().includes(searchVal) ||
        (d.moduleTitle || '').toLowerCase().includes(searchVal);
    });
  }

  if(dlFiltered.length === 0 && searchVal) {
    container.innerHTML = '<div class="dl-empty"><div class="dl-empty-icon"><i class="fas fa-search"></i></div><h3 class="dl-empty-title">No downloads match "' + sanitize(searchVal) + '"</h3><p class="dl-empty-desc">Try a different search term.</p></div>';
    return;
  }

  const grouped = {};
  dlFiltered.forEach(function(d) {
    const course = d.courseTitle || 'Uncategorized';
    const module = d.moduleTitle || 'General';
    if (!grouped[course]) grouped[course] = {};
    if (!grouped[course][module]) grouped[course][module] = [];
    grouped[course][module].push(d);
  });

  let html = '';
  var dlCourseIdx = 0;
  Object.keys(grouped).forEach(function(course) {
    var totalItems = 0;
    Object.keys(grouped[course]).forEach(function(m){ totalItems += grouped[course][m].length; });

    // Course logo
    var cLower = course.toLowerCase().trim();
    var logoSrc = '';
    if(cLower === 'c' || cLower.includes('c programming')) logoSrc = 'assets/c-logo.png';
    else if(cLower.includes('java')) logoSrc = 'assets/java-logo.png';
    else if(cLower.includes('python')) logoSrc = 'assets/python-logo.png';

    var isFirst = dlCourseIdx === 0;
    dlCourseIdx++;

    html += '<div class="dl-course' + (isFirst ? ' dl-course-open' : '') + '">';
    html += '<div class="dl-course-header" onclick="this.parentElement.classList.toggle(\'dl-course-open\')">';
    if(logoSrc) {
      html += '<img src="' + logoSrc + '" class="dl-course-logo" draggable="false"/>';
    } else {
      html += '<div class="dl-course-avatar">' + sanitize(course).charAt(0) + '</div>';
    }
    html += '<div class="dl-course-info"><span class="dl-course-name">' + sanitize(course) + '</span><span class="dl-course-meta">' + totalItems + ' downloaded item' + (totalItems > 1 ? 's' : '') + '</span></div>';
    html += '<i class="fas fa-chevron-down dl-course-chevron"></i>';
    html += '</div>';

    html += '<div class="dl-course-body">';

    Object.keys(grouped[course]).forEach(function(module) {
      var moduleItems = grouped[course][module];
      var videoItems = moduleItems.filter(function(d) { return d.type === 'video'; });
      var pdfItems = moduleItems.filter(function(d) { return d.type === 'pdf'; });

      html += '<div class="dl-module' + (Object.keys(grouped[course]).indexOf(module) === 0 ? ' dl-mod-open' : '') + '">';
      html += '<div class="dl-module-header" onclick="this.parentElement.classList.toggle(\'dl-mod-open\')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;"><div style="display:flex;align-items:center;gap:10px;"><span class="dl-module-accent"></span><span class="dl-module-name">' + sanitize(module) + '</span><span style="font-size:0.7rem;color:var(--muted);background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:10px;">' + moduleItems.length + ' items</span></div><i class="fas fa-chevron-down" style="font-size:0.65rem;color:var(--muted);transition:transform 0.2s;"></i></div>';

      // Lesson Videos sub-section (collapsible)
      if (videoItems.length > 0) {
        html += '<div class="dl-sub-section">';
        html += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'i\').classList.toggle(\'fa-chevron-down\');this.querySelector(\'i\').classList.toggle(\'fa-chevron-right\')" style="display:flex;align-items:center;gap:6px;padding:6px 12px;cursor:pointer;"><i class="fas fa-chevron-down" style="font-size:0.55rem;color:var(--muted);transition:transform 0.2s;width:10px;"></i><i class="fas fa-play-circle" style="color:#a78bfa;font-size:0.7rem;"></i><span style="font-size:0.72rem;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:0.4px;">Lesson Videos</span><span style="font-size:0.62rem;color:var(--muted);margin-left:auto;">' + videoItems.length + '</span></div>';
        html += '<div>';
        videoItems.forEach(function(d) {
          html += '<div class="dl-lesson"><div class="dl-lesson-body"><div class="dl-lesson-icon" style="color:#22c55e;border-color:#22c55e30;"><i class="fas fa-play-circle"></i></div><div class="dl-lesson-content"><span class="dl-lesson-title">' + sanitize(d.title) + '</span><span class="dl-lesson-meta"><span class="dl-type-badge">Video</span>';
          if(d.daysLeft !== undefined) html += ' <span class="dl-expiry">Expires in ' + d.daysLeft + ' day' + (d.daysLeft !== 1 ? 's' : '') + '</span>';
          html += '</span></div></div><div class="dl-lesson-actions"><button class="dl-action-btn" onclick="playOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')"><i class="fas fa-play"></i> Watch</button><button class="dl-remove-btn" onclick="deleteOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')" title="Remove"><i class="fas fa-trash-alt"></i></button></div></div>';
        });
        html += '</div></div>';
      }

      // Study Material sub-section (collapsible) — includes lesson PDFs + admin-uploaded materials
      if (pdfItems.length > 0) {
        html += '<div class="dl-sub-section">';
        html += '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'i\').classList.toggle(\'fa-chevron-down\');this.querySelector(\'i\').classList.toggle(\'fa-chevron-right\')" style="display:flex;align-items:center;gap:6px;padding:6px 12px;cursor:pointer;border-top:1px solid rgba(255,255,255,0.04);margin-top:2px;"><i class="fas fa-chevron-down" style="font-size:0.55rem;color:var(--muted);transition:transform 0.2s;width:10px;"></i><i class="fas fa-book-open" style="color:#a78bfa;font-size:0.7rem;"></i><span style="font-size:0.72rem;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:0.4px;">Study Material</span><span style="font-size:0.62rem;color:var(--muted);margin-left:auto;">' + pdfItems.length + '</span></div>';
        html += '<div>';
        pdfItems.forEach(function(d) {
          html += '<div class="dl-lesson"><div class="dl-lesson-body"><div class="dl-lesson-icon" style="color:#ef4444;border-color:#ef444430;"><i class="fas fa-file-pdf"></i></div><div class="dl-lesson-content"><span class="dl-lesson-title">' + sanitize(d.title) + '</span><span class="dl-lesson-meta"><span class="dl-type-badge">' + (d.lessonId && d.lessonId.startsWith('material_') ? 'Study Material' : 'PDF Notes') + '</span>';
          if(d.daysLeft !== undefined) html += ' <span class="dl-expiry">Expires in ' + d.daysLeft + ' day' + (d.daysLeft !== 1 ? 's' : '') + '</span>';
          html += '</span></div></div><div class="dl-lesson-actions"><button class="dl-action-btn" onclick="playOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')"><i class="fas fa-eye"></i> View</button><button class="dl-remove-btn" onclick="deleteOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')" title="Remove"><i class="fas fa-trash-alt"></i></button></div></div>';
        });
        html += '</div></div>';
      }

      html += '</div>';
    });

    html += '</div>';
    html += '</div>';
  });

  container.innerHTML = html;
}

/**
 * Restore online video page UI (undo offline playback changes).
 * Called when openVideoFromBackend is used for online lesson.
 */
function _restoreOnlineVideoUI() {
  // Show all tabs
  document.querySelectorAll('.vp-tab').forEach(function(t){ t.style.display = ''; });
  // Show right sidebar
  var rightPanel = document.querySelector('.vp-right');
  if(rightPanel) rightPanel.style.display = '';
  // Restore grid
  var vpBody = document.querySelector('.vp-body');
  if(vpBody) vpBody.style.gridTemplateColumns = '';
  // Restore engagement bar
  var engagementBar = document.getElementById('vp-engagement-bar');
  if(engagementBar) { engagementBar.style.pointerEvents = ''; engagementBar.style.opacity = ''; }
  // Restore video height constraints
  var vpVideoWrap = document.querySelector('.vp-video-wrap');
  if(vpVideoWrap) vpVideoWrap.style.maxHeight = '';
  var vpVideo = document.getElementById('video-player');
  if(vpVideo) { vpVideo.style.maxHeight = ''; vpVideo.style.objectFit = ''; }
  var vpIframe = document.getElementById('video-iframe');
  if(vpIframe) vpIframe.style.maxHeight = '';
}

async function playOfflineContent(lessonId, type) {
  if (!window.electron || !window.electron.playDownload) return;
  const userId = getCurrentUserId();
  const result = await window.electron.playDownload({ lessonId, type, userId });
  if (!result.success) { alert(result.message || 'Playback failed.'); return; }

  if (type === 'pdf') {
    _openPdfInCanvas(result.serveUrl);
  } else {
    const iframeEl = document.getElementById('video-iframe');
    const videoEl = document.getElementById('video-player');
    if (iframeEl) { iframeEl.style.display = 'none'; iframeEl.src = ''; }
    if (videoEl) { videoEl.style.display = 'block'; videoEl.src = result.serveUrl; }
    navigate('video');

    // Offline playback: hide online-only tabs + right sidebar
    _applyOfflinePlaybackUI(lessonId, userId);
  }
}

/**
 * Apply offline-appropriate UI after navigating to video page from Downloads.
 * Hides online-only features (Quiz, Exercise, Homework, Rate, AI Mentor).
 * Shows Notes only if a PDF is also downloaded for this lesson.
 */
function _applyOfflinePlaybackUI(lessonId, userId) {
  // Hide online-only tabs (these require network/backend data)
  var tabs = document.querySelectorAll('.vp-tab');
  tabs.forEach(function(tab) {
    var panel = tab.getAttribute('onclick') || '';
    if(panel.includes('vp-quiz') || panel.includes('vp-exercise') || panel.includes('vp-homework') || panel.includes('vp-rate') || panel.includes('vp-chat')) {
      tab.style.display = 'none';
    } else {
      tab.style.display = '';
    }
  });

  // Hide right sidebar (Course Content / Progress — requires online data)
  var rightPanel = document.querySelector('.vp-right');
  if(rightPanel) rightPanel.style.display = 'none';

  // Make video area full width (expand into space freed by hidden right panel)
  var vpBody = document.querySelector('.vp-body');
  if(vpBody) vpBody.style.gridTemplateColumns = '1fr';

  // Constrain video height so video + controls + content below all fit in viewport
  // Uses max-height with calc to leave room for topbar (~60px), engagement bar (~50px), tabs (~46px), notes (~100px)
  var vpVideoWrap = document.querySelector('.vp-video-wrap');
  if(vpVideoWrap) vpVideoWrap.style.maxHeight = 'calc(100vh - 260px)';
  // Ensure custom video player container is visible (it starts display:none in HTML)
  var customPlayer = document.getElementById('custom-video-player');
  if(customPlayer) customPlayer.style.display = 'block';
  // Constrain the video element itself to fit within the wrap and maintain aspect ratio
  var vpVideo = document.getElementById('video-player');
  if(vpVideo) { vpVideo.style.maxHeight = 'calc(100vh - 260px)'; vpVideo.style.objectFit = 'contain'; }
  // Also constrain iframe for YouTube-type embeds
  var vpIframe = document.getElementById('video-iframe');
  if(vpIframe && vpIframe.style.display !== 'none') { vpIframe.style.maxHeight = 'calc(100vh - 260px)'; }

  // Show engagement bar (Downloads bypasses openVideoFromBackend which normally shows it)
  // Disabled since like/dislike require network
  var engagementBar = document.getElementById('vp-engagement-bar');
  if(engagementBar) { engagementBar.style.display = 'flex'; engagementBar.style.pointerEvents = 'none'; engagementBar.style.opacity = '0.5'; }

  // Hide Next Lesson float (requires online course context)
  var nextFloat = document.getElementById('next-lesson-float');
  if(nextFloat) nextFloat.style.display = 'none';

  // Check if PDF/Notes is also downloaded for this lesson
  if(window.electron && window.electron.getDownloads) {
    window.electron.getDownloads({ userId: userId }).then(function(res) {
      if(res.success) {
        var pdfItem = res.downloads.find(function(d){ return d.lessonId === lessonId && d.type === 'pdf'; });
        var notesEl = document.getElementById('vp-notes');
        if(notesEl) {
          if(pdfItem) {
            notesEl.innerHTML = '<div class="tab-card notes-card"><div class="notes-card-content"><div class="tab-card-title"><i class="fas fa-file-alt"></i> Lesson Notes</div><p class="notes-card-desc">Offline notes available for this lesson.</p><div style="margin-top:16px;display:flex;gap:10px;"><button class="btn btn-outline btn-sm" style="padding:10px 20px;border-radius:10px;display:flex;align-items:center;gap:8px;" onclick="playOfflineContent(\'' + lessonId + '\',\'pdf\')"><i class="fas fa-file-pdf" style="color:#ef4444;"></i> View PDF Notes</button></div></div></div>';
          } else {
            notesEl.innerHTML = '<div class="tab-card"><div class="tab-card-title"><i class="fas fa-file-alt"></i> Lesson Notes</div><p style="color:var(--muted);font-size:0.85rem;">Notes not downloaded for offline use. Download the PDF from the lesson page when online.</p></div>';
          }
        }
      }
    }).catch(function(){});
  } else {
    var notesEl = document.getElementById('vp-notes');
    if(notesEl) notesEl.innerHTML = '<div class="tab-card"><div class="tab-card-title"><i class="fas fa-file-alt"></i> Lesson Notes</div><p style="color:var(--muted);font-size:0.85rem;">Notes unavailable in offline mode.</p></div>';
  }

  // Ensure Notes tab is active
  tabs.forEach(function(t){ t.classList.remove('active'); });
  var notesTab = document.querySelector('.vp-tab[onclick*="vp-notes"]');
  if(notesTab) notesTab.classList.add('active');
  document.querySelectorAll('.vp-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  var notesPanel = document.getElementById('vp-notes');
  if(notesPanel) notesPanel.classList.add('active');
}

async function deleteOfflineContent(lessonId, type) {
  if (!window.electron || !window.electron.deleteDownload) return;
  const userId = getCurrentUserId();
  await window.electron.deleteDownload({ lessonId, type, userId });
  renderOfflineDownloads();
}


/**
 * Download study material PDF (module-level, no lesson required)
 * Used by Study Material section in course detail
 */
async function downloadStudyMaterial(fileUrl, title, moduleTitle, courseTitle) {
  if (!window.electron || !window.electron.downloadContent) {
    alert('Downloads only available in the desktop app.');
    return;
  }
  if (!fileUrl) { alert('No file available.'); return; }
  var userId = getCurrentUserId();
  if (!userId) { alert('Please log in to download.'); return; }
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  try {
    // Get signed URL if S3
    var dlUrl = fileUrl;
    if (fileUrl.includes('amazonaws.com')) {
      var res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ url: fileUrl, forDownload: true }),
      });
      if (res.ok) { var d = await res.json(); if (d.signedUrl) dlUrl = d.signedUrl; }
    }
    var result = await window.electron.downloadContent({
      url: dlUrl,
      lessonId: 'material_' + Date.now(),
      title: title || 'Study Material',
      type: 'pdf',
      userId: userId,
      courseTitle: courseTitle || '',
      moduleTitle: moduleTitle || '',
    });
    if (result.success) {
      alert('✅ Downloaded: ' + (title || 'Study Material'));
    } else {
      alert('⚠️ Download failed: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    alert('⚠️ Download failed. Check your connection.');
  }
}
