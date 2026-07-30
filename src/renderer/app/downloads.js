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
  downloads.push({ lessonId, title, courseTitle, moduleTitle, videoUrl: videoUrl.split('?')[0], savedAt: new Date().toISOString() });
  localStorage.setItem(storageKey, JSON.stringify(downloads));
  _updateSaveBtn(true);
  _showWatchlistToast('\u2705 Saved to Watchlist: ' + (courseTitle || '') + (moduleTitle ? ' · ' + moduleTitle : '') + ' · ' + title, false);
}

function renderDownloads() {
  const container = document.getElementById('downloads-list');
  if (!container) return;
  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (downloads.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:60px 20px">' +
      '<i class="fas fa-bookmark" style="font-size:2.5rem;color:var(--muted);margin-bottom:16px;display:block"></i>' +
      '<p style="color:var(--muted);font-size:0.95rem;font-weight:600">No saved lessons yet</p>' +
      '<p style="color:var(--muted);font-size:0.82rem;margin-top:6px">Open a lesson and click "Save to Watchlist"</p>' +
      '</div>';
    return;
  }

  // Group by courseTitle → moduleTitle → videos
  const grouped = {};
  downloads.forEach((d, i) => {
    const course = d.courseTitle || 'Uncategorized';
    const module = d.moduleTitle || 'General';
    if (!grouped[course]) grouped[course] = {};
    if (!grouped[course][module]) grouped[course][module] = [];
    grouped[course][module].push({ ...d, _index: i });
  });

  let html = '';
  Object.keys(grouped).forEach(course => {
    html += '<div style="margin-bottom:20px">';
    // Course folder header
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(108,71,255,0.1);border:1px solid rgba(108,71,255,0.25);border-radius:12px;margin-bottom:8px">' +
      '<i class="fas fa-folder" style="color:#a78bfa;font-size:1rem"></i>' +
      '<span style="font-weight:700;color:#fff;font-size:0.9rem">' + sanitize(course) + '</span>' +
      '</div>';

    Object.keys(grouped[course]).forEach(module => {
      // Module sub-folder
      html += '<div style="margin-left:16px;margin-bottom:8px">';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin-bottom:6px">' +
        '<i class="fas fa-folder-open" style="color:#6c47ff;font-size:0.85rem"></i>' +
        '<span style="font-weight:600;color:var(--muted);font-size:0.82rem">' + sanitize(module) + '</span>' +
        '</div>';

      grouped[course][module].forEach(d => {
        html += '<div class="download-item" style="margin-left:16px;margin-bottom:6px">' +
          '<div class="download-icon" style="color:var(--primary)"><i class="fas fa-file-video"></i></div>' +
          '<div class="download-info">' +
          '<h4>' + sanitize(d.title) + '</h4>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-primary btn-sm" onclick="playDownloadedVideo(' + d._index + ')"><i class="fas fa-play"></i> Watch</button>' +
          '<button class="btn btn-outline btn-sm" onclick="removeDownload(' + d._index + ')"><i class="fas fa-trash"></i></button>' +
          '</div>' +
          '</div>';
      });

      html += '</div>';
    });

    html += '</div>';
  });

  container.innerHTML = html;
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
  const userId = getCurrentUserId();
  const storageKey = userId ? 'ck_downloads_' + userId : 'ck_downloads';
  const downloads = JSON.parse(localStorage.getItem(storageKey) || '[]');
  downloads.splice(index, 1);
  localStorage.setItem(storageKey, JSON.stringify(downloads));
  renderDownloads();
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
    container.innerHTML = '<p style="color:var(--muted);padding:20px">Downloads only available in the desktop app.</p>';
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    container.innerHTML = '<p style="color:var(--muted);padding:20px">Please log in to view downloads.</p>';
    return;
  }

  container.innerHTML = '<p style="color:var(--muted);padding:20px">Loading...</p>';
  const result = await window.electron.getDownloads({ userId });

  if (!result.success || result.downloads.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:60px 20px">' +
      '<i class="fas fa-download" style="font-size:2.5rem;color:var(--muted);margin-bottom:16px;display:block"></i>' +
      '<p style="color:var(--muted);font-size:0.95rem;font-weight:600">No offline downloads yet</p>' +
      '<p style="color:var(--muted);font-size:0.82rem;margin-top:6px">Open a lesson and click "Download" to save for offline use</p>' +
      '</div>';
    return;
  }

  // Group by courseTitle → moduleTitle → items
  const grouped = {};
  result.downloads.forEach(d => {
    const course = d.courseTitle || 'Uncategorized';
    const module = d.moduleTitle || 'General';
    if (!grouped[course]) grouped[course] = {};
    if (!grouped[course][module]) grouped[course][module] = [];
    grouped[course][module].push(d);
  });

  let html = '';
  Object.keys(grouped).forEach(course => {
    html += '<div style="margin-bottom:20px">';
    // Course folder
    html += '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(108,71,255,0.1);border:1px solid rgba(108,71,255,0.25);border-radius:12px;margin-bottom:8px">' +
      '<i class="fas fa-folder" style="color:#a78bfa;font-size:1rem"></i>' +
      '<span style="font-weight:700;color:#fff;font-size:0.9rem">' + sanitize(course) + '</span>' +
      '</div>';

    Object.keys(grouped[course]).forEach(module => {
      // Module sub-folder
      html += '<div style="margin-left:16px;margin-bottom:8px">';
      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin-bottom:6px">' +
        '<i class="fas fa-folder-open" style="color:#6c47ff;font-size:0.85rem"></i>' +
        '<span style="font-weight:600;color:var(--muted);font-size:0.82rem">' + sanitize(module) + '</span>' +
        '</div>';

      grouped[course][module].forEach(d => {
        const isPdf = d.type === 'pdf';
        const icon = isPdf ? 'fa-file-pdf' : 'fa-file-video';
        const iconColor = isPdf ? '#ef4444' : 'var(--primary)';
        html += '<div class="download-item" style="margin-left:16px;margin-bottom:6px">' +
          '<div class="download-icon" style="color:' + iconColor + '"><i class="fas ' + icon + '"></i></div>' +
          '<div class="download-info">' +
          '<h4>' + sanitize(d.title) + '</h4>' +
          '<p style="font-size:0.72rem;color:#f59e0b;margin-top:2px">Expires in ' + d.daysLeft + ' day' + (d.daysLeft !== 1 ? 's' : '') + '</p>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-primary btn-sm" onclick="playOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')">' +
          '<i class="fas ' + (isPdf ? 'fa-eye' : 'fa-play') + '"></i> ' + (isPdf ? 'View' : 'Watch') + '</button>' +
          '<button class="btn btn-outline btn-sm" onclick="deleteOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')"><i class="fas fa-trash"></i></button>' +
          '</div>' +
          '</div>';
      });

      html += '</div>';
    });

    html += '</div>';
  });

  container.innerHTML = html;
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
  }
}

async function deleteOfflineContent(lessonId, type) {
  if (!window.electron || !window.electron.deleteDownload) return;
  const userId = getCurrentUserId();
  await window.electron.deleteDownload({ lessonId, type, userId });
  renderOfflineDownloads();
}
