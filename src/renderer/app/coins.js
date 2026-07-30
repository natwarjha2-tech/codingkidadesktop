/** CodingKida Desktop — Coins & Leaderboard System */

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
    var welcomeEl = document.getElementById('welcome-coins-count');
    if (welcomeEl) welcomeEl.textContent = String(_userCoinsCache);
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
      const welcomeEl = document.getElementById('welcome-coins-count');
      if (welcomeEl) welcomeEl.textContent = String(_userCoinsCache);
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
  
  // Check if we're opening from welcome card badge on dashboard
  const dashboardPage = document.getElementById('page-dashboard');
  const isDashboardActive = dashboardPage && dashboardPage.classList.contains('active');
  const welcomeBadge = document.getElementById('welcome-coins-count');
  
  if (isDashboardActive && welcomeBadge && welcomeBadge.offsetParent !== null) {
    // Welcome badge is visible on dashboard - position popup below it
    const rect = welcomeBadge.getBoundingClientRect();
    popup.style.top = (rect.bottom + 8) + 'px';
    popup.style.right = (window.innerWidth - rect.right) + 'px';
    popup.style.left = 'auto';
  } else {
    // Default position (topbar coins widget or other)
    popup.style.top = '60px';
    popup.style.right = '80px';
    popup.style.left = 'auto';
  }
  
  popup.style.display = 'block';
  _loadCoinsPopupData();
}

function hideCoinsPopup() {
  const popup = document.getElementById('coins-popup');
  if (popup) popup.style.display = 'none';
}

// Initialize welcome coins badge click handler (backup to inline onclick)
function _initWelcomeCoinsBadge() {
  const badge = document.getElementById('welcome-coins-badge');
  if (badge) {
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      console.log('Welcome coins badge clicked via event listener');
      openCoinsPopup();
    });
    console.log('Welcome coins badge click handler initialized');
  }
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

function _renderCoinsPopup(data) {
  const totalEl = document.getElementById('coins-popup-total');
  if (totalEl) totalEl.textContent = String(data.totalCoins || 0);

  const txEl = document.getElementById('coins-popup-transactions');
  if (txEl) {
    if (data.transactions && data.transactions.length > 0) {
      txEl.innerHTML = data.transactions.slice(0, 8).map(function(tx) {
        const isEarned = tx.type === 'EARNED';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:8px;">' +
          '<span style="font-size:0.78rem;color:rgba(255,255,255,0.7);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + sanitize(tx.reason) + '</span>' +
          '<span style="font-size:0.78rem;font-weight:700;color:' + (isEarned ? '#22c55e' : '#ef4444') + ';margin-left:8px;">' + (isEarned ? '+' : '-') + tx.coins + '</span>' +
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

// Leaderboard modal
function showLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  _loadLeaderboardModalData();
}

function hideLeaderboardModal() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.style.display = 'none';
}

async function _loadLeaderboardModalData() {
  const content = document.getElementById('leaderboard-modal-content');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);"><i class="fas fa-spinner fa-spin"></i> Loading leaderboard...</div>';

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  const lessonId = _currentLessonForTabs ? _currentLessonForTabs.lessonId : '';
  const courseId = _currentLessonContext ? _currentLessonContext.courseId : '';

  if (!lessonId && !courseId) {
    content.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);">Open a lesson to see leaderboard.</div>';
    return;
  }

  try {
    // Lesson-specific leaderboard — always include courseId for backward compatibility
    const courseIdParam = courseId ? 'courseId=' + courseId : '';
    const lessonIdParam = lessonId ? 'lessonId=' + lessonId : '';
    const params = [courseIdParam, lessonIdParam].filter(Boolean).join('&');
    let url = BASE_URL + '/api/leaderboard?' + params;
    const res = await fetch(url, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    const data = await res.json();
    if (data.success && data.leaderboard && data.leaderboard.length > 0) {
      let html = '';
      data.leaderboard.forEach(function(entry) {
        const rankIcon = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '#' + entry.rank;
        const badge = entry.rank === 1 ? 'Super Master' : entry.rank === 2 ? 'Master' : entry.rank <= 10 ? 'Pro' : '';
        const isMe = entry.isCurrentUser;
        html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;margin-bottom:6px;background:' + (isMe ? 'rgba(108,71,255,0.12)' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (isMe ? 'rgba(108,71,255,0.3)' : 'rgba(255,255,255,0.05)') + ';">' +
          '<div style="width:32px;text-align:center;font-size:' + (entry.rank <= 3 ? '1.2rem' : '0.85rem') + ';font-weight:700;color:' + (entry.rank <= 3 ? '#fbbf24' : 'var(--muted)') + ';">' + rankIcon + '</div>' +
          '<div style="flex:1;">' +
          '<div style="font-size:0.88rem;font-weight:' + (isMe ? '700' : '500') + ';color:#fff;">' + sanitize(entry.name) + (isMe ? ' (You)' : '') + '</div>' +
          (badge ? '<div style="font-size:0.7rem;color:#a78bfa;font-weight:600;">' + badge + '</div>' : '') +
          '</div>' +
          '<div style="font-size:0.85rem;font-weight:700;color:#4ade80;">' + entry.score + '%</div>' +
          '</div>';
      });

      if (data.currentUserRank && data.currentUserRank.rank > 20) {
        html += '<div style="text-align:center;padding:12px;margin-top:8px;background:rgba(108,71,255,0.08);border-radius:10px;border:1px solid rgba(108,71,255,0.2);">' +
          '<div style="font-size:0.85rem;color:#fff;font-weight:600;">Your Rank: #' + data.currentUserRank.rank + '</div>' +
          '<div style="font-size:0.75rem;color:var(--muted);">Score: ' + data.currentUserRank.score + '% · ' + data.totalStudents + ' students</div>' +
          '</div>';
      }
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
    if (!coinsPopup.contains(e.target) && !coinsWidget.contains(e.target)) {
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
