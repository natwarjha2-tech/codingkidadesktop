/**
 * CodingKida Desktop — Persistent Cache System
 * userId-specific, 7-day expiry, stale-while-revalidate pattern.
 */

// ═══════════════════════════════════════════════════════════════
// PERSISTENT CACHE SYSTEM (userId-specific, 7-day expiry)
// Stale-while-revalidate: show cached data instantly, refresh silently
// ═══════════════════════════════════════════════════════════════

var _CK_CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// TTL presets (in ms) for different data types
var _CK_CACHE_TTL = {
  'default': 7 * 24 * 60 * 60 * 1000,  // 7 days
  'dashboard': 5 * 60 * 1000,           // 5 minutes
  'courses_list': 30 * 60 * 1000,       // 30 minutes
  'course_detail': 30 * 60 * 1000,      // 30 minutes
  'quiz': 24 * 60 * 60 * 1000,          // 24 hours
  'exercise': 24 * 60 * 60 * 1000,      // 24 hours
  'homework': 24 * 60 * 60 * 1000,      // 24 hours
  'streak': 60 * 60 * 1000,             // 1 hour
  'leaderboard': 5 * 60 * 1000,         // 5 minutes
  'feedback': 10 * 60 * 1000,           // 10 minutes
  'profile': 10 * 60 * 1000,            // 10 minutes
  'coins': 5 * 60 * 1000,               // 5 minutes
};

/**
 * Get TTL for an endpoint based on its type
 */
function _ckCacheGetTTL(endpoint) {
  if (endpoint.includes('/api/quiz')) return _CK_CACHE_TTL.quiz;
  if (endpoint.includes('/api/exercise')) return _CK_CACHE_TTL.exercise;
  if (endpoint.includes('/api/homework')) return _CK_CACHE_TTL.homework;
  if (endpoint.includes('/api/weekly-streak')) return _CK_CACHE_TTL.streak;
  if (endpoint.includes('/api/leaderboard')) return _CK_CACHE_TTL.leaderboard;
  if (endpoint.includes('/api/feedback')) return _CK_CACHE_TTL.feedback;
  if (endpoint.includes('/api/courses/') && !endpoint.includes('?')) return _CK_CACHE_TTL.course_detail;
  if (endpoint === '/api/courses') return _CK_CACHE_TTL.courses_list;
  if (endpoint.includes('/api/student/dashboard')) return _CK_CACHE_TTL.dashboard;
  if (endpoint.includes('/api/coins')) return _CK_CACHE_TTL.coins;
  if (endpoint === '/api/student') return _CK_CACHE_TTL.profile;
  return _CK_CACHE_TTL.default;
}

/**
 * Get cached data for an endpoint (userId-specific)
 * Returns parsed data or null if expired/missing
 */
function ckCacheGet(endpoint) {
  var userId = getCurrentUserId();
  if (!userId) return null;
  var key = 'ck_pcache_' + userId + '_' + endpoint.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return null;
    var entry = JSON.parse(raw);
    // Check TTL per endpoint type
    var ttl = _ckCacheGetTTL(endpoint);
    if (Date.now() - entry.ts > ttl) {
      // Expired — but still return stale data (caller can decide to use it)
      // Mark as stale so caller knows to refresh
      entry.data._stale = true;
      return entry.data;
    }
    return entry.data;
  } catch(e) { return null; }
}

/**
 * Check if cache is fresh (within TTL) — used to decide if API call needed
 */
function ckCacheIsFresh(endpoint) {
  var userId = getCurrentUserId();
  if (!userId) return false;
  var key = 'ck_pcache_' + userId + '_' + endpoint.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return false;
    var entry = JSON.parse(raw);
    var ttl = _ckCacheGetTTL(endpoint);
    return (Date.now() - entry.ts) < ttl;
  } catch(e) { return false; }
}

/**
 * Store data in persistent cache (userId-specific)
 */
function ckCacheSet(endpoint, data) {
  var userId = getCurrentUserId();
  if (!userId || !data) return;
  var key = 'ck_pcache_' + userId + '_' + endpoint.replace(/[^a-zA-Z0-9]/g, '_');
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
  } catch(e) {
    // localStorage full — remove oldest cache entries
    _ckCacheCleanup(userId);
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data })); } catch(e2) {}
  }
}

/**
 * Remove a single cached endpoint for the current user (force refresh next time)
 */
function ckCacheRemove(endpoint) {
  var userId = getCurrentUserId();
  if (!userId) return;
  var key = 'ck_pcache_' + userId + '_' + endpoint.replace(/[^a-zA-Z0-9]/g, '_');
  try { localStorage.removeItem(key); } catch (e) {}
}

/**
 * Remove all cache for a specific user
 */
function ckCacheClearUser(userId) {
  if (!userId) return;
  var prefix = 'ck_pcache_' + userId + '_';
  var keysToRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keysToRemove.push(k);
  }
  keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
}

/**
 * Cleanup oldest cache entries when storage is full
 */
function _ckCacheCleanup(userId) {
  var prefix = 'ck_pcache_' + userId + '_';
  var entries = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      try {
        var raw = localStorage.getItem(k);
        var entry = JSON.parse(raw);
        entries.push({ key: k, ts: entry.ts || 0 });
      } catch(e) { entries.push({ key: k, ts: 0 }); }
    }
  }
  // Sort oldest first, remove oldest half
  entries.sort(function(a, b) { return a.ts - b.ts; });
  var removeCount = Math.max(1, Math.floor(entries.length / 2));
  for (var j = 0; j < removeCount; j++) {
    localStorage.removeItem(entries[j].key);
  }
}

/**
 * Detect if a different user just logged in — clear old user's cache
 * Called after login/signup success
 */
function _ckCacheDetectUserChange(newUserId) {
  var lastUserId = localStorage.getItem('ck_pcache_last_user');
  if (lastUserId && lastUserId !== newUserId) {
    // Different user — clear old user's cache
    ckCacheClearUser(lastUserId);
  }
  localStorage.setItem('ck_pcache_last_user', newUserId);
}

/**
 * Pre-fetch all major endpoints and store in cache (called after login)
 * Runs silently in background — user sees cached data immediately
 */
function _ckCachePreFetchAll() {
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;

  // Pre-fetch dashboard — also refresh the visible dashboard when it arrives.
  StudentAPI.getDashboard().then(function(data) {
    if (data && data.success) {
      ckCacheSet('/api/student/dashboard', data);
      if (typeof _applyDashboardData === 'function') { try { _applyDashboardData(data, false); } catch (e) {} }
    }
  }).catch(function() {});

  // Pre-fetch profile
  StudentAPI.getProfile().then(function(data) {
    if (data) {
      ckCacheSet('/api/student', data);
      if (typeof _applyProfileData === 'function') { try { _applyProfileData(data); } catch (e) {} }
    }
  }).catch(function() {});

  // Pre-fetch courses list — re-render courses grid if the user is on it.
  CoursesAPI.getAll().then(function(data) {
    if (data && data.success) {
      ckCacheSet('/api/courses', data);
      _ckRefreshPageIfActive('courses');
      _ckRefreshPageIfActive('dashboard'); // dashboard shows course cards too
    }
  }).catch(function() {});

  // Pre-fetch coding problems
  fetch(BASE_URL + '/api/coding-problems', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.success) {
        ckCacheSet('/api/coding-problems', data);
        try { localStorage.setItem('ck_coding_problems_cache', JSON.stringify(data)); } catch(e) {}
        _ckRefreshPageIfActive('coding');
      }
    }).catch(function() {});

  // Pre-fetch coins — always refresh the coins widget/popup + reports.
  fetch(BASE_URL + '/api/coins', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data) {
        ckCacheSet('/api/coins', data);
        if (typeof loadUserCoins === 'function') { try { loadUserCoins(); } catch (e) {} }
        if (typeof _renderCoinsPopup === 'function') { try { _renderCoinsPopup(data); } catch (e) {} }
      }
    }).catch(function() {});

  // Pre-fetch achievements
  fetch(BASE_URL + '/api/achievements', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data) {
        ckCacheSet('/api/achievements', data);
        _ckRefreshPageIfActive('achievements');
      }
    }).catch(function() {});

  // Pre-fetch orders
  fetch(BASE_URL + '/api/student/orders', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.success) {
        ckCacheSet('/api/student/orders', data);
        _ckRefreshPageIfActive('orders');
      }
    }).catch(function() {});

  // Pre-fetch mall
  fetch(BASE_URL + '/api/mall', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.success) {
        ckCacheSet('/api/mall', data);
        _ckRefreshPageIfActive('mall');
      }
    }).catch(function() {});

  // Pre-fetch student progress
  fetch(BASE_URL + '/api/student/progress', { headers: { Authorization: 'Bearer ' + token } })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.success) {
        ckCacheSet('/api/student/progress', data);
        _ckRefreshPageIfActive('student-progress');
      }
    }).catch(function() {});

  // Pre-fetch app ratings
  fetch(BASE_URL + '/api/feedback/lesson?lessonId=app_rating')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.success) {
        ckCacheSet('/api/feedback/app_rating', data);
        _ckRefreshPageIfActive('rate-us');
      }
    }).catch(function() {});

  // Pre-fetch weekly streak data (runs after small delay to let dashboard cache first)
  setTimeout(function() {
    _fetchAllStreakData(token).then(function(allStreaks) {
      if (allStreaks) {
        ckCacheSet('/api/weekly-streak-all', allStreaks);
        if (typeof loadWeeklyStreakCount === 'function') { try { loadWeeklyStreakCount(); } catch (e) {} }
        _ckRefreshPageIfActive('streak-history');
      }
    }).catch(function() {});
  }, 2000);
}

/**
 * If the given page is currently active, re-run its loader so freshly-fetched
 * data (already stored in cache) is painted immediately — no manual refresh.
 * Safe/no-op if the page isn't active or the loader doesn't exist.
 */
function _ckRefreshPageIfActive(page) {
  try {
    var el = document.getElementById('page-' + page);
    var isActive = el && el.classList.contains('active');
    // The dashboard is the special landing page — always allow its refresh.
    if (!isActive && page !== 'dashboard') return;
    var loaders = {
      'dashboard': function () {
        // Re-paint dashboard cards/stats from the freshly-cached data.
        var d = ckCacheGet('/api/student/dashboard');
        if (d && d.success && typeof _applyDashboardData === 'function') _applyDashboardData(d, false);
      },
      'courses': function () { if (typeof loadCourses === 'function') loadCourses(); },
      'coding': function () { if (typeof codingPgInit === 'function') codingPgInit(); },
      'orders': function () { if (typeof loadOrdersPage === 'function') loadOrdersPage(); },
      'mall': function () { if (typeof loadMallPage === 'function') loadMallPage(); },
      'student-progress': function () { if (typeof loadStudentProgress === 'function') loadStudentProgress(); },
      'rate-us': function () { if (typeof loadRateUsPage === 'function') loadRateUsPage(); },
    };
    if (loaders[page]) loaders[page]();
  } catch (e) { /* never break prefetch on a render error */ }
}


/**
 * Refresh all data — clears cache and re-fetches everything fresh.
 * Called when user clicks the Refresh button in sidebar.
 */
function refreshAllData() {
  var userId = getCurrentUserId();
  if (!userId) return;

  // Spin the refresh icon
  var icon = document.getElementById('refresh-icon');
  if (icon) { icon.style.animation = 'spin 0.8s linear infinite'; }

  // Clear all cache for this user
  ckCacheClearUser(userId);

  // Also clear legacy dashboard cache
  localStorage.removeItem('ck_dashboard_cache_' + userId);

  // Re-fetch all data
  _ckCachePreFetchAll();

  // Reload current page content
  var currentPage = document.querySelector('.page.active');
  var pageId = currentPage ? currentPage.id.replace('page-', '') : 'dashboard';

  // Re-trigger page-specific data loads
  if (pageId === 'dashboard' || pageId === 'profile') {
    StudentAPI.getDashboard().then(function(data) { _applyDashboardData(data, false); }).catch(function() {});
  }
  if (pageId === 'dashboard') {
    loadCourses().then(function(courses) { renderDashboardRecommended(courses); }).catch(function() {});
  }
  if (pageId === 'courses') {
    loadCourses().then(function(courses) { renderCourseGrid(courses); }).catch(function() {});
  }
  if (pageId === 'profile') {
    loadOrdersPage(); loadMallPage(); loadRateUsPage();
    loadParentReport(); loadReferralPage(); loadHelpPage();
    loadStudentProgress();
  }
  if (pageId === 'achievements') { showAchievements(); }
  if (pageId === 'orders') { loadOrdersPage(); }
  if (pageId === 'mall') { loadMallPage(); }
  if (pageId === 'rate-us') { loadRateUsPage(); }
  if (pageId === 'student-progress') { loadStudentProgress(); }
  if (pageId === 'parent-report') { loadParentReport(); }

  // Stop spin after 2 seconds
  setTimeout(function() {
    if (icon) { icon.style.animation = ''; }
  }, 2000);
}
