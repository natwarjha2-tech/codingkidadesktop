/** CodingKida Desktop — Coins & Leaderboard System */

// ─── Level Badge ─────────────────────────────────────────────────────────────

function updateLevelBadge(totalCoins) {
  var level = Math.floor(totalCoins / 50) + 1;
  var titles = ['Beginner', 'Starter', 'Junior Coder', 'Coder', 'Pro Coder', 'Expert', 'Master', 'Legend'];
  var title = titles[Math.min(level - 1, titles.length - 1)];
  var badge = document.getElementById('user-level-badge');
  if (badge) badge.textContent = 'Level ' + level + ' \u00b7 ' + title;
}

// ─── Coins & Leaderboard System ──────────────────────────────────────────────

var _quizStartTime = null;
var _userCoinsCache = 0;

// Load user coins from server and update widget
async function loadUserCoins() {
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;
  // Cache-first: show cached coins instantly
  var cached = ckCacheGet('/api/coins');
  if (cached && cached.success) {
    _userCoinsCache = cached.totalCoins || 0;
    var el = document.getElementById('coins-count');
    if (el) el.textContent = String(_userCoinsCache);
    var welcomeEl = document.getElementById('topbar-coins-count');
    if (welcomeEl) welcomeEl.textContent = String(_userCoinsCache);
    updateLevelBadge(_userCoinsCache);
  }
  // Background refresh
  try {
    const res = await fetch(BASE_URL + '/api/coins', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success) {
      ckCacheSet('/api/coins', data);
      _userCoinsCache = data.totalCoins || 0;
      const el = document.getElementById('coins-count');
      if (el) el.textContent = String(_userCoinsCache);
      const welcomeEl = document.getElementById('topbar-coins-count');
      if (welcomeEl) welcomeEl.textContent = String(_userCoinsCache);
      updateLevelBadge(_userCoinsCache);
    }
  } catch {}
}

// Toggle coins popup (from topbar coins widget)
function toggleCoinsPopup() {
  const popup = document.getElementById('coins-popup');
  if (!popup) return;
  if (popup.style.display === 'none' || !popup.style.display) {
    popup.style.top = '60px';
    popup.style.right = '80px';
    popup.style.left = 'auto';
    popup.style.display = 'block';
    _loadCoinsPopupData();
  } else {
    popup.style.display = 'none';
  }
}

// Always open coins popup (used from dropdown after it closes, or from welcome card)
function openCoinsPopup() {
  const popup = document.getElementById('coins-popup');
  if (!popup) return;
  
  // Position below topbar, right-aligned with content area
  popup.style.top = '45px';
  popup.style.right = '24px';
  popup.style.left = 'auto';
  popup.style.display = 'block';
  _loadCoinsPopupData();
}

function hideCoinsPopup() {
  const popup = document.getElementById('coins-popup');
  if (popup) popup.style.display = 'none';
}

// Initialize coins badge click handler — now handled by topbar inline onclick
function _initWelcomeCoinsBadge() {
  // No-op: topbar coins element uses inline onclick="openCoinsPopup()"
}

async function _loadCoinsPopupData() {
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;
  // Cache-first: show cached coins popup data instantly
  var cached = ckCacheGet('/api/coins');
  if (cached && cached.success) {
    _renderCoinsPopup(cached);
  }
  // Background refresh
  try {
    const res = await fetch(BASE_URL + '/api/coins', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success) {
      ckCacheSet('/api/coins', data);
      _renderCoinsPopup(data);
    }
  } catch {}
}

// Build the "Course · Module · Lesson" context line for a coin transaction,
// using the fields the backend now provides. Returns '' if none are present
// (e.g. referral/coupon/coding transactions that aren't lesson-based).
function _coinTxContext(tx) {
  var parts = [tx.courseTitle, tx.moduleTitle, tx.lessonTitle].filter(function (x) {
    return x && String(x).trim();
  });
  // Breadcrumb separator " › " — standardized across coins/achievements/notifications.
  return parts.length ? parts.map(function (x) { return sanitize(x); }).join(' \u203a ') : '';
}

function _renderCoinsPopup(data) {
  // Anti-flicker: skip repaint if the coins data is unchanged since last render.
  var _sig = {
    total: data.totalCoins || 0,
    tx: (data.transactions || []).slice(0, 8).map(function (t) {
      return [t.id, t.type, t.coins, t.reason, t.courseTitle, t.moduleTitle, t.lessonTitle].join('|');
    }),
  };
  if (typeof _ckShouldRender === 'function' && !_ckShouldRender('coins-popup', _sig)) return;

  const totalEl = document.getElementById('coins-popup-total');
  if (totalEl) totalEl.textContent = String(data.totalCoins || 0);

  const txEl = document.getElementById('coins-popup-transactions');
  if (txEl) {
    if (data.transactions && data.transactions.length > 0) {
      txEl.innerHTML = data.transactions.slice(0, 8).map(function(tx) {
        const isEarned = tx.type === 'EARNED';
        var ctx = _coinTxContext(tx);
        return '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:8px;">' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.78rem;color:rgba(255,255,255,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + sanitize(tx.reason) + '</div>' +
          (ctx ? '<div style="font-size:0.66rem;color:rgba(255,255,255,0.45);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + ctx + '</div>' : '') +
          '</div>' +
          '<span style="font-size:0.78rem;font-weight:700;color:' + (isEarned ? '#22c55e' : '#ef4444') + ';margin-left:8px;white-space:nowrap;">' + (isEarned ? '+' : '-') + tx.coins + '</span>' +
          '</div>';
      }).join('');
    } else {
      txEl.innerHTML = '<div style="color:var(--muted);font-size:0.8rem;text-align:center;padding:12px;">Complete quizzes to earn coins!</div>';
    }
  }
}

// Topbar profile dropdown
function toggleTopbarDropdown() {
  const dd = document.getElementById('topbar-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' || !dd.style.display ? 'block' : 'none';
}

function hideTopbarDropdown() {
  const dd = document.getElementById('topbar-dropdown');
  if (dd) dd.style.display = 'none';
}

// App topbar (dashboard) profile dropdown
function toggleAppTopbarDropdown() {
  const dd = document.getElementById('app-topbar-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'none' || !dd.style.display ? 'block' : 'none';
}

function hideAppTopbarDropdown() {
  const dd = document.getElementById('app-topbar-dropdown');
  if (dd) dd.style.display = 'none';
}

// Close app-topbar dropdown on outside click
document.addEventListener('click', function(e) {
  var dd = document.getElementById('app-topbar-dropdown');
  var btn = document.getElementById('app-topbar-profile-btn');
  if (dd && dd.style.display === 'block' && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});

// Leaderboard modal — COURSE-scoped (mirrors the mobile Leaderboard screen).
// A course pill selector lets the user pick any enrolled course and see its
// ranking, without needing a lesson open. Defaults to the current lesson's
// course if one is open, else the first enrolled course.
var _lbSelectedCourseId = '';
var _lbCourses = [];

function showLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  _lbInit();
}

function hideLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.style.display = 'none';
}

// Resolve the enrolled courses (from the dashboard cache, else fetch) and render
// the course pills, then load the leaderboard for the selected course.
async function _lbInit() {
  const content = document.getElementById('leaderboard-modal-content');
  const pillsEl = document.getElementById('leaderboard-course-pills');
  if (content) content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';

  // Gather enrolled courses: dashboard cache first (instant), else API.
  var courses = [];
  try {
    var uid = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : '';
    var cacheKey = 'ck_dashboard_cache_' + uid;
    var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached && cached.success && Array.isArray(cached.enrolledCourses)) courses = cached.enrolledCourses;
  } catch {}
  if (courses.length === 0) {
    try {
      var d = await StudentAPI.getDashboard();
      if (d && d.success && Array.isArray(d.enrolledCourses)) courses = d.enrolledCourses;
    } catch {}
  }
  _lbCourses = courses.map(function (c) { return { id: c.id, title: c.title }; });

  if (_lbCourses.length === 0) {
    if (pillsEl) pillsEl.innerHTML = '';
    if (content) content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">Enroll in a course to see the leaderboard.</div>';
    return;
  }

  // Default selection: current lesson's course if open, else first enrolled.
  var openCourseId = _currentLessonContext ? _currentLessonContext.courseId : '';
  if (!_lbSelectedCourseId || !_lbCourses.some(function (c) { return c.id === _lbSelectedCourseId; })) {
    _lbSelectedCourseId = (openCourseId && _lbCourses.some(function (c) { return c.id === openCourseId; }))
      ? openCourseId
      : _lbCourses[0].id;
  }

  _lbRenderPills();
  _loadLeaderboardForCourse(_lbSelectedCourseId);
}

function _lbRenderPills() {
  var pillsEl = document.getElementById('leaderboard-course-pills');
  if (!pillsEl) return;
  pillsEl.innerHTML = _lbCourses.map(function (c) {
    var active = c.id === _lbSelectedCourseId;
    return '<button onclick="_lbSelectCourse(\'' + c.id + '\')" style="flex:0 0 auto;white-space:nowrap;padding:7px 14px;border-radius:20px;font-size:0.78rem;font-weight:700;cursor:pointer;border:1px solid ' +
      (active ? 'rgba(108,71,255,0.5)' : 'rgba(255,255,255,0.1)') + ';background:' +
      (active ? 'rgba(108,71,255,0.18)' : 'rgba(255,255,255,0.04)') + ';color:' +
      (active ? '#c4b5fd' : 'rgba(255,255,255,0.7)') + ';">' + sanitize(c.title) + '</button>';
  }).join('');
}

function _lbSelectCourse(courseId) {
  _lbSelectedCourseId = courseId;
  _lbRenderPills();
  _loadLeaderboardForCourse(courseId);
}

async function _loadLeaderboardForCourse(courseId) {
  const content = document.getElementById('leaderboard-modal-content');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);"><i class="fas fa-spinner fa-spin"></i> Loading leaderboard...</div>';

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!courseId) {
    content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">Select a course.</div>';
    return;
  }

  try {
    // Course-scoped leaderboard (mirrors mobile — no lessonId).
    let url = BASE_URL + '/api/leaderboard?courseId=' + encodeURIComponent(courseId);
    const res = await fetch(url, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    const data = await res.json();
    if (data.success && data.leaderboard && data.leaderboard.length > 0) {
      let html = '';
      // "Your Rank" highlight card at the TOP (mirrors the mobile screen) —
      // shown whenever the backend returns the current user's rank.
      if (data.currentUserRank) {
        const myScore = (data.currentUserRank.scorePercent != null ? data.currentUserRank.scorePercent : (data.currentUserRank.score != null ? data.currentUserRank.score : 0));
        html += '<div style="background:rgba(108,71,255,0.12);border:1px solid rgba(108,71,255,0.3);border-radius:14px;padding:14px 16px;margin-bottom:12px;">' +
          '<div style="font-size:0.72rem;color:#a78bfa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Your Rank</div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span style="font-size:1.4rem;font-weight:800;color:#fff;">#' + data.currentUserRank.rank + '</span>' +
          '<span style="font-size:1rem;font-weight:800;color:#4ade80;">' + myScore + '%</span>' +
          '</div></div>';
      }
      data.leaderboard.forEach(function(entry) {
        const rankIcon = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '#' + entry.rank;
        const badge = entry.rank === 1 ? 'Super Master' : entry.rank === 2 ? 'Master' : entry.rank <= 10 ? 'Pro' : '';
        const isMe = entry.isCurrentUser;
        const sc = (entry.scorePercent != null ? entry.scorePercent : (entry.score != null ? entry.score : 0));
        html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;margin-bottom:6px;background:' + (isMe ? 'rgba(108,71,255,0.12)' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (isMe ? 'rgba(108,71,255,0.3)' : 'rgba(255,255,255,0.05)') + ';">' +
          '<div style="width:32px;text-align:center;font-size:' + (entry.rank <= 3 ? '1.2rem' : '0.85rem') + ';font-weight:700;color:' + (entry.rank <= 3 ? '#fbbf24' : 'var(--muted)') + ';">' + rankIcon + '</div>' +
          '<div style="flex:1;">' +
          '<div style="font-size:0.88rem;font-weight:' + (isMe ? '700' : '500') + ';color:#fff;">' + sanitize(entry.name) + (isMe ? ' (You)' : '') + '</div>' +
          (badge ? '<div style="font-size:0.7rem;color:#a78bfa;font-weight:600;">' + badge + '</div>' : '') +
          '</div>' +
          '<div style="font-size:0.85rem;font-weight:700;color:#4ade80;">' + sc + '%</div>' +
          '</div>';
      });

      content.innerHTML = html;
    } else {
      content.innerHTML = '<div style="text-align:center;padding:30px;"><i class="fas fa-trophy" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block;"></i><p style="color:var(--muted);font-size:0.9rem;">No quiz attempts yet. Be the first!</p></div>';
    }
  } catch {
    content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger);">Failed to load leaderboard.</div>';
  }
}

// Show coin reward toast after quiz submission
function _showCoinRewardToast(coins, badge, rank) {
  const badgeLabel = badge === 'super-master' ? '🏆 Super Master' : badge === 'master' ? '🥈 Master' : '⭐ Pro';
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:80px;right:20px;background:linear-gradient(135deg,#1a1a2e,#2e1065);border:1px solid rgba(245,158,11,0.4);border-radius:14px;padding:16px 20px;z-index:10001;box-shadow:0 12px 40px rgba(0,0,0,0.5);animation:slideUp 0.3s ease;display:flex;align-items:center;gap:12px;';
  toast.innerHTML = '<div style="font-size:1.5rem;">🪙</div><div><div style="font-size:0.9rem;font-weight:700;color:#fbbf24;">+' + coins + ' Coins Earned!</div><div style="font-size:0.78rem;color:rgba(255,255,255,0.7);margin-top:2px;">Rank #' + rank + ' · ' + badgeLabel + '</div></div>';
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 3000);
  setTimeout(function() { toast.remove(); }, 3500);
}

// Update topbar avatar text when user data loads
function _updateTopbarAvatar() {
  const cached = JSON.parse(localStorage.getItem('ck_user') || '{}');
  const name = cached.name || '';
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const el = document.getElementById('topbar-avatar-text');
  if (el) el.textContent = initial;
}

// Close dropdowns/popups when clicking outside
document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('topbar-dropdown');
  const profileBtn = document.getElementById('topbar-profile-btn');
  const coinsWidget = document.getElementById('coins-widget');
  const coinsPopup = document.getElementById('coins-popup');
  const leaderboardModal = document.getElementById('leaderboard-modal');

  // Close profile dropdown if clicking outside
  if (dropdown && dropdown.style.display === 'block') {
    if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  }
  // Close coins popup if clicking outside
  if (coinsPopup && coinsPopup.style.display === 'block') {
    var appTopbarCoins = document.getElementById('app-topbar-coins');
    var clickedInsideCoins = (coinsWidget && coinsWidget.contains(e.target)) || (appTopbarCoins && appTopbarCoins.contains(e.target));
    if (!coinsPopup.contains(e.target) && !clickedInsideCoins) {
      coinsPopup.style.display = 'none';
    }
  }
  // Close leaderboard modal if clicking backdrop
  if (leaderboardModal && leaderboardModal.style.display === 'flex') {
    if (e.target === leaderboardModal) {
      leaderboardModal.style.display = 'none';
    }
  }
});

// Track quiz start time when quiz tab is opened
var _origSwitchVpTab = switchVpTab;
switchVpTab = function(el, panelId) {
  if (panelId === 'vp-quiz') _quizStartTime = Date.now();
  _origSwitchVpTab(el, panelId);
};
