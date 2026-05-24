// Auth Helpers

function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

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

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  hideAuthError('login');

  if (!email || !password) {
    showAuthError('login', 'Please enter email and password.');
    return;
  }

  setButtonLoading('login-btn', true, 'Log In');
  try {
    const data = await AuthAPI.login(email, password);
    localStorage.setItem('ck_token', data.token);
    localStorage.setItem('ck_user', JSON.stringify(data.user || {}));
    await loadStudentData();
    navigate('dashboard');
  } catch (err) {
    showAuthError('login', err.message || 'Login failed. Try again.');
  } finally {
    setButtonLoading('login-btn', false, 'Log In');
  }
}

async function signup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  hideAuthError('signup');

  if (!name || !email || !password) {
    showAuthError('signup', 'All fields are required.');
    return;
  }
  if (password.length < 8) {
    showAuthError('signup', 'Password must be at least 8 characters.');
    return;
  }

  setButtonLoading('signup-btn', true, 'Create Free Account');
  try {
    const data = await AuthAPI.signup(name, email, password);
    localStorage.setItem('ck_token', data.token);
    localStorage.setItem('ck_user', JSON.stringify(data.user || {}));
    await loadStudentData();
    navigate('dashboard');
  } catch (err) {
    showAuthError('signup', err.message || 'Signup failed. Try again.');
  } finally {
    setButtonLoading('signup-btn', false, 'Create Free Account');
  }
}

async function loadStudentData() {
  try {
    const data = await StudentAPI.getProfile();
    const student = data.student || data.user || data;
    const name = sanitize(student.name || student.fullName || 'Learner');
    const email = sanitize(student.email || '');
    const initial = sanitize(name.charAt(0).toUpperCase());

    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarAvatar = document.getElementById('sidebar-avatar-text');
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;

    const dashWelcome = document.getElementById('dashboard-welcome-name');
    if (dashWelcome) dashWelcome.textContent = name;

    const dashGreeting = document.getElementById('dashboard-greeting');
    if (dashGreeting) {
      dashGreeting.textContent = 'Welcome';
    }

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileNameInput = document.getElementById('profile-name-input');
    const profileEmailInput = document.getElementById('profile-email-input');
    if (profileName) profileName.textContent = name;
    if (profileEmail) profileEmail.textContent = email;
    if (profileAvatar) {
      const avatarText = document.getElementById('profile-avatar-text');
      if (avatarText) avatarText.textContent = initial;
    }
    if (profileNameInput) profileNameInput.value = name;
    if (profileEmailInput) profileEmailInput.value = email;

    // Restore avatar photo from server API
    const userId = getCurrentUserId();
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    if (token) {
      try {
        const avatarRes = await fetch(BASE_URL + '/api/student/avatar', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (avatarRes.ok) {
          const avatarData = await avatarRes.json();
          if (avatarData.success && avatarData.avatarUrl) {
            const img = document.getElementById('profile-avatar-img');
            const text = document.getElementById('profile-avatar-text');
            if (img) { img.src = avatarData.avatarUrl; img.style.display = 'block'; }
            if (text) text.style.display = 'none';
            const sidebarImg = document.getElementById('sidebar-avatar-img');
            const sidebarText = document.getElementById('sidebar-avatar-text');
            if (sidebarImg) { sidebarImg.src = avatarData.avatarUrl; sidebarImg.style.display = 'block'; }
            if (sidebarText) sidebarText.style.display = 'none';
          }
        }
      } catch {}
    }
  } catch (err) {
    const cached = JSON.parse(localStorage.getItem('ck_user') || '{}');
    if (cached.name) {
      const name = cached.name;
      const initial = name.charAt(0).toUpperCase();
      const sidebarName = document.getElementById('sidebar-user-name');
      const sidebarAvatar = document.getElementById('sidebar-avatar-text');
      const dashWelcome = document.getElementById('dashboard-welcome-name');
      const profileName = document.getElementById('profile-name');
      const profileEmail = document.getElementById('profile-email');
      const profileAvatar = document.getElementById('profile-avatar');
      const profileNameInput = document.getElementById('profile-name-input');
      const profileEmailInput = document.getElementById('profile-email-input');
      if (sidebarName) sidebarName.textContent = name;
      if (sidebarAvatar) sidebarAvatar.textContent = initial;
      if (dashWelcome) dashWelcome.textContent = name;
      if (profileName) profileName.textContent = name;
      if (profileEmail) profileEmail.textContent = cached.email || '';
      if (profileAvatar) profileAvatar.textContent = initial;
      if (profileNameInput) profileNameInput.value = name;
      if (profileEmailInput) profileEmailInput.value = cached.email || '';
    }
  }

  // Load dashboard data in background — outside loadStudentData so splash is not blocked
}

// Apply cached dashboard data instantly (no shimmer flash)
function _applyCachedDashboard() {
  const userId = getCurrentUserId();
  const cacheKey = 'ck_dashboard_cache_' + userId;
  const cached = localStorage.getItem(cacheKey);
  if (!cached) return;
  try {
    const data = JSON.parse(cached);
    _applyDashboardData(data, true);
  } catch {}
}

async function _applyDashboardData(data, isFromCache) {
    if (!data.success) return;

    // Save to localStorage cache for instant load next time
    if (!isFromCache) {
      const userId = getCurrentUserId();
      const cacheKey = 'ck_dashboard_cache_' + userId;
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
    }

    // Dashboard stats
    const enrolledEl = document.getElementById('stat-enrolled');
    const completedEl = document.getElementById('stat-completed');
    const certEl = document.getElementById('stat-certificates');
    const streakEl = document.getElementById('stat-streak');
    if (enrolledEl) enrolledEl.innerHTML = String(data.enrolledCount || 0);
    // Videos completed = sum of completedLessons from enrolled courses only
    const enrolledCompletedCount = (data.enrolledCourses || []).reduce((sum, c) => sum + (c.completedLessons || 0), 0);
    if (completedEl) completedEl.innerHTML = String(enrolledCompletedCount);

    // Certificates = courses where progressPercent is 100
    const certCount = (data.enrolledCourses || []).filter(c => c.progressPercent === 100).length;
    if (certEl) certEl.innerHTML = String(certCount);

    // Weekly streak count — fetched separately (not in polling)
    // Streak is loaded once on dashboard navigate, not every 5s
    if (streakEl && !streakEl.dataset.loaded) {
      streakEl.innerHTML = '0';
    }

    // Continue Learning — use API data or localStorage fallback
    let lw = data.lastWatched || JSON.parse(localStorage.getItem('ck_last_lesson') || 'null');
    
    // Fallback: if no last watched, use first enrolled course
    if (!lw && data.enrolledCourses && data.enrolledCourses.length > 0) {
      const first = data.enrolledCourses[0];
      lw = {
        courseId: first.courseId?._id || first.courseId || first.id,
        courseTitle: first.title,
        courseIcon: first.icon,
        moduleTitle: 'Get started',
        lessonTitle: 'First Lesson',
        progressPercent: first.progressPercent || 0
      };
    }

    const continueSection = document.getElementById('continue-learning-section');
    if (lw) {
      if (continueSection) continueSection.style.display = 'block';
      const cTitle = document.getElementById('continue-title');
      const cSub = document.getElementById('continue-subtitle');
      const cFill = document.getElementById('continue-progress-fill');
      const cText = document.getElementById('continue-progress-text');
      const cIcon = document.getElementById('continue-icon');
      const cBtn = document.getElementById('continue-resume-btn');
      
      if (cTitle) cTitle.textContent = lw.courseTitle || 'Continue Learning';
      if (cSub) cSub.textContent = (lw.moduleTitle || '') + (lw.lessonTitle ? ' · ' + lw.lessonTitle : '');
      const progress = lw.progressPercent || 0;
      if (cFill) cFill.style.width = progress + '%';
      if (cText) cText.textContent = progress + '% Complete';
      if (cIcon) {
        if (lw.courseIcon) {
          cIcon.className = lw.courseIcon.startsWith('fa') ? lw.courseIcon : 'fas ' + lw.courseIcon;
        } else {
          cIcon.className = 'fas fa-play'; 
        }
      }
      if (cBtn) {
        if (lw.moduleId && lw.lessonId) {
          cBtn.onclick = () => openVideoFromBackend(lw.courseId, lw.moduleId, lw.lessonId);
        } else {
          cBtn.onclick = () => openCourseDetail(lw.courseId);
        }
      }
    } else {
      if (continueSection) continueSection.style.display = 'none';
    }

    // Profile enrolled courses — always update regardless of which page is active
    const profileCoursesContainer = document.querySelector('.profile-courses-list');
    if (profileCoursesContainer) {
      if (data.enrolledCourses && data.enrolledCourses.length > 0) {
        profileCoursesContainer.innerHTML = data.enrolledCourses.map(c =>
          '<div class="hover-glow" style="margin-bottom:16px; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05)">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:8px">' +
          '<span style="font-weight:700; color:#fff">' + sanitize(c.title) + '</span>' +
          '<span style="color:var(--primary); font-weight:800">' + (c.progressPercent || 0) + '%</span>' +
          '</div>' +
          '<div class="progress-bar" style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden">' +
          '<div class="progress-fill" style="width:' + (c.progressPercent || 0) + '%; height:100%; background:linear-gradient(to right, #6c47ff, #ec4899); border-radius:10px"></div>' +
          '</div>' +
          '</div>'
        ).join('');
      } else {
        profileCoursesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted); font-size:0.85rem">No courses enrolled yet.</div>';
      }
    }
}

function logout() {
  const userId = getCurrentUserId();
  if (userId) localStorage.removeItem('ck_dashboard_cache_' + userId);
  localStorage.removeItem('ck_token');
  localStorage.removeItem('ck_user');
  window.location.href = 'login.html';
}

function toggleSidebarMenu() {
  const menu = document.getElementById('sidebar-user-menu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function saveProfile() {
  const name = document.getElementById('profile-name-input')?.value.trim();
  if (!name) return;

  const msgEl = document.getElementById('profile-save-msg');
  if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = 'var(--muted)'; msgEl.textContent = 'Saving...'; }

  try {
    const data = await StudentAPI.updateProfile({ name });
    if (!data.success) throw new Error(data.message);

    // Update localStorage
    const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    cached.name = name;
    if (localStorage.getItem('ck_user')) localStorage.setItem('ck_user', JSON.stringify(cached));
    else sessionStorage.setItem('ck_user', JSON.stringify(cached));

    const initial = name.charAt(0).toUpperCase();
    const profileName = document.getElementById('profile-name');
    const profileAvatarText = document.getElementById('profile-avatar-text');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarAvatar = document.getElementById('sidebar-avatar-text');
    const dashWelcome = document.getElementById('dashboard-welcome-name');
    if (profileName) profileName.textContent = name;
    if (profileAvatarText) profileAvatarText.textContent = initial;
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (dashWelcome) dashWelcome.textContent = name;

    if (msgEl) { msgEl.style.color = 'var(--success)'; msgEl.textContent = '✅ Profile saved successfully!'; }
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--danger)'; msgEl.textContent = '❌ ' + (err.message || 'Failed to save.'); }
  }
}

// Change password
async function changePassword() {
  const currentPwd = document.getElementById('pwd-current')?.value.trim();
  const newPwd = document.getElementById('pwd-new')?.value.trim();
  const confirmPwd = document.getElementById('pwd-confirm')?.value.trim();
  const msgEl = document.getElementById('pwd-change-msg');

  if (msgEl) { msgEl.style.display = 'none'; }

  if (!currentPwd || !newPwd || !confirmPwd) {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = 'All password fields are required.'; }
    return;
  }
  if (newPwd.length < 8) {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = 'New password must be at least 8 characters.'; }
    return;
  }
  if (newPwd !== confirmPwd) {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = 'New passwords do not match.'; }
    return;
  }

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    const res = await fetch(BASE_URL + '/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    });
    const data = await res.json();
    if (data.success) {
      if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#10b981'; msgEl.style.background = 'rgba(16,185,129,0.1)'; msgEl.textContent = '✅ Password changed successfully!'; }
      document.getElementById('pwd-current').value = '';
      document.getElementById('pwd-new').value = '';
      document.getElementById('pwd-confirm').value = '';
    } else {
      if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = '❌ ' + (data.message || 'Failed to change password.'); }
    }
  } catch {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = '❌ Network error. Please try again.'; }
  }
}

function handleProfilePhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    // Show preview immediately
    const img = document.getElementById('profile-avatar-img');
    const text = document.getElementById('profile-avatar-text');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    if (text) text.style.display = 'none';
    const sidebarImg = document.getElementById('sidebar-avatar-img');
    const sidebarText = document.getElementById('sidebar-avatar-text');
    if (sidebarImg) { sidebarImg.src = e.target.result; sidebarImg.style.display = 'block'; }
    if (sidebarText) sidebarText.style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Upload to server for cross-device sync
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (token) {
    const formData = new FormData();
    formData.append('avatar', file);
    fetch(BASE_URL + '/api/student/avatar', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: formData,
    }).catch(() => {});
  }
}

function openEditProfile() {
  navigate('profile');
  document.getElementById('profile-name-input')?.focus();
}

// Navigation

const appPages = ['dashboard','courses','course-detail','video','chat','ai','live','downloads','offline-downloads','profile','enrolled-detail','completed-videos','streak-history'];
const authPages = ['login','signup'];
const sidebarMap = { dashboard:'nav-dashboard', courses:'nav-courses', 'course-detail':'nav-courses', video:'nav-courses', chat:'nav-chat', ai:'nav-ai', live:'nav-live', downloads:'nav-downloads', 'offline-downloads':'nav-offline-downloads', profile:'nav-profile', 'enrolled-detail':'nav-dashboard', 'completed-videos':'nav-dashboard', 'streak-history':'nav-dashboard' };

function navigate(page) {
  authPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });

  const app = document.getElementById('app');

  if (authPages.includes(page)) {
    app.style.display = 'none';
    const el = document.getElementById('page-' + page);
    if (el) el.style.display = 'flex';
    return;
  }

  app.style.display = 'flex';

  appPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  if (page === 'downloads') renderDownloads();
  if (page === 'offline-downloads') renderOfflineDownloads();

  // Refresh dashboard data when navigating to profile
  if (page === 'profile' || page === 'dashboard') {
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
    // Fetch weekly streak count once on dashboard load
    if (page === 'dashboard' && t) {
      loadWeeklyStreakCount();
    }
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = sidebarMap[page];
  if (navId) {
    const navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add('active');
  }
}

// Lazy load state for lesson tabs
var _currentLessonForTabs = null;
var _tabDataLoaded = { quiz: false, exercise: false, streak: false };

function switchVpTab(el, panelId) {
  el.closest('.vp-tabs').querySelectorAll('.vp-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('.vp-tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  // Lazy load: fetch data on first tab click
  if (_currentLessonForTabs) {
    const lessonId = _currentLessonForTabs.lessonId;
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    if (panelId === 'vp-quiz' && !_tabDataLoaded.quiz) {
      _tabDataLoaded.quiz = true;
      _lazyLoadQuiz(lessonId, token);
    } else if (panelId === 'vp-exercise' && !_tabDataLoaded.exercise) {
      _tabDataLoaded.exercise = true;
      _lazyLoadExercise(lessonId, token);
    }
  }
}

async function _lazyLoadQuiz(lessonId, token) {
  const el = document.getElementById('vp-quiz');
  if (el) el.innerHTML = '<div class="tab-card" style="text-align:center;padding:30px;"><div class="skeleton-shimmer" style="width:60%;height:16px;margin:0 auto 12px;"></div><div class="skeleton-shimmer" style="width:80%;height:12px;margin:0 auto 8px;"></div><div class="skeleton-shimmer" style="width:40%;height:12px;margin:0 auto;"></div></div>';
  try {
    const quizRes = await fetch(BASE_URL + '/api/quiz?lessonId=' + lessonId, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    const quizData = await quizRes.json();
    if (quizData.success && quizData.quizzes && quizData.quizzes.length > 0) {
      renderQuizTab(quizData.quizzes);
    } else {
      renderQuizTab(null);
    }
  } catch { renderQuizTab(null); }
}

async function _lazyLoadExercise(lessonId, token) {
  const el = document.getElementById('vp-exercise');
  if (el) el.innerHTML = '<div class="tab-card" style="text-align:center;padding:30px;"><div class="skeleton-shimmer" style="width:60%;height:16px;margin:0 auto 12px;"></div><div class="skeleton-shimmer" style="width:80%;height:12px;margin:0 auto 8px;"></div><div class="skeleton-shimmer" style="width:40%;height:12px;margin:0 auto;"></div></div>';
  try {
    const exRes = await fetch(BASE_URL + '/api/exercise?lessonId=' + lessonId, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    const exData = await exRes.json();
    if (exData.success && exData.exercises && exData.exercises.length > 0) {
      renderExerciseTab(exData.exercises);
    } else {
      renderExerciseTab(null);
    }
  } catch { renderExerciseTab(null); }
}



// ============================================================
// DATA-DRIVEN TAB RENDERERS
// These functions accept data objects. When backend is ready,
// just pass the API response data — no UI code changes needed.
// ============================================================

/**
 * Render Notes Tab
 * @param {string} pdfUrl - URL to PDF notes (optional)
 * @param {string[]} notePoints - Array of note bullet points (optional)
 */
function renderNotesTab(pdfUrl, notePoints) {
  const el = document.getElementById('vp-notes');
  if (!el) return;

  let html = '<div class="tab-card">';
  html += '<div class="tab-card-title"><i class="fas fa-file-alt"></i> Lesson Notes</div>';

  if (notePoints && notePoints.length > 0) {
    html += '<ul class="notes-list">';
    notePoints.forEach(note => {
      html += '<li><span class="note-bullet"></span><span>' + sanitize(note) + '</span></li>';
    });
    html += '</ul>';
  }

  if (pdfUrl) {
    html += '<div style="margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.06); display:flex; gap:10px;">';
    html += '<button class="btn btn-outline btn-sm" style="padding:10px 20px; border-radius:10px; display:flex; align-items:center; gap:8px;" onclick="openPdfInApp(\'' + pdfUrl + '\')">';
    html += '<i class="fas fa-file-pdf" style="color:#ef4444;"></i> View PDF Notes</button>';
    html += '<button id="pdf-download-btn" class="btn btn-outline btn-sm" style="padding:10px 20px; border-radius:10px; display:flex; align-items:center; gap:8px; border-color:rgba(34,197,94,0.4); color:#22c55e;" onclick="downloadPdfOffline(\'' + pdfUrl + '\')">';
    html += '<i class="fas fa-download"></i> Download PDF</button>';
    html += '</div>';
  }

  if (!pdfUrl && (!notePoints || notePoints.length === 0)) {
    html += '<div style="text-align:center; padding:30px 20px;">';
    html += '<i class="fas fa-book-open" style="font-size:2.5rem; color:rgba(255,255,255,0.15); margin-bottom:12px; display:block;"></i>';
    html += '<p style="color:var(--muted); font-size:0.9rem;">No notes available for this lesson yet.</p>';
    html += '</div>';
  }

  html += '</div>';
  el.innerHTML = html;

  // Check if PDF already downloaded — update button state
  if (pdfUrl && window.electron && window.electron.getDownloads && _currentVideoData) {
    const _uid = getCurrentUserId();
    if (_uid) {
      window.electron.getDownloads({ userId: _uid }).then(function(result) {
        if (result.success) {
          var downloaded = result.downloads.find(function(d) { return d.lessonId === _currentVideoData.lessonId && d.type === 'pdf'; });
          if (downloaded) {
            var pdfBtn = document.getElementById('pdf-download-btn');
            if (pdfBtn) {
              pdfBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded (' + downloaded.daysLeft + 'd left)';
              pdfBtn.style.borderColor = 'rgba(34,197,94,0.6)';
              pdfBtn.style.color = '#22c55e';
              pdfBtn.style.pointerEvents = 'none';
              pdfBtn.style.opacity = '0.8';
            }
          }
        }
      }).catch(function() {});
    }
  }
}

/**
 * Render Quiz Tab
 * @param {object|null} quizData - { question: string, options: string[], answer: number }
 * Can also accept array: [{ question, options, answer }, ...]
 */
function renderQuizTab(quizData) {
  const el = document.getElementById('vp-quiz');
  if (!el) return;

  let html = '<div class="tab-card">';
  html += '<div class="tab-card-title"><i class="fas fa-tasks"></i> Quiz</div>';

  if (!quizData) {
    html += '<div style="text-align:center; padding:30px 20px;">';
    html += '<i class="fas fa-question-circle" style="font-size:2.5rem; color:rgba(255,255,255,0.15); margin-bottom:12px; display:block;"></i>';
    html += '<p style="color:var(--muted); font-size:0.9rem;">Quiz coming soon for this lesson.</p>';
    html += '</div>';
    html += '</div>';
    el.innerHTML = html;
    return;
  }

  // Support single quiz object or array
  const quizzes = Array.isArray(quizData) ? quizData : [quizData];
  
  quizzes.forEach((quiz, qIndex) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    html += '<div class="quiz-question-card" data-answer="' + quiz.answer + '" data-qindex="' + qIndex + '" data-quizid="' + (quiz.id || '') + '">';
    html += '<div class="quiz-question-text">' + (quizzes.length > 1 ? 'Q' + (qIndex + 1) + '. ' : '') + sanitize(quiz.question) + '</div>';
    html += '<div class="quiz-options">';
    quiz.options.forEach((opt, i) => {
      html += '<div class="quiz-option" onclick="selectQuizOption(this, ' + qIndex + ')" data-index="' + i + '">';
      html += '<span class="quiz-option-letter">' + letters[i] + '</span>';
      html += '<span>' + sanitize(opt) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '<button class="quiz-submit-btn" onclick="submitQuiz(' + qIndex + ')">Check Answer</button>';
    html += '<div class="quiz-result" id="quiz-result-' + qIndex + '" style="display:none;"></div>';
    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

/**
 * Select a quiz option
 */
function selectQuizOption(optEl, qIndex) {
  const card = optEl.closest('.quiz-question-card');
  card.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
  optEl.classList.add('selected');
}

/**
 * Submit quiz answer and show result
 */
function submitQuiz(qIndex) {
  const card = document.querySelector('.quiz-question-card[data-qindex="' + qIndex + '"]');
  if (!card) return;
  const selected = card.querySelector('.quiz-option.selected');
  if (!selected) {
    const result = document.getElementById('quiz-result-' + qIndex);
    if (result) {
      result.style.display = 'block';
      result.className = 'quiz-result wrong';
      result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please select an option first.';
    }
    return;
  }

  const selectedIndex = parseInt(selected.dataset.index);
  const correctIndex = parseInt(card.dataset.answer);
  const result = document.getElementById('quiz-result-' + qIndex);
  const options = card.querySelectorAll('.quiz-option');

  // Disable further clicks
  options.forEach(o => { o.style.pointerEvents = 'none'; });

  if (selectedIndex === correctIndex) {
    selected.classList.add('correct');
    if (result) {
      result.style.display = 'block';
      result.className = 'quiz-result correct';
      result.innerHTML = '<i class="fas fa-check-circle"></i> Correct! Well done! 🎉';
    }
  } else {
    selected.classList.add('wrong');
    options[correctIndex].classList.add('correct');
    if (result) {
      result.style.display = 'block';
      result.className = 'quiz-result wrong';
      result.innerHTML = '<i class="fas fa-times-circle"></i> Incorrect. The correct answer is highlighted.';
    }
  }

  // Hide submit button
  const btn = card.querySelector('.quiz-submit-btn');
  if (btn) btn.style.display = 'none';

  // Save attempt to server for leaderboard
  const quizId = card.dataset.quizid || '';
  const courseId = _currentLessonContext ? _currentLessonContext.courseId : '';
  const _token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (quizId && courseId && _token) {
    fetch(BASE_URL + '/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
      body: JSON.stringify({ quizId, selected: selectedIndex, courseId }),
    }).then(() => fetchAndShowQuizRank()).catch(() => fetchAndShowQuizRank());
  } else {
    fetchAndShowQuizRank();
  }
}

/**
 * Fetch and display quiz rank in the quiz tab
 */
async function fetchAndShowQuizRank() {
  // Get courseId from current context
  const courseId = _currentLessonContext ? _currentLessonContext.courseId : null;
  if (!courseId) return;

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;

  // Check if rank section already exists
  let rankSection = document.getElementById('quiz-rank-section');
  if (!rankSection) {
    const quizEl = document.getElementById('vp-quiz');
    if (!quizEl) return;
    rankSection = document.createElement('div');
    rankSection.id = 'quiz-rank-section';
    rankSection.style.cssText = 'margin-top:20px; padding:16px; background:rgba(108,71,255,0.08); border:1px solid rgba(108,71,255,0.2); border-radius:12px;';
    quizEl.appendChild(rankSection);
  }

  rankSection.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading rank...</p>';

  try {
    const res = await fetch(BASE_URL + '/api/leaderboard?courseId=' + courseId, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success && data.currentUserRank) {
      const r = data.currentUserRank;
      rankSection.innerHTML =
        '<div style="text-align:center">' +
        '<div style="font-size:1.5rem;margin-bottom:4px">🏆</div>' +
        '<div style="font-size:0.9rem;font-weight:700;color:#fff">Your Quiz Rank</div>' +
        '<div style="font-size:1.8rem;font-weight:800;color:#a78bfa;margin:6px 0">#' + r.rank + '</div>' +
        '<div style="font-size:0.8rem;color:var(--muted)">out of ' + r.totalStudents + ' students · Score: ' + r.score + '%</div>' +
        '</div>';
    } else {
      rankSection.innerHTML =
        '<div style="text-align:center">' +
        '<div style="font-size:0.85rem;color:var(--muted)">Complete more quizzes to see your rank!</div>' +
        '</div>';
    }
  } catch {
    rankSection.innerHTML = '';
  }
}

/**
 * Submit exercise answer
 */
async function submitExerciseAnswer(exIndex) {
  const idx = exIndex !== undefined ? exIndex : 0;
  const codeInput = document.getElementById('exercise-code-input-' + idx);
  const result = document.getElementById('exercise-submit-result-' + idx);
  if (!codeInput || !result) return;

  const code = codeInput.value.trim();
  if (!code) {
    result.style.display = 'block';
    result.style.color = '#f59e0b';
    result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please write your solution before submitting.';
    return;
  }

  // Submit to server for validation
  const courseId = _currentLessonContext ? _currentLessonContext.courseId : '';
  const _token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  result.style.display = 'block';
  result.style.color = 'var(--muted)';
  result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';

  try {
    // Get exercise ID from rendered data
    const exerciseCards = document.querySelectorAll('.exercise-card');
    const exerciseId = exerciseCards[idx] ? exerciseCards[idx].dataset.exerciseid || '' : '';

    if (exerciseId && courseId && _token) {
      const res = await fetch(BASE_URL + '/api/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
        body: JSON.stringify({ exerciseId, code, courseId }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.passed) {
          result.style.color = '#22c55e';
          result.innerHTML = '<i class="fas fa-check-circle"></i> Correct! Well done! 🎉';
          codeInput.style.borderColor = 'rgba(34,197,94,0.4)';
        } else {
          result.style.color = '#f59e0b';
          result.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + (data.message || 'Not quite right. Keep trying!');
          codeInput.style.borderColor = 'rgba(245,158,11,0.4)';
        }
      } else {
        result.style.color = '#22c55e';
        result.innerHTML = '<i class="fas fa-check-circle"></i> Solution submitted!';
      }
    } else {
      // No server validation possible — mark as submitted
      result.style.color = '#22c55e';
      result.innerHTML = '<i class="fas fa-check-circle"></i> Solution submitted!';
    }
  } catch {
    result.style.color = '#22c55e';
    result.innerHTML = '<i class="fas fa-check-circle"></i> Solution submitted!';
  }

  // Show exercise rank
  fetchAndShowExerciseRank();
}

/**
 * Fetch and display exercise rank
 */
async function fetchAndShowExerciseRank() {
  const courseId = _currentLessonContext ? _currentLessonContext.courseId : null;
  if (!courseId) return;

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;

  let rankSection = document.getElementById('exercise-rank-section');
  if (!rankSection) {
    const exEl = document.getElementById('vp-exercise');
    if (!exEl) return;
    rankSection = document.createElement('div');
    rankSection.id = 'exercise-rank-section';
    rankSection.style.cssText = 'margin-top:20px; padding:16px; background:rgba(34,197,94,0.08); border:1px solid rgba(34,197,94,0.2); border-radius:12px;';
    exEl.appendChild(rankSection);
  }

  rankSection.innerHTML = '<p style="color:var(--muted);font-size:0.8rem;text-align:center"><i class="fas fa-spinner fa-spin"></i> Loading rank...</p>';

  try {
    const res = await fetch(BASE_URL + '/api/leaderboard?courseId=' + courseId, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success && data.currentUserRank) {
      const r = data.currentUserRank;
      rankSection.innerHTML =
        '<div style="text-align:center">' +
        '<div style="font-size:1.5rem;margin-bottom:4px">⚡</div>' +
        '<div style="font-size:0.9rem;font-weight:700;color:#fff">Your Exercise Rank</div>' +
        '<div style="font-size:1.8rem;font-weight:800;color:#22c55e;margin:6px 0">#' + r.rank + '</div>' +
        '<div style="font-size:0.8rem;color:var(--muted)">out of ' + r.totalStudents + ' students · Score: ' + r.score + '%</div>' +
        '</div>';
    } else {
      rankSection.innerHTML =
        '<div style="text-align:center">' +
        '<div style="font-size:0.85rem;color:var(--muted)">Complete more exercises to see your rank!</div>' +
        '</div>';
    }
  } catch {
    rankSection.innerHTML = '';
  }
}

/**
 * Render Weekly Streak Challenge as a separate section (shown via tab)
 */
function renderWeeklyStreakSection(streak) {
  // Create a dedicated streak tab panel if not exists
  let section = document.getElementById('vp-streak');
  if (!section) {
    const exerciseEl = document.getElementById('vp-exercise');
    if (!exerciseEl) return;
    section = document.createElement('div');
    section.id = 'vp-streak';
    section.className = 'vp-tab-panel';
    exerciseEl.parentNode.insertBefore(section, exerciseEl.nextSibling);
  }
  // Ensure it's hidden initially (tab switching will show it via .active class)
  section.classList.remove('active');

  // Show the streak tab button (add between Exercise and AI Mentor)
  const tabsContainer = document.querySelector('.vp-tabs');
  if (tabsContainer && !document.getElementById('streak-tab-btn')) {
    const aiTab = tabsContainer.querySelector('[onclick*="vp-ai"]') || tabsContainer.lastElementChild;
    const streakTab = document.createElement('div');
    streakTab.id = 'streak-tab-btn';
    streakTab.className = 'vp-tab';
    streakTab.innerHTML = '🔥 Streak';
    streakTab.onclick = function() { switchVpTab(this, 'vp-streak'); };
    if (aiTab) {
      tabsContainer.insertBefore(streakTab, aiTab);
    } else {
      tabsContainer.appendChild(streakTab);
    }
  }

  section.innerHTML =
    '<div class="tab-card" style="border:1px solid rgba(245,158,11,0.3); background:rgba(245,158,11,0.05);">' +
    '<div class="tab-card-title" style="color:#f59e0b"><i class="fas fa-fire"></i> Weekly Streak Challenge — Week ' + streak.weekNumber + '</div>' +
    '<h4 style="color:#fff;font-weight:700;margin-bottom:8px">' + sanitize(streak.title) + '</h4>' +
    (streak.description ? '<p style="color:var(--muted);font-size:0.85rem;margin-bottom:12px">' + sanitize(streak.description) + '</p>' : '') +
    '<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px;margin-bottom:14px">' +
    '<div style="font-size:0.75rem;font-weight:600;color:#f59e0b;margin-bottom:6px;text-transform:uppercase">Challenge Problem:</div>' +
    '<p style="color:#fff;font-size:0.9rem;line-height:1.6">' + sanitize(streak.problem) + '</p>' +
    '</div>' +
    '<textarea id="streak-answer-input" style="width:100%;height:120px;background:rgba(0,0,0,0.4);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:14px;color:#fbbf24;font-size:0.85rem;resize:vertical;font-family:monospace;outline:none" placeholder="Write your solution here..."></textarea>' +
    '<button class="quiz-submit-btn" style="margin-top:12px;background:linear-gradient(135deg,#f59e0b,#d97706)" onclick="submitWeeklyStreak(\'' + streak.id + '\')">Submit Challenge</button>' +
    '<div id="streak-submit-result" style="display:none;margin-top:10px;font-size:0.85rem"></div>' +
    '</div>';
}

/**
 * Submit weekly streak challenge
 */
async function submitWeeklyStreak(streakId) {
  const input = document.getElementById('streak-answer-input');
  const result = document.getElementById('streak-submit-result');
  if (!input || !result) return;

  const answer = input.value.trim();
  if (!answer) {
    result.style.display = 'block';
    result.style.color = '#f59e0b';
    result.innerHTML = '<i class="fas fa-exclamation-circle"></i> Please write your solution.';
    return;
  }

  result.style.display = 'block';
  result.style.color = 'var(--muted)';
  result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Evaluating...';

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    const res = await fetch(BASE_URL + '/api/weekly-streak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ streakId, answer }),
    });
    const data = await res.json();
    if (data.success) {
      if (data.passed) {
        result.style.color = '#22c55e';
        result.innerHTML = '<i class="fas fa-check-circle"></i> ✅ PASS — Streak Complete! ' + (data.feedback || '');
        input.style.borderColor = 'rgba(34,197,94,0.4)';
        // Update streak count on dashboard
        const streakEl = document.getElementById('stat-streak');
        if (streakEl) {
          const current = parseInt(streakEl.textContent) || 0;
          streakEl.textContent = current + 1;
        }
      } else {
        result.style.color = '#ef4444';
        result.innerHTML = '<i class="fas fa-times-circle"></i> ❌ FAIL — ' + (data.feedback || 'Incorrect answer. Review and try again!');
        input.style.borderColor = 'rgba(239,68,68,0.4)';
      }
    } else {
      result.style.color = '#ef4444';
      result.innerHTML = '<i class="fas fa-times-circle"></i> ' + (data.message || 'Submission failed.');
    }
  } catch {
    result.style.color = '#ef4444';
    result.innerHTML = '<i class="fas fa-times-circle"></i> Network error. Please try again.';
  }
}

/**
 * Render Exercise Tab
 * @param {object|null} exerciseData - { description: string, hint?: string, starterCode?: string }
 * Can also accept string (simple exercise text)
 */
function renderExerciseTab(exerciseData) {
  const el = document.getElementById('vp-exercise');
  if (!el) return;

  let html = '<div class="tab-card">';
  html += '<div class="tab-card-title"><i class="fas fa-code"></i> Practice Exercise</div>';

  if (!exerciseData) {
    html += '<div style="text-align:center; padding:30px 20px;">';
    html += '<i class="fas fa-laptop-code" style="font-size:2.5rem; color:rgba(255,255,255,0.15); margin-bottom:12px; display:block;"></i>';
    html += '<p style="color:var(--muted); font-size:0.9rem;">Exercise coming soon for this lesson.</p>';
    html += '</div>';
    html += '</div>';
    el.innerHTML = html;
    return;
  }

  // Support single object, string, or array
  let exercises = [];
  if (Array.isArray(exerciseData)) {
    exercises = exerciseData;
  } else if (typeof exerciseData === 'string') {
    exercises = [{ description: exerciseData }];
  } else {
    exercises = [exerciseData];
  }

  exercises.forEach((exercise, exIndex) => {
    html += '<div class="exercise-card" data-exerciseid="' + (exercise.id || '') + '" style="margin-bottom:20px; padding-bottom:20px;' + (exIndex < exercises.length - 1 ? ' border-bottom:1px solid rgba(255,255,255,0.06);' : '') + '">';
    if (exercises.length > 1) {
      html += '<div style="font-size:0.75rem; font-weight:700; color:#a78bfa; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Exercise ' + (exIndex + 1) + ' of ' + exercises.length + (exercise.difficulty ? ' · ' + exercise.difficulty : '') + '</div>';
    }
    html += '<div class="exercise-description">' + sanitize(exercise.description || exercise.title || '') + '</div>';

    if (exercise.hint || (exercise.hints && exercise.hints.length > 0)) {
      const hintText = exercise.hint || (Array.isArray(exercise.hints) ? exercise.hints.join(' | ') : '');
      if (hintText) {
        html += '<div class="exercise-hint">';
        html += '<i class="fas fa-lightbulb"></i>';
        html += '<span>' + sanitize(hintText) + '</span>';
        html += '</div>';
      }
    }

    html += '<div style="margin-top:16px;">';
    html += '<div style="font-size:0.8rem; font-weight:600; color:var(--muted); margin-bottom:8px;">Your Code:</div>';
    html += '<textarea id="exercise-code-input-' + exIndex + '" style="width:100%; height:130px; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:16px; color:#a78bfa; font-size:0.85rem; resize:vertical; font-family:monospace; outline:none;" placeholder="Write your solution here...">' + sanitize(exercise.starterCode || '') + '</textarea>';
    html += '<button class="quiz-submit-btn" style="margin-top:12px;" onclick="submitExerciseAnswer(' + exIndex + ')">Submit Solution</button>';
    html += '<div id="exercise-submit-result-' + exIndex + '" style="display:none; margin-top:10px; font-size:0.85rem;"></div>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

// AI Mentor chat history for lesson context
let _aiMentorHistory = [];

async function sendVpAI() {
  const input = document.getElementById('vp-ai-input');
  const messages = document.getElementById('vp-ai-messages');
  if (!input || !messages) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'display:flex;gap:10px;align-items:flex-start;flex-direction:row-reverse;';
  userMsg.innerHTML = `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#10b981,#34d399);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;flex-shrink:0;">You</div><div style="background:rgba(108,71,255,0.15);border:1px solid rgba(108,71,255,0.3);border-radius:10px 0 10px 10px;padding:10px 14px;font-size:0.82rem;color:#fff;line-height:1.6;">${sanitize(text)}</div>`;
  messages.appendChild(userMsg);
  const vpCenter = messages.closest('.vp-center');
  if (vpCenter) vpCenter.scrollTop = vpCenter.scrollHeight;

  const aiMsg = document.createElement('div');
  aiMsg.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
  aiMsg.innerHTML = `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#ec4899);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;flex-shrink:0;">AI</div><div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:0 10px 10px 10px;padding:10px 14px;font-size:0.82rem;color:var(--muted);line-height:1.6;">Thinking...</div>`;
  messages.appendChild(aiMsg);
  if (vpCenter) vpCenter.scrollTop = vpCenter.scrollHeight;

  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    const lessonId = _currentVideoData ? _currentVideoData.lessonId : '';

    const response = await fetch(BASE_URL + '/api/ai-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ question: text, lessonId: lessonId, mode: 'lesson' }),
    });

    const result = await response.json();

    if (result.success && result.answer) {
      let formatted = result.answer
        .replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
          const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<pre style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:0.8rem;color:#a78bfa;">' + escaped + '</pre>';
        })
        .replace(/`([^`]+)`/g, function(m, code) {
          const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<code style="background:rgba(108,71,255,0.15);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:#c4b5fd;">' + escaped + '</code>';
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff;">$1</strong>')
        .replace(/\n/g, '<br/>');
      aiMsg.querySelector('div:last-child').innerHTML = formatted;
      aiMsg.querySelector('div:last-child').style.color = '#e2e8f0';
    } else {
      aiMsg.querySelector('div:last-child').innerHTML = '<span style="color:#f59e0b">\u23f3 ' + (result.message || 'AI is busy. Please wait a few seconds and try again.') + '</span>';
    }
  } catch {
    aiMsg.querySelector('div:last-child').innerHTML = '<span style="color:#f59e0b">\u23f3 AI is busy. Please wait a few seconds and try again.</span>';
  }
  const vpCenterEnd = messages.closest('.vp-center');
  if (vpCenterEnd) vpCenterEnd.scrollTop = vpCenterEnd.scrollHeight;
}

function selectOption(el) {
  el.closest('.video-tab-content').querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function sendVideoChat() {
  const input = document.getElementById('video-chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.querySelector('#tab-chat .video-chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'chat-msg own';
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
  avatar.textContent = cached.name ? cached.name.charAt(0).toUpperCase() : 'Y';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const p = document.createElement('p');
  p.textContent = msg;
  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = 'Just now';
  bubble.appendChild(p);
  bubble.appendChild(time);
  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  input.value = '';
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg own';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const p = document.createElement('p');
  p.textContent = msg;
  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = 'Just now';
  bubble.appendChild(p);
  bubble.appendChild(time);
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = 'Y';
  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  input.value = '';
}

// Dashboard AI chat history
let _dashboardAIHistory = [];

async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('aiMessages');

  const userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.innerHTML = '<div class="ai-icon" style="background:var(--primary)">Y</div><div class="ai-bubble">' + sanitize(msg) + '</div>';
  container.appendChild(userDiv);
  input.value = '';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-msg';
  loadingDiv.id = 'ai-loading';
  loadingDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:var(--muted)">Thinking...</div>';
  container.appendChild(loadingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

    const response = await fetch(BASE_URL + '/api/ai-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ question: msg, mode: 'general' }),
    });

    const result = await response.json();
    document.getElementById('ai-loading')?.remove();

    if (result.success && result.answer) {
      let formatted = result.answer
        .replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
          const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<pre style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:0.8rem;color:#a78bfa;">' + escaped + '</pre>';
        })
        .replace(/`([^`]+)`/g, function(m, code) {
          const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<code style="background:rgba(108,71,255,0.15);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:#c4b5fd;">' + escaped + '</code>';
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff;">$1</strong>')
        .replace(/\n/g, '<br/>');

      const aiDiv = document.createElement('div');
      aiDiv.className = 'ai-msg';
      aiDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:#e2e8f0">' + formatted + '</div>';
      container.appendChild(aiDiv);
    } else {
      const errDiv = document.createElement('div');
      errDiv.className = 'ai-msg';
      errDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:#f59e0b">\u23f3 ' + (result.message || 'AI is busy. Please wait a few seconds and try again.') + '</div>';
      container.appendChild(errDiv);
    }
  } catch (err) {
    document.getElementById('ai-loading')?.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'ai-msg';
    errDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:#f59e0b">\u23f3 AI is busy. Please wait a few seconds and try again.</div>';
    container.appendChild(errDiv);
  }

  container.scrollTop = container.scrollHeight;
}

// Courses — Backend API with mockData fallback
// Backend: GET /api/courses → { success, courses: [...] }
// Backend: GET /api/courses/:id → { success, course: { ...modules: [...lessons] } }

let currentCourseId = null;

// Map backend course to render format
function mapCourse(c) {
  return {
    id: c.id,
    title: c.title || '',
    subtitle: c.subtitle || '',
    icon: c.icon ? (c.icon.startsWith('fa') ? c.icon : 'fas ' + c.icon) : 'fas fa-book',
    gradient: c.color || 'linear-gradient(135deg,#6c47ff,#3b1fa8)',
    rating: c.rating || 0,
    price: c.isFree ? 'Free' : 'Paid',
    free: c.isFree || false,
    category: c.category || 'Programming',
    instructor: c.instructor || '',
    instructorMeta: c.institute || '',
    students: c.students ? c.students.toString() : '0',
    hours: c.totalHours || 0,
    totalVideos: c.totalVideos || 0,
  };
}

async function loadCourses(category, search) {
  try {
    const data = await CoursesAPI.getAll(category, search);
    if (data.success && data.courses) {
      return data.courses.map(mapCourse);
    }
    return search ? [] : MOCK_COURSES;
  } catch (err) {
    return search ? [] : MOCK_COURSES;
  }
}

function renderCourseGrid(courses) {
  const grid = document.getElementById('courses-grid');
  if (!grid) return;
  if (!courses || courses.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; background:rgba(255,255,255,0.02); border-radius:24px; border:1px solid rgba(255,255,255,0.05)">' +
      '<i class="fas fa-search" style="font-size:3rem; color:var(--muted); margin-bottom:16px; display:block"></i>' +
      '<p style="color:var(--muted); font-size:1.1rem; font-weight:600">No courses found</p>' +
      '</div>';
    return;
  }
  // Fallback gradients for courses without color
  const fallbackGradients = [
    'linear-gradient(135deg,#6c47ff,#3b1fa8)',
    'linear-gradient(135deg,#ec4899,#be185d)',
    'linear-gradient(135deg,#f97316,#c2410c)',
    'linear-gradient(135deg,#10b981,#065f46)',
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#8b5cf6,#6d28d9)',
  ];
  grid.innerHTML = courses.map((c, i) => {
    const gradient = c.gradient && c.gradient.includes('gradient') ? c.gradient : fallbackGradients[i % fallbackGradients.length];
    return `
    <div class="course-card hover-glow" onclick="openCourseDetail('${c.id}')" style="background:#161B22; border:1px solid rgba(255,255,255,0.06); border-radius:20px; overflow:hidden; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,0.3); transition:transform 0.25s, box-shadow 0.25s;">
      <div style="height:150px; background:${gradient}; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.4));"></div>
        <i class="${c.icon}" style="font-size:4rem; color:rgba(255,255,255,0.95); z-index:1; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));"></i>
        <span style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);color:#fff;font-size:0.72rem;font-weight:700;padding:4px 10px;border-radius:50px;z-index:2;border:1px solid rgba(255,255,255,0.15);">${c.category}</span>
      </div>
      <div style="padding:16px;">
        <h3 style="font-size:1rem; font-weight:800; color:#fff; margin-bottom:6px; line-height:1.3;">${sanitize(c.title)}</h3>
        <p style="font-size:0.8rem; color:var(--muted); margin-bottom:14px; line-height:1.5; min-height:36px;">${sanitize(c.subtitle)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex;align-items:center;gap:5px;font-size:0.82rem;font-weight:700;color:#F59E0B;"><i class="fas fa-star"></i> ${c.rating || '4.5'}</span>
          <span style="font-size:0.82rem;font-weight:800;padding:3px 10px;border-radius:50px;background:${c.free ? 'rgba(34,197,94,0.15)' : 'rgba(108,71,255,0.15)'};color:${c.free ? '#22c55e' : '#a78bfa'};">${c.free ? 'Free' : 'Pro'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function openCourseDetail(courseId) {
  currentCourseId = courseId;

  // Try backend first, fallback to mockData
  let course = null;
  try {
    const data = await CoursesAPI.getById(courseId);
    if (data.success && data.course) {
      course = data.course;
      renderCourseDetailFromBackend(course);
      return;
    }
  } catch (err) {
    // fallback to mockData
  }

  // mockData fallback (id is number in mockData)
  course = MOCK_COURSES.find(c => c.id == courseId);
  if (!course) return;
  renderCourseDetailFromMock(course);
}

function renderCourseDetailFromBackend(course) {
  document.getElementById('cd-title').textContent = course.title || '';
  document.getElementById('cd-meta').textContent =
    (course.instructor || '') + (course.institute ? ' - ' + course.institute : '') +
    (course.students ? ' - ' + course.students + ' students' : '') +
    (course.rating ? ' - ' + course.rating + ' rating' : '');
  document.getElementById('cd-hours').textContent = (course.totalHours || 0) + ' hours';
  document.getElementById('cd-videos').textContent = (course.totalVideos || 0) + ' videos';
  document.getElementById('cd-instructor-avatar').textContent = course.instructor ? course.instructor.charAt(0) : 'I';
  document.getElementById('cd-instructor-name').textContent = course.instructor || '';
  document.getElementById('cd-instructor-meta').textContent = course.institute || '';
  document.getElementById('cd-instructor-rating').textContent = (course.rating || '') + (course.students ? ' - ' + course.students + ' students' : '');
  const priceBtn = document.getElementById('cd-price-btn');
  if (course.isFree) {
    priceBtn.textContent = 'Free Course';
    priceBtn.onclick = null;
  } else if (course.isEnrolled) {
    priceBtn.textContent = '✅ Enrolled';
    priceBtn.onclick = null;
    priceBtn.style.background = 'var(--success)';
  } else {
    priceBtn.textContent = 'Unlock Course';
    priceBtn.onclick = () => openPaymentPage(course.id);
  }

  const modulesContainer = document.getElementById('cd-modules');
  const modules = course.modules || [];

  // Store current course data for click handlers
  window._currentBackendCourse = course;

  modulesContainer.innerHTML = '';
  modules.forEach(mod => {
    const modDiv = document.createElement('div');
    modDiv.className = 'card';
    modDiv.style.marginBottom = '14px';

    const modTitle = document.createElement('div');
    modTitle.style.cssText = 'font-weight:700;margin-bottom:12px';
    modTitle.textContent = mod.title;
    modDiv.appendChild(modTitle);

    (mod.lessons || []).forEach(lesson => {
      const item = document.createElement('div');
      const canAccess = course.isEnrolled || lesson.isFree;
      item.className = 'playlist-item' + (canAccess ? '' : ' locked');
      if (canAccess) {
        item.onclick = () => openVideoFromBackend(course.id, mod.id, lesson.id);
      } else {
        item.onclick = () => openPaymentPage(course.id);
        item.style.cursor = 'pointer';
      }
      item.innerHTML =
        '<i class="fas ' + (canAccess ? 'fa-play-circle' : 'fa-lock') + '" style="color:' + (canAccess ? 'var(--success)' : '') + '"></i>' +
        '<span class="item-title">' + sanitize(lesson.title) + '</span>' +
        '<span class="item-duration">' + (lesson.duration || '') + '</span>' +
        '<span class="badge ' + (lesson.isFree ? 'badge-free' : (course.isEnrolled ? 'badge-free' : 'badge-paid')) + '">' + (lesson.isFree ? 'Free' : (course.isEnrolled ? 'Enrolled' : 'Pro')) + '</span>';
      modDiv.appendChild(item);
    });

    modulesContainer.appendChild(modDiv);
  });

  navigate('course-detail');
}

function renderCourseDetailFromMock(course) {
  document.getElementById('cd-title').textContent = course.title;
  document.getElementById('cd-meta').textContent = course.instructor + ' - ' + course.instructorMeta + ' - ' + course.students + ' students - ' + course.rating + ' rating';
  document.getElementById('cd-hours').textContent = course.hours + ' hours';
  document.getElementById('cd-videos').textContent = course.totalVideos + ' videos';
  document.getElementById('cd-instructor-avatar').textContent = course.instructor.charAt(0);
  document.getElementById('cd-instructor-name').textContent = course.instructor;
  document.getElementById('cd-instructor-meta').textContent = course.instructorMeta;
  document.getElementById('cd-instructor-rating').textContent = course.rating + ' - ' + course.students + ' students';
  const priceBtnMock = document.getElementById('cd-price-btn');
  priceBtnMock.textContent = course.free ? 'Free Course' : 'Unlock Course';
  priceBtnMock.onclick = course.free ? null : () => openPaymentPage();

  const modulesContainer = document.getElementById('cd-modules');
  modulesContainer.innerHTML = course.modules.map(mod => `
    <div class="card" style="margin-bottom:14px">
      <div style="font-weight:700;margin-bottom:12px">${sanitize(mod.title)}</div>
      ${mod.videos.map(v => `
        <div class="playlist-item ${v.free ? '' : 'locked'}" onclick="${v.free ? 'openVideo(' + course.id + ',' + mod.id + ',' + v.id + ')' : 'void(0)'}">
          <i class="fas ${v.free ? 'fa-play-circle' : 'fa-lock'}" style="color:${v.free ? 'var(--success)' : ''}"></i>
          <span class="item-title">${sanitize(v.title)}</span>
          <span class="item-duration">${v.duration}</span>
          <span class="badge ${v.free ? 'badge-free' : 'badge-paid'}">${v.free ? 'Free' : 'Pro'}</span>
        </div>`).join('')}
    </div>`).join('');

  navigate('course-detail');
}

// Track current lesson context for next lesson CTA
let _currentLessonContext = null;

function updateVideoProgressBar(completedCount, totalLessons) {
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  // top thin bar
  const fill = document.getElementById('video-progress-fill');
  if (fill) fill.style.width = pct + '%';
  // right panel progress
  const rightFill = document.getElementById('vp-right-progress-fill');
  if (rightFill) rightFill.style.width = pct + '%';
  const text = document.getElementById('video-progress-text');
  const count = document.getElementById('video-lesson-count');
  if (text) text.textContent = pct + '% Completed';
  if (count) count.textContent = completedCount + '/' + totalLessons + ' Lessons';
}

function goToNextLesson() {
  const ctx = _currentLessonContext;
  if (!ctx) return;
  const { courseId, moduleId, lessons, currentLessonId } = ctx;
  const idx = lessons.findIndex(l => l.id === currentLessonId);
  if (idx === -1 || idx >= lessons.length - 1) return;
  const next = lessons[idx + 1];
  if (next && next.isFree) {
    const floatBtn = document.getElementById('next-lesson-float');
    if (floatBtn) floatBtn.style.display = 'none';
    openVideoFromBackend(courseId, moduleId, next.id);
  }
}

async function openVideoFromBackend(courseId, moduleId, lessonId) {
  try {
    const data = await CoursesAPI.getByIdSigned(courseId);
    if (!data.success) return;
    const course = data.course;
    const mod = (course.modules || []).find(m => m.id === moduleId);
    if (!mod) return;
    const lesson = (mod.lessons || []).find(l => l.id === lessonId);
    if (!lesson) return;

    // Check if lesson is locked (empty videoUrl means not enrolled + not free)
    if (!lesson.videoUrl || lesson.videoUrl === '') {
      alert('This lesson is locked. Please enroll in the course to access it.');
      openPaymentPage(courseId);
      return;
    }

    document.getElementById('video-title').textContent = lesson.title || '';
    document.getElementById('video-meta').textContent = mod.title + ' - ' + (lesson.duration || '');
    await loadVideo(lesson.videoUrl || '');

    _currentVideoData = { lessonId: lesson.id, title: lesson.title, courseTitle: course.title || '', moduleTitle: mod.title, videoUrl: lesson.videoUrl, notesUrl: lesson.notes || '' };
    // Video completion: mark complete only when 90%+ watched (handled by video player event)
    _pendingLessonComplete = lesson.id;
    // Reset AI mentor chat for new lesson
    _aiMentorHistory = [];
    // Track last opened lesson for continue learning
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    if (token) {
      const lastLesson = { courseId: course.id, courseTitle: course.title, moduleId: mod.id, moduleTitle: mod.title, lessonId: lesson.id, lessonTitle: lesson.title, videoUrl: lesson.videoUrl };
      localStorage.setItem('ck_last_lesson', JSON.stringify(lastLesson));
    }
    // Sync save-to-watchlist button state for this lesson
    const userId2 = getCurrentUserId();
    const wlKey = userId2 ? 'ck_downloads_' + userId2 : 'ck_downloads';
    const wlSaved = JSON.parse(localStorage.getItem(wlKey) || '[]').find(d => d.lessonId === lesson.id);
    _updateSaveBtn(!!wlSaved);

    // Reset download button state for this lesson — check if already downloaded
    const dlBtn = document.getElementById('offline-download-btn');
    if (dlBtn) {
      if (window.electron && window.electron.getDownloads) {
        const userId = getCurrentUserId();
        window.electron.getDownloads({ userId }).then(result => {
          if (result.success) {
            const alreadyDownloaded = result.downloads.find(d => d.lessonId === lesson.id && d.type === 'video');
            if (alreadyDownloaded) {
              dlBtn.disabled = true;
              dlBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded (' + alreadyDownloaded.daysLeft + 'd left)';
              dlBtn.style.background = 'var(--success)';
            } else {
              dlBtn.disabled = false;
              dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Lesson';
              dlBtn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)';
            }
          } else {
            dlBtn.disabled = false;
            dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Lesson';
            dlBtn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)';
          }
        }).catch(() => {
          dlBtn.disabled = false;
          dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Lesson';
          dlBtn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)';
        });
      } else {
        dlBtn.disabled = false;
        dlBtn.innerHTML = '<i class="fas fa-download"></i> Download Lesson';
        dlBtn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)';
      }
    }

    // Update progress tracker — count completed lessons across ALL modules
    const allLessons = (course.modules || []).flatMap(m => m.lessons || []);
    const completedLessons = course.completedLessons || [];
    const completedCount = allLessons.filter(l => completedLessons.includes(l.id)).length;
    updateVideoProgressBar(completedCount, allLessons.length);

    // Store context for next lesson CTA
    _currentLessonContext = { courseId, moduleId, lessons: mod.lessons, currentLessonId: lessonId };
    const idx = mod.lessons.findIndex(l => l.id === lessonId);
    const nextLesson = mod.lessons[idx + 1];
    const floatBtn = document.getElementById('next-lesson-float');
    if (floatBtn) floatBtn.style.display = (nextLesson && nextLesson.isFree) ? 'flex' : 'none';

    const notesUrl = lesson.notes || '';
    renderNotesTab(notesUrl, []);

    // Lazy load: quiz and exercise are fetched only when user clicks the tab
    // Store lesson context for lazy fetch
    _currentLessonForTabs = { lessonId: lesson.id, courseId: courseId };
    _tabDataLoaded = { quiz: false, exercise: false, streak: false };

    // Show placeholder in tabs (will be replaced on tab click)
    renderQuizTab(null);
    renderExerciseTab(null);
    // Remove old streak tab if exists
    const oldStreakTab = document.getElementById('streak-tab-btn');
    if (oldStreakTab) oldStreakTab.remove();
    const oldStreakPanel = document.getElementById('vp-streak');
    if (oldStreakPanel) oldStreakPanel.remove();

    // Streak: fetch in background (non-blocking) to decide if tab should appear
    const _lessonToken = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    (async () => {
      try {
        const streakRes = await fetch(BASE_URL + '/api/weekly-streak?lessonId=' + lesson.id, {
          headers: _lessonToken ? { Authorization: 'Bearer ' + _lessonToken } : {},
        });
        const streakData = await streakRes.json();
        if (streakData.success && streakData.streak) {
          _tabDataLoaded.streak = true;
          renderWeeklyStreakSection(streakData.streak);
        }
      } catch {}
    })();

    // Render ALL modules and their lessons in playlist
    const playlist = document.getElementById('video-playlist');
    playlist.innerHTML = '';
    (course.modules || []).forEach(m => {
      // Module header
      const modHeader = document.createElement('div');
      modHeader.style.cssText = 'padding:10px 10px 6px;font-size:0.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.6px;border-top:1px solid var(--border);margin-top:4px;';
      modHeader.textContent = m.title;
      playlist.appendChild(modHeader);
      // Lessons
      (m.lessons || []).forEach(l => {
        const isActive = l.id === lessonId;
        const isCompleted = completedLessons.includes(l.id);
        const item = document.createElement('div');
        item.className = 'playlist-item' + (isActive ? ' active' : '') + (l.isFree ? '' : ' locked');
        if (l.isFree) item.onclick = () => openVideoFromBackend(courseId, m.id, l.id);
        item.innerHTML =
          '<i class="fas ' + (isCompleted ? 'fa-check-circle' : (l.isFree ? 'fa-play-circle' : 'fa-lock')) + '" style="color:' + (isCompleted ? 'var(--success)' : (l.isFree ? (isActive ? '#a78bfa' : 'var(--muted)') : 'var(--danger)')) + ';font-size:0.8rem;flex-shrink:0;"></i>' +
          '<span class="item-title">' + sanitize(l.title) + '</span>' +
          '<span class="item-duration">' + (l.duration || '') + '</span>';
        playlist.appendChild(item);
      });
    });

    const chatContainer = document.querySelector('#vp-ai-messages');
    if (chatContainer) chatContainer.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start;"><div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#ec4899);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;flex-shrink:0;">AI</div><div style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:0 10px 10px 10px;padding:10px 14px;font-size:0.85rem;color:var(--text);line-height:1.6;">Hi! Ask me anything about this lesson 🚀</div></div>`;

    // Reset to notes tab
    document.querySelectorAll('.vp-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    document.querySelectorAll('.vp-tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

    navigate('video');

    // Prefetch quiz + exercise in background after video is visible
    // so when user clicks the tab, data is already rendered
    const _prefetchToken = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    const _prefetchLessonId = lesson.id;
    setTimeout(() => {
      if (_currentLessonForTabs && _currentLessonForTabs.lessonId === _prefetchLessonId) {
        if (!_tabDataLoaded.quiz) {
          _tabDataLoaded.quiz = true;
          _lazyLoadQuiz(_prefetchLessonId, _prefetchToken);
        }
        if (!_tabDataLoaded.exercise) {
          _tabDataLoaded.exercise = true;
          _lazyLoadExercise(_prefetchLessonId, _prefetchToken);
        }
      }
    }, 1500);

  } catch {}
}

function updateDailyStreak() {
  const userId = getCurrentUserId();
  const key = 'ck_streak_' + userId;
  const today = new Date().toDateString();
  let streakData = JSON.parse(localStorage.getItem(key) || '{"count":0,"lastDate":""}');
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (streakData.lastDate === today) {
    return streakData.count;
  } else if (streakData.lastDate === yesterday) {
    streakData.count += 1;
  } else {
    streakData.count = 1;
  }
  streakData.lastDate = today;
  localStorage.setItem(key, JSON.stringify(streakData));
  return streakData.count;
}

// Track pending lesson completion (marked when 90%+ video watched)
let _pendingLessonComplete = null;
let _lessonMarkedComplete = false;

// Mark lesson as complete when video is opened
function markLessonComplete(lessonId) {
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token || !lessonId) return;
  apiRequest('/api/lessons/' + lessonId + '/progress', {
    method: 'POST',
    body: JSON.stringify({ completed: true }),
  }).catch(() => {});
}

// Open video from mockData
function openVideo(courseId, moduleId, videoId) {
  const course = MOCK_COURSES.find(c => c.id === courseId);
  if (!course) return;
  const mod = course.modules.find(m => m.id === moduleId);
  if (!mod) return;
  const video = mod.videos.find(v => v.id === videoId);
  if (!video) return;

  document.getElementById('video-iframe').src = 'https://www.youtube.com/embed/' + video.youtubeId + '?rel=0';
  document.getElementById('video-title').textContent = video.title;
  document.getElementById('video-meta').textContent = mod.title + ' - ' + video.duration;
  loadVideo('https://www.youtube.com/embed/' + video.youtubeId);

  _currentVideoData = { lessonId: String(video.id), title: video.title, courseTitle: course.title || '', moduleTitle: mod.title, videoUrl: 'https://www.youtube.com/embed/' + video.youtubeId };
  const _uid = getCurrentUserId();
  const _sk = _uid ? 'ck_downloads_' + _uid : 'ck_downloads';
  const _saved = JSON.parse(localStorage.getItem(_sk) || '[]').find(d => d.lessonId === String(video.id));
  _updateSaveBtn(!!_saved);

  // Use new data-driven renderers with mock data
  renderNotesTab('', video.notes || []);
  renderQuizTab(video.quiz || null);
  renderExerciseTab(video.exercise || null);

  const playlist = document.getElementById('video-playlist');
  if (playlist) {
    playlist.innerHTML = mod.videos.map(v => `
      <div class="playlist-item ${v.id === videoId ? 'active' : ''} ${v.free ? '' : 'locked'}" 
           style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: ${v.id === videoId ? 'rgba(108,71,255,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${v.id === videoId ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}; border-radius: 12px; cursor: pointer; transition: all 0.2s;"
           onmouseover="this.style.background='rgba(255,255,255,0.05)'"
           onmouseout="this.style.background='${v.id === videoId ? 'rgba(108,71,255,0.1)' : 'rgba(255,255,255,0.02)'}'"
           onclick="${v.free ? 'openVideo(' + courseId + ',' + moduleId + ',' + v.id + ')' : 'void(0)'}">
        <i class="fas ${v.free ? (v.id === videoId ? 'fa-play-circle' : 'fa-play-circle') : 'fa-lock'}" style="color: ${v.free ? 'var(--primary)' : 'var(--muted)'}"></i>
        <span class="item-title" style="font-size: 0.9rem; font-weight: ${v.id === videoId ? '700' : '500'}; color: #fff; flex: 1;">${sanitize(v.title)}</span>
        <span class="item-duration" style="font-size: 0.75rem; color: var(--muted);">${v.duration}</span>
      </div>`).join('');
  }

  const mockChatContainer = document.querySelector('#tab-chat .video-chat-messages');
  if (mockChatContainer) mockChatContainer.innerHTML = '';

  document.getElementById('tab-quiz').style.display = 'none';
  document.getElementById('tab-exercise').style.display = 'none';
  document.getElementById('tab-chat').style.display = 'none';
  document.getElementById('tab-notes').style.display = 'block';
  
  // Set summary preview
  const summary = document.getElementById('video-notes-summary');
  if (summary) summary.innerHTML = video.notes || 'No summary available for this lesson.';

  // Reset tabs UI
  const firstTab = document.querySelector('.panel-tab');
  if (firstTab) switchTab(firstTab, 'tab-notes');

  navigate('video');
}

let _searchTimeout = null;

// Old submitQuiz/submitExercise removed — replaced by data-driven versions above

async function loadVideo(url) {
  const iframe = document.getElementById('video-iframe');
  const videoEl = document.getElementById('video-player');
  if (!iframe || !videoEl) return;

  if (!url) {
    iframe.src = ''; iframe.style.display = 'block';
    videoEl.src = ''; videoEl.style.display = 'none';
    return;
  }

  if (url.includes('youtube') || url.includes('youtu.be')) {
    iframe.src = url.includes('?') ? url + '&rel=0' : url + '?rel=0';
    iframe.style.display = 'block';
    videoEl.style.display = 'none';
    videoEl.src = '';
  } else {
    iframe.style.display = 'none';
    iframe.src = '';
    videoEl.style.display = 'block';
    videoEl.src = url;

    // Track video progress — mark complete at 90%
    _lessonMarkedComplete = false;
    videoEl.ontimeupdate = function() {
      if (_lessonMarkedComplete || !_pendingLessonComplete) return;
      if (videoEl.duration && videoEl.currentTime / videoEl.duration >= 0.9) {
        _lessonMarkedComplete = true;
        markLessonComplete(_pendingLessonComplete);
      }
    };
  }
}

function openPaymentPage(courseId) {
  const url = 'https://www.codingkida.com/payment' + (courseId ? '?courseId=' + courseId : '');
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.invoke('open-external', url);
  } else {
    window.open(url, '_blank');
  }
}

async function enrollCourse(courseId) {
  if (!courseId) return;
  try {
    const data = await CoursesAPI.enroll(courseId);
    if (data.success) {
      // Refresh dashboard to reflect enrollment
      StudentAPI.getDashboard().then(d => _applyDashboardData(d, false)).catch(() => {});
      alert('Course enrolled successfully! Check your profile.');
    }
  } catch (err) {
    alert(err.message || 'Enrollment failed.');
  }
}

async function downloadPdf(url) {
  if (!url) return;
  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    const res = await fetch(BASE_URL + '/api/media/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.signedUrl) {
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.invoke('open-external', data.signedUrl);
        } else {
          window.open(data.signedUrl, '_blank');
        }
        return;
      }
    }
  } catch {}
  // fallback
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.invoke('open-external', url);
  } else {
    window.open(url, '_blank');
  }
}

async function handleCourseSearch(value) {
  clearTimeout(_searchTimeout);
  _searchTimeout = setTimeout(async () => {
    const activeTab = document.querySelector('.filter-tab.active');
    const category = activeTab ? activeTab.textContent.trim() : 'All';
    const courses = await loadCourses(category, value.trim());
    renderCourseGrid(courses);
  }, 300);
}

// Dashboard search — navigates to courses page with search
async function handleDashboardSearch(value) {
  if (!value.trim()) return;
  // Navigate to courses page and trigger search there
  navigate('courses');
  const searchInput = document.getElementById('course-search-input');
  if (searchInput) searchInput.value = value.trim();
  const courses = await loadCourses('All', value.trim());
  renderCourseGrid(courses);
}

// Weekly Streak History
async function showWeeklyStreakHistory() {
  navigate('streak-history');
  const container = document.getElementById('streak-history-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted)">Loading...</p>';

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    container.innerHTML = '<p style="color:var(--muted)">Please log in to view streak history.</p>';
    return;
  }

  try {
    // Get all enrolled courses first
    const dashData = await StudentAPI.getDashboard();
    if (!dashData.success || !dashData.enrolledCourses || dashData.enrolledCourses.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-fire" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No streak challenges available yet.</p></div>';
      return;
    }

    let allStreaks = [];
    for (const course of dashData.enrolledCourses) {
      try {
        const res = await fetch(BASE_URL + '/api/weekly-streak?courseId=' + course.id, {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        if (data.success && data.streaks) {
          data.streaks.forEach(s => {
            allStreaks.push({ ...s, courseTitle: course.title });
          });
        }
      } catch {}
    }

    if (allStreaks.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-fire" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No weekly challenges created yet. Complete lessons to unlock!</p></div>';
      return;
    }

    container.innerHTML = allStreaks.map(s =>
      '<div style="background:rgba(255,255,255,0.03);border:1px solid ' + (s.completed ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.2)') + ';border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px">' +
      '<div style="width:40px;height:40px;border-radius:10px;background:' + (s.completed ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + (s.completed ? 'fa-check' : 'fa-fire') + '" style="color:' + (s.completed ? '#22c55e' : '#f59e0b') + '"></i></div>' +
      '<div style="flex:1">' +
      '<p style="color:#fff;font-weight:600;font-size:0.9rem;margin:0">Week ' + s.weekNumber + ': ' + sanitize(s.title) + '</p>' +
      '<p style="color:var(--muted);font-size:0.75rem;margin:2px 0 0">' + sanitize(s.courseTitle) + '</p>' +
      '</div>' +
      '<span style="font-size:0.75rem;font-weight:700;padding:4px 10px;border-radius:20px;background:' + (s.completed ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)') + ';color:' + (s.completed ? '#22c55e' : '#f59e0b') + '">' + (s.completed ? '✅ PASS' : '⏳ Pending') + '</span>' +
      '</div>'
    ).join('');
  } catch {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load streak history.</p>';
  }
}

// Load weekly streak count — called once on dashboard navigate (not in polling)
async function loadWeeklyStreakCount() {
  const streakEl = document.getElementById('stat-streak');
  if (!streakEl) return;
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) { streakEl.textContent = '0'; return; }

  try {
    const dashData = await StudentAPI.getDashboard();
    if (!dashData.success || !dashData.enrolledCourses || dashData.enrolledCourses.length === 0) {
      streakEl.textContent = '0';
      return;
    }
    let totalCompleted = 0;
    for (const course of dashData.enrolledCourses) {
      try {
        const sRes = await fetch(BASE_URL + '/api/weekly-streak?courseId=' + course.id, { headers: { Authorization: 'Bearer ' + token } });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.success) totalCompleted += (sData.completedCount || 0);
        }
      } catch {}
    }
    streakEl.textContent = totalCompleted;
    streakEl.dataset.loaded = 'true';
  } catch {
    streakEl.textContent = '0';
  }
}

// ─── Downloads ───────────────────────────────────────────────────────────────

let _currentVideoData = null;

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

let _allCourseCategories = ['All', 'Programming', 'Web Dev', 'Data Science', 'DSA'];

async function initCourseFilters() {
  const container = document.getElementById('course-categories');
  if (!container) return;

  // Initial render of categories
  renderCourseCategories();

  // Try to fetch real categories from available courses
  try {
    const courses = await loadCourses('All');
    const cats = new Set(['All']);
    courses.forEach(c => { if (c.category) cats.add(c.category); });
    _allCourseCategories = Array.from(cats);
    renderCourseCategories();
  } catch (err) {}
}

function renderCourseCategories() {
  const container = document.getElementById('course-categories');
  if (!container) return;
  const currentActive = container.querySelector('.filter-tab.active')?.textContent.trim() || 'All';
  
  container.innerHTML = _allCourseCategories.map(cat => `
    <button class="filter-tab ${cat === currentActive ? 'active' : ''}" onclick="filterCourses('${cat}', this)">${cat}</button>
  `).join('');
}

async function filterCourses(category, btn) {
  const container = document.getElementById('course-categories');
  if (container) {
    container.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  }
  if (btn) btn.classList.add('active');

  const search = document.getElementById('course-search-input')?.value.trim() || '';
  const courses = await loadCourses(category, search);
  renderCourseGrid(courses);
}

// ─── Offline Downloads ───────────────────────────────────────────────────────────────

function getCurrentUserId() {
  const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
  return cached.id || cached.userId || '';
}

// ─── Enrolled Courses Detail & Completed Videos Pages ─────────────────────────

async function showEnrolledDetail() {
  navigate('enrolled-detail');
  const container = document.getElementById('enrolled-detail-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted)">Loading...</p>';

  try {
    const data = await StudentAPI.getDashboard();
    if (!data.success || !data.enrolledCourses || data.enrolledCourses.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-book-open" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No enrolled courses yet.</p></div>';
      return;
    }
    container.innerHTML = data.enrolledCourses.map(c =>
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;display:flex;align-items:center;gap:16px;transition:all 0.2s;cursor:pointer" onmouseover="this.style.borderColor=\'rgba(108,71,255,0.3)\';this.style.background=\'rgba(108,71,255,0.05)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,0.06)\';this.style.background=\'rgba(255,255,255,0.03)\'" onclick="openCourseDetail(\'' + c.id + '\')">' +
      '<div style="width:50px;height:50px;border-radius:14px;background:linear-gradient(135deg,rgba(108,71,255,0.3),rgba(236,72,153,0.2));display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">📚</div>' +
      '<div style="flex:1">' +
      '<h4 style="color:#fff;font-weight:700;font-size:0.95rem;margin:0 0 4px">' + sanitize(c.title) + '</h4>' +
      '<p style="color:var(--muted);font-size:0.8rem;margin:0">' + c.completedLessons + '/' + c.totalLessons + ' lessons completed</p>' +
      '</div>' +
      '<div style="text-align:right;min-width:60px">' +
      '<div style="font-size:1.1rem;font-weight:800;color:' + (c.progressPercent === 100 ? '#22c55e' : '#a78bfa') + '">' + c.progressPercent + '%</div>' +
      '<div style="width:60px;height:5px;background:rgba(255,255,255,0.1);border-radius:10px;margin-top:6px;overflow:hidden"><div style="width:' + c.progressPercent + '%;height:100%;background:linear-gradient(to right,#6c47ff,#ec4899);border-radius:10px"></div></div>' +
      '</div>' +
      '</div>'
    ).join('');
  } catch {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load courses.</p>';
  }
}

async function showCompletedVideos() {
  navigate('completed-videos');
  const container = document.getElementById('completed-videos-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted)">Loading...</p>';

  try {
    const data = await StudentAPI.getDashboard();
    if (!data.success) {
      container.innerHTML = '<p style="color:var(--danger)">Failed to load data.</p>';
      return;
    }

    const enrolledCourses = data.enrolledCourses || [];
    if (enrolledCourses.length === 0 || data.completedVideos === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No completed videos yet. Start learning!</p></div>';
      return;
    }

    // Fetch full course data for each enrolled course to get completed lesson details
    let allCompleted = [];
    for (const course of enrolledCourses) {
      if (course.completedLessons === 0) continue;
      try {
        const courseData = await CoursesAPI.getByIdSigned(course.id);
        if (courseData.success && courseData.course) {
          const completedLessonIds = courseData.course.completedLessons || [];
          (courseData.course.modules || []).forEach(mod => {
            (mod.lessons || []).forEach(lesson => {
              if (completedLessonIds.includes(lesson.id)) {
                allCompleted.push({ title: lesson.title, courseTitle: course.title, moduleTitle: mod.title, duration: lesson.duration });
              }
            });
          });
        }
      } catch {}
    }

    // Update the card count to match actual detail
    const completedEl = document.getElementById('stat-completed');
    if (completedEl) completedEl.textContent = allCompleted.length;

    if (allCompleted.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No completed videos found.</p></div>';
      return;
    }

    container.innerHTML = allCompleted.map(v =>
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">' +
      '<div style="width:36px;height:36px;border-radius:10px;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-check" style="color:#22c55e;font-size:0.8rem"></i></div>' +
      '<div style="flex:1">' +
      '<p style="color:#fff;font-weight:600;font-size:0.88rem;margin:0">' + sanitize(v.title) + '</p>' +
      '<p style="color:var(--muted);font-size:0.75rem;margin:2px 0 0">' + sanitize(v.courseTitle) + ' · ' + sanitize(v.moduleTitle) + '</p>' +
      '</div>' +
      '<span style="color:var(--muted);font-size:0.75rem;flex-shrink:0">' + (v.duration || '') + '</span>' +
      '</div>'
    ).join('');
  } catch {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load data.</p>';
  }
}

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

function closePdfViewer() {
  const viewer = document.getElementById('pdf-viewer-modal');
  if (viewer) viewer.style.display = 'none';
  _pdfDoc = null;
  _pdfCurrentPage = 1;
  const canvas = document.getElementById('pdf-canvas');
  if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
}

// ─── PDF.js Canvas Viewer (no download/print possible) ───────────────────────

let _pdfDoc = null;
let _pdfCurrentPage = 1;
let _pdfScale = 1.5;

function _renderPdfPage(pageNum) {
  if (!_pdfDoc) return;
  _pdfDoc.getPage(pageNum).then(function(page) {
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: _pdfScale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    page.render({ canvasContext: ctx, viewport: viewport });
    document.getElementById('pdf-page-info').textContent = pageNum + ' / ' + _pdfDoc.numPages;
    _pdfCurrentPage = pageNum;
  });
}

function pdfPrevPage() {
  if (_pdfCurrentPage <= 1) return;
  _renderPdfPage(_pdfCurrentPage - 1);
}

function pdfNextPage() {
  if (!_pdfDoc || _pdfCurrentPage >= _pdfDoc.numPages) return;
  _renderPdfPage(_pdfCurrentPage + 1);
}

function pdfZoomIn() {
  _pdfScale = Math.min(_pdfScale + 0.25, 3.0);
  _renderPdfPage(_pdfCurrentPage);
}

function pdfZoomOut() {
  _pdfScale = Math.max(_pdfScale - 0.25, 0.5);
  _renderPdfPage(_pdfCurrentPage);
}

function _openPdfInCanvas(url) {
  const viewer = document.getElementById('pdf-viewer-modal');
  if (!viewer) return;
  viewer.style.display = 'flex';
  _pdfScale = 1.5;
  _pdfCurrentPage = 1;
  document.getElementById('pdf-page-info').textContent = 'Loading...';

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    pdfjsLib.getDocument(url).promise.then(function(pdf) {
      _pdfDoc = pdf;
      _renderPdfPage(1);
    }).catch(function() {
      alert('Could not load PDF.');
      closePdfViewer();
    });
  } else {
    alert('PDF viewer not available.');
    closePdfViewer();
  }
}

async function openPdfInApp(url) {
  if (!url) return;
  // Use local HTTP server to serve PDF — avoids CSP issues and works offline
  if (window.electron && window.electron.playDownload) {
    const userId = getCurrentUserId();
    const lessonId = _currentVideoData ? _currentVideoData.lessonId : null;
    if (lessonId) {
      const result = await window.electron.playDownload({ lessonId, type: 'pdf', userId });
      if (result.success) {
        _openPdfInCanvas(result.serveUrl);
        return;
      }
    }
  }
  // Fallback: open signed URL in canvas viewer (online only)
  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    let pdfUrl = url;
    if (url.includes('amazonaws.com')) {
      const res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ url }),
      });
      if (res.ok) { const d = await res.json(); if (d.signedUrl) pdfUrl = d.signedUrl; }
    }
    _openPdfInCanvas(pdfUrl);
  } catch { alert('Could not open PDF.'); }
}

document.addEventListener('keydown', (e) => {
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

  // Polling fallback — har 5s mein enrollment check karo
  let _lastEnrolledCount = -1;
  setInterval(() => {
    if (!document.hasFocus()) return;
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (!t) return;
    StudentAPI.getDashboard().then(data => {
      if (!data.success) return;
      if (_lastEnrolledCount === -1) {
        _lastEnrolledCount = data.enrolledCount;
        return;
      }
      if (data.enrolledCount !== _lastEnrolledCount) {
        _lastEnrolledCount = data.enrolledCount;
        _applyDashboardData(data, false);
      }
    }).catch(() => {});
  }, 5000);
})();


