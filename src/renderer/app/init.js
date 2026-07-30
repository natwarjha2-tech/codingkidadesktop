/** CodingKida Desktop — App Initialization */

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
  loadCourses().then(courses => renderCourseGrid(courses)).catch(() => renderCourseGrid(MOCK_COURSES));
  initCourseFilters();

  // Refresh dashboard on window focus (payment browser se wapas aane pe)
  window.addEventListener('focus', () => {
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
  });

  // Listen for enrollment complete from deep link
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('enrollment-complete', () => {
      StudentAPI.getDashboard().then(d => _applyDashboardData(d, false)).catch(() => {});
      loadCourses().then(courses => renderCourseGrid(courses)).catch(() => {});
    });
  }

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
