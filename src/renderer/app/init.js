/** CodingKida Desktop — App Initialization */

// ── Electron (Windows) focus-restore ────────────────────────────────────────
// Single shared helper (no duplication): when the app window regains focus or
// becomes visible again, Chromium can leave the currently-focused text field in
// a desynced state where the caret stops painting and keystrokes are dropped —
// the well-known Electron behaviour after a native confirm()/alert() or a
// focus-steal (OS screen-picker, PiP window). Opening DevTools "fixes" it only
// because toggling DevTools reactivates the window. This reproduces that reset
// programmatically: blur + re-focus the active text field on the next frame.
// It is a strict no-op unless a text input / textarea / contenteditable is the
// active element, so it never disturbs any other screen or control.
function _ckRestoreInputFocus() {
  try {
    var el = document.activeElement;
    if (!el) return;
    var tag = el.tagName;
    var isText =
      tag === 'TEXTAREA' ||
      (tag === 'INPUT' && !/^(button|checkbox|radio|submit|reset|file|range|color|image)$/i.test(el.type || 'text')) ||
      el.isContentEditable;
    if (!isText) return;
    // Defer to the next frame so Electron's own focus handling has settled first.
    requestAnimationFrame(function () {
      try {
        if (document.activeElement !== el) return; // focus moved on — leave it
        el.blur();
        el.focus();
      } catch (e) {}
    });
  } catch (e) {}
}

document.addEventListener('keydown', (e) => {
  // Universal back navigation - Alt + Left Arrow (browser standard)
  if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    goBack();
    return;
  }

  if (e.key === 'Enter') {
    if (document.activeElement.id === 'chatInput') sendChat();
    if (document.activeElement.id === 'aiInput') sendAI();
  }

  // Video keyboard shortcuts — only when video page is active
  const videoPage = document.getElementById('page-video');
  if (!videoPage || !videoPage.classList.contains('active')) return;
  if (['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;

  const videoEl = document.getElementById('video-player');
  if (e.code === 'Space') {
    e.preventDefault();
    if (videoEl && videoEl.style.display !== 'none') {
      videoEl.paused ? videoEl.play() : videoEl.pause();
    }
  }
  if (e.key === 'j' || e.key === 'J') {
    if (videoEl && videoEl.style.display !== 'none') videoEl.currentTime -= 10;
  }
  if (e.key === 'l' || e.key === 'L') {
    if (videoEl && videoEl.style.display !== 'none') videoEl.currentTime += 10;
  }
  if (e.key === 'ArrowRight') {
    if (videoEl && videoEl.style.display !== 'none') videoEl.currentTime += 5;
  }
  if (e.key === 'ArrowLeft') {
    if (videoEl && videoEl.style.display !== 'none') videoEl.currentTime -= 5;
  }
});

// Init
(async function init() {
  // Hide splash immediately — never block on any network call
  const splash = document.getElementById('splash');

  if (window.electron && window.electron.getPendingAuth) {
    try {
      const pending = await Promise.race([
        window.electron.getPendingAuth(),
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);
      if (pending && pending.token) {
        if (pending.remember) {
          localStorage.setItem('ck_token', pending.token);
          localStorage.setItem('ck_user', pending.user || '{}');
        } else {
          sessionStorage.setItem('ck_token', pending.token);
          sessionStorage.setItem('ck_user', pending.user || '{}');
        }
      }
    } catch {}
  }

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
  if (token) {
    const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    if (cached.name) {
      const initial = cached.name.charAt(0).toUpperCase();
      const sidebarName = document.getElementById('sidebar-user-name');
      const sidebarAvatar = document.getElementById('sidebar-avatar-text');
      const dashWelcome = document.getElementById('dashboard-welcome-name');
      if (sidebarName) sidebarName.textContent = cached.name;
      if (sidebarAvatar) sidebarAvatar.textContent = initial;
      if (dashWelcome) dashWelcome.textContent = cached.name;
    }
    navigate('dashboard');
    _attendanceRecordLogin();
  } else {
    navigate('login');
  }

  // Hide splash immediately after navigation
  if (splash) splash.style.display = 'none';

  // All backend calls in background — never block UI
  if (token) {
    _applyCachedDashboard(); // Show cached data instantly (no shimmer flash)
    loadStudentData();
    StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
  }
  loadCourses().then(courses => { renderCourseGrid(courses); renderDashboardRecommended(courses); }).catch(() => { renderCourseGrid(MOCK_COURSES); renderDashboardRecommended(MOCK_COURSES); });
  initCourseFilters();

  // Refresh dashboard on window focus (payment browser se wapas aane pe)
  window.addEventListener('focus', () => {
    // Electron (Windows) focus-restore: after a native confirm()/alert() or a
    // focus-steal (OS screen-picker, PiP window), Chromium leaves the renderer's
    // keyboard focus/caret desynced — a focused text field stops accepting input
    // until the window is deactivated+reactivated (the exact reason opening
    // DevTools "fixes" it). This re-syncs it automatically by nudging the active
    // field's focus once the window regains focus. App-wide (fixes the live-class
    // chat input + any other field), guarded, and a no-op when nothing text-like
    // is focused — so it can never affect other behaviour.
    _ckRestoreInputFocus();

    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) {
      StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
      // Sync notifications on focus (picks up any server-side notifications created while away)
      if (typeof notifSync === 'function') notifSync();
    }
  });

  // Also re-sync on visibility change: a minimize→restore (e.g. the PiP flow)
  // reports visibility without always firing a 'focus' event. Reuses the same
  // helper (no duplicated logic) and is a no-op unless a text field is active.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) _ckRestoreInputFocus();
  });

  // Listen for enrollment complete from deep link
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('enrollment-complete', () => {
      StudentAPI.getDashboard().then(d => _applyDashboardData(d, false)).catch(() => {});
      loadCourses().then(courses => { renderCourseGrid(courses); renderDashboardRecommended(courses); }).catch(() => {});
    });

    // Listen for app update notifications from main process
    window.electron.ipcRenderer.on('app-update-available', (data) => {
      if (data && data.version) notifAppUpdateAvailable(data.version);
    });
    window.electron.ipcRenderer.on('app-update-downloaded', (data) => {
      if (data && data.version) notifAppUpdateAvailable(data.version);
    });
  }

  // Initialize notification system
  if (token) notifInit();

  // Enrollment detected via deep link (codingkida://enroll) and window focus refresh
  // No polling needed
})();

// Call initialization when navigate to dashboard
document.addEventListener('DOMContentLoaded', _initWelcomeCoinsBadge);
setTimeout(_initWelcomeCoinsBadge, 1000); // Fallback after 1s

// Load coins on app init (after token check)
(function() {
  var _initInterval = setInterval(function() {
    var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (token) {
      clearInterval(_initInterval);
      loadUserCoins();
      _updateTopbarAvatar();
    }
  }, 1000);
  // Stop checking after 10s
  setTimeout(function() { clearInterval(_initInterval); }, 10000);
})();
