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
    _attendanceRecordLogin();
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
    _attendanceRecordLogin();
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

    const topbarAvatarText = document.getElementById('topbar-avatar-text');
    if (topbarAvatarText) topbarAvatarText.textContent = initial;

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
    
    // New profile fields
    const studentNameInput = document.getElementById('student-name-input');
    const studentDobInput = document.getElementById('student-dob-input');
    const studentGradeInput = document.getElementById('student-grade-input');
    const studentGenderInput = document.getElementById('student-gender-input');
    const studentSchoolInput = document.getElementById('student-school-input');
    const parentNameInput = document.getElementById('parent-name-input');
    const parentEmailInput = document.getElementById('parent-email-input');
    const parentContactInput = document.getElementById('parent-contact-input');
    
    if (profileName) profileName.textContent = name;
    if (profileEmail) profileEmail.textContent = email;
    if (profileAvatar) {
      const avatarText = document.getElementById('profile-avatar-text');
      if (avatarText) avatarText.textContent = initial;
    }
    if (profileNameInput) profileNameInput.value = name;
    if (profileEmailInput) profileEmailInput.value = email;
    
    // Populate new profile fields from student data
    if (studentNameInput) studentNameInput.value = student.studentName || '';
    if (studentDobInput) studentDobInput.value = student.studentDob || '';
    if (studentGradeInput) studentGradeInput.value = student.studentGrade || '';
    if (studentGenderInput) studentGenderInput.value = student.studentGender || '';
    if (studentSchoolInput) studentSchoolInput.value = student.studentSchool || '';
    if (parentNameInput) parentNameInput.value = student.parentName || '';
    if (parentEmailInput) parentEmailInput.value = student.parentEmail || '';
    if (parentContactInput) parentContactInput.value = student.parentContact || '';

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
            const topbarImg = document.getElementById('topbar-avatar-img');
            const topbarText = document.getElementById('topbar-avatar-text');
            if (topbarImg) { topbarImg.src = avatarData.avatarUrl; topbarImg.style.display = 'block'; }
            if (topbarText) topbarText.style.display = 'none';
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
      
      // New profile fields
      const studentNameInput = document.getElementById('student-name-input');
      const studentDobInput = document.getElementById('student-dob-input');
      const studentGradeInput = document.getElementById('student-grade-input');
      const studentGenderInput = document.getElementById('student-gender-input');
      const studentSchoolInput = document.getElementById('student-school-input');
      const parentNameInput = document.getElementById('parent-name-input');
      const parentEmailInput = document.getElementById('parent-email-input');
      const parentContactInput = document.getElementById('parent-contact-input');
      
      if (sidebarName) sidebarName.textContent = name;
      if (sidebarAvatar) sidebarAvatar.textContent = initial;
      if (dashWelcome) dashWelcome.textContent = name;
      if (profileName) profileName.textContent = name;
      if (profileEmail) profileEmail.textContent = cached.email || '';
      if (profileAvatar) profileAvatar.textContent = initial;
      if (profileNameInput) profileNameInput.value = name;
      if (profileEmailInput) profileEmailInput.value = cached.email || '';
      
      // Populate cached profile fields
      if (studentNameInput) studentNameInput.value = cached.studentName || '';
      if (studentDobInput) studentDobInput.value = cached.studentDob || '';
      if (studentGradeInput) studentGradeInput.value = cached.studentGrade || '';
      if (studentGenderInput) studentGenderInput.value = cached.studentGender || '';
      if (studentSchoolInput) studentSchoolInput.value = cached.studentSchool || '';
      if (parentNameInput) parentNameInput.value = cached.parentName || '';
      if (parentEmailInput) parentEmailInput.value = cached.parentEmail || '';
      if (parentContactInput) parentContactInput.value = cached.parentContact || '';
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
  if (userId) {
    _attendanceRecordLogout(userId);
    localStorage.removeItem('ck_dashboard_cache_' + userId);
  }
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
  const studentName = document.getElementById('student-name-input')?.value.trim();
  const studentDob = document.getElementById('student-dob-input')?.value;
  const studentGrade = document.getElementById('student-grade-input')?.value;
  const studentGender = document.getElementById('student-gender-input')?.value;
  const studentSchool = document.getElementById('student-school-input')?.value.trim();
  const parentName = document.getElementById('parent-name-input')?.value.trim();
  const parentEmail = document.getElementById('parent-email-input')?.value.trim();
  const parentContact = document.getElementById('parent-contact-input')?.value.trim();

  if (!name) {
    const msgEl = document.getElementById('profile-save-msg');
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = 'var(--danger)'; msgEl.textContent = 'Account name is required.'; }
    return;
  }

  const msgEl = document.getElementById('profile-save-msg');
  if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = 'var(--muted)'; msgEl.textContent = 'Saving...'; }

  try {
    const profileData = {
      name,
      studentName,
      studentDob,
      studentGrade,
      studentGender,
      studentSchool,
      parentName,
      parentEmail,
      parentContact
    };

    const data = await StudentAPI.updateProfile(profileData);
    if (!data.success) throw new Error(data.message);

    // Update localStorage with all profile data
    const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    Object.assign(cached, profileData);
    if (localStorage.getItem('ck_user')) localStorage.setItem('ck_user', JSON.stringify(cached));
    else sessionStorage.setItem('ck_user', JSON.stringify(cached));

    // Update UI elements that show the display name
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
    const topbarImg = document.getElementById('topbar-avatar-img');
    const topbarText = document.getElementById('topbar-avatar-text');
    if (topbarImg) { topbarImg.src = e.target.result; topbarImg.style.display = 'block'; }
    if (topbarText) topbarText.style.display = 'none';
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

// ═══════════════════════════════════════════════════════════════
// UNIVERSAL BACK NAVIGATION SYSTEM
// Browser-style navigation history for entire app
// ═══════════════════════════════════════════════════════════════

const navigationHistory = [];
let currentPageIndex = -1;
const MAX_HISTORY = 50; // Memory-efficient limit

function getCurrentPageContext() {
  const currentPage = getCurrentActivePage();
  const context = {
    page: currentPage,
    scrollY: window.scrollY || 0,
    timestamp: Date.now()
  };

  // Capture video/lesson context
  if (currentPage === 'video' && _currentLessonContext) {
    context.lessonContext = {
      courseId: _currentLessonContext.courseId,
      moduleId: _currentLessonContext.moduleId,
      lessonId: _currentLessonContext.lessonId,
      courseTitle: _currentLessonContext.courseTitle,
      moduleTitle: _currentLessonContext.moduleTitle,
      lessonTitle: _currentLessonContext.lessonTitle
    };
    // Capture video time if available
    const videoEl = document.getElementById('lesson-video');
    if (videoEl && !videoEl.paused) {
      context.videoTime = videoEl.currentTime;
    }
  }

  // Capture course detail context
  if (currentPage === 'course-detail') {
    const courseTitle = document.getElementById('course-detail-title')?.textContent;
    if (courseTitle) {
      context.courseTitle = courseTitle;
    }
  }

  return context;
}

function getCurrentActivePage() {
  for (const page of appPages) {
    const el = document.getElementById('page-' + page);
    if (el && el.classList.contains('active')) {
      return page;
    }
  }
  return 'dashboard';
}

function restorePageContext(context) {
  if (!context) return;

  // Restore scroll position after a brief delay (let page render)
  if (context.scrollY) {
    setTimeout(() => {
      window.scrollTo(0, context.scrollY);
    }, 100);
  }

  // Restore video/lesson context
  if (context.lessonContext) {
    const lc = context.lessonContext;
    setTimeout(() => {
      openVideoFromBackend(lc.courseId, lc.moduleId, lc.lessonId);
      // Restore video time if available
      if (context.videoTime) {
        setTimeout(() => {
          const videoEl = document.getElementById('lesson-video');
          if (videoEl) {
            videoEl.currentTime = context.videoTime;
          }
        }, 500);
      }
    }, 50);
  }
}

function goBack() {
  if (currentPageIndex > 0) {
    currentPageIndex--;
    const previousPage = navigationHistory[currentPageIndex];
    
    // Navigate without adding to history
    _navigateInternal(previousPage.page, false);
    
    // Restore context
    restorePageContext(previousPage);
    
    // Update back button visibility
    updateBackButtonVisibility();
  }
}

function updateBackButtonVisibility() {
  const currentPage = getCurrentActivePage();
  const hasHistory = currentPageIndex > 0;
  
  // Remove all existing back buttons first
  document.querySelectorAll('.universal-back-btn').forEach(btn => btn.remove());
  
  // Show back button if there's history and not on dashboard
  if (hasHistory && currentPage !== 'dashboard') {
    const pageEl = document.getElementById('page-' + currentPage);
    if (!pageEl) return;
    
    // Special handling for video page - add to existing topbar
    if (currentPage === 'video') {
      const topbarLeft = pageEl.querySelector('.vp-topbar-left');
      if (topbarLeft) {
        // Create compact back button for video page
        const backBtn = document.createElement('button');
        backBtn.className = 'universal-back-btn btn btn-outline btn-sm';
        backBtn.onclick = goBack;
        backBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back';
        backBtn.style.cssText = 'padding:6px 12px; flex-shrink:0; margin-right:12px;';
        backBtn.title = 'Go back (Alt + ←)';
        
        // Insert as first child of topbar-left
        topbarLeft.insertBefore(backBtn, topbarLeft.firstChild);
        return;
      }
    }
    
    // For all other pages - add as first element
    const backBtn = document.createElement('button');
    backBtn.className = 'universal-back-btn';
    backBtn.onclick = goBack;
    backBtn.innerHTML = '<i class="fas fa-arrow-left" style="font-size:0.8rem;"></i><span>Back</span>';
    backBtn.style.cssText = `
      background: rgba(255,255,255,0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      padding: 8px 16px;
      color: rgba(255,255,255,0.65);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      margin-bottom: 16px;
    `;
    backBtn.title = 'Go back (Alt + ←)';
    
    // Hover effects
    backBtn.onmouseenter = function() {
      this.style.background = 'rgba(108,71,255,0.12)';
      this.style.borderColor = 'rgba(108,71,255,0.25)';
      this.style.color = '#fff';
      this.style.transform = 'translateX(-3px)';
      this.style.boxShadow = '0 4px 16px rgba(108,71,255,0.25)';
    };
    backBtn.onmouseleave = function() {
      this.style.background = 'rgba(255,255,255,0.04)';
      this.style.borderColor = 'rgba(255,255,255,0.08)';
      this.style.color = 'rgba(255,255,255,0.65)';
      this.style.transform = 'translateX(0)';
      this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    };
    
    // Insert as first child of page
    pageEl.insertBefore(backBtn, pageEl.firstChild);
  }
}

function _navigateInternal(page, addToHistory) {
  // Existing navigate logic (will be called from both navigate() and goBack())
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
  if (page === 'parent-report') loadParentReport();
  if (page === 'help') loadHelpPage();
  if (page === 'referral') loadReferralPage();
  if (page === 'orders') loadOrdersPage();
  if (page === 'mall') loadMallPage();
  if (page === 'rate-us') loadRateUsPage();
  if (page === 'student-progress') loadStudentProgress();
  if (page === 'coding' && typeof codingPgInit === 'function') {
    // Ensure page-coding is inside main-content (fixes placement issue)
    var pgEl = document.getElementById('page-coding');
    var mc = document.querySelector('.main-content');
    if (pgEl && mc && pgEl.parentElement !== mc) {
      mc.appendChild(pgEl);
    }
    codingPgInit();
    if (mc) mc.scrollTop = 0;
  }

  // Refresh dashboard data when navigating to profile
  if (page === 'profile' || page === 'dashboard') {
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
    // Preload profile sub-pages data in background
    if (page === 'profile' && t) {
      loadOrdersPage();
      loadMallPage();
      loadRateUsPage();
      loadParentReport();
      loadReferralPage();
      loadHelpPage();
      loadStudentProgress();
    }
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

  // Add to navigation history if requested
  if (addToHistory) {
    // Remove forward history (user took new path)
    navigationHistory.splice(currentPageIndex + 1);
    
    // Capture current context before navigating
    const context = getCurrentPageContext();
    context.page = page; // Update to new page
    
    // Add to history
    navigationHistory.push(context);
    currentPageIndex = navigationHistory.length - 1;
    
    // Limit history size for memory efficiency
    if (navigationHistory.length > MAX_HISTORY) {
      navigationHistory.shift();
      currentPageIndex--;
    }
    
    // Update back button visibility
    updateBackButtonVisibility();
  }
}

const appPages = ['dashboard','courses','course-detail','video','chat','ai','live','downloads','offline-downloads','profile','enrolled-detail','completed-videos','streak-history','achievements','parent-report','help','referral','orders','mall','rate-us','about','student-progress','coding'];
const authPages = ['login','signup'];
const sidebarMap = { dashboard:'nav-dashboard', courses:'nav-courses', 'course-detail':'nav-courses', video:'nav-courses', chat:'nav-chat', ai:'nav-ai', live:'nav-live', downloads:'nav-downloads', 'offline-downloads':'nav-offline-downloads', profile:'nav-profile', 'enrolled-detail':'nav-dashboard', 'completed-videos':'nav-dashboard', 'streak-history':'nav-dashboard', 'achievements':'nav-dashboard', 'parent-report':'nav-profile', 'help':'nav-profile', 'referral':'nav-profile', 'orders':'nav-profile', 'mall':'nav-profile', 'rate-us':'nav-profile', 'about':'nav-profile', 'student-progress':'nav-profile','coding':'nav-coding' };

function navigate(page) {
  // Public API - always adds to history
  _navigateInternal(page, true);
}

// Lazy load state for lesson tabs
var _currentLessonForTabs = null;
var _tabDataLoaded = { quiz: false, exercise: false, streak: false, homework: false, rate: false };

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
    } else if (panelId === 'vp-homework' && !_tabDataLoaded.homework) {
      _tabDataLoaded.homework = true;
      _lazyLoadHomework(lessonId, token);
    } else if (panelId === 'vp-rate') {
      _initLessonRateTab();
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

  // Calculate time taken (seconds since quiz tab was opened)
  const timeTaken = _quizStartTime ? Math.round((Date.now() - _quizStartTime) / 1000) : null;

  // Save attempt to server for leaderboard + coins
  const quizId = card.dataset.quizid || '';
  const courseId = _currentLessonContext ? _currentLessonContext.courseId : '';
  const lessonId = _currentLessonForTabs ? _currentLessonForTabs.lessonId : '';
  const _token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (quizId && courseId && _token) {
    fetch(BASE_URL + '/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
      body: JSON.stringify({ quizId, selected: selectedIndex, courseId, lessonId, timeTaken }),
    }).then(r => r.json()).then(data => {
      if (data.coinsAwarded && data.coinsAwarded > 0) {
        _showCoinRewardToast(data.coinsAwarded, data.badge, data.rank);
      }
      loadUserCoins(); // Refresh coins widget
    }).catch(() => {});
  }
}

/**
 * fetchAndShowQuizRank — DEPRECATED
 * Rank now shows in leaderboard modal (profile dropdown), not in quiz tab.
 * Kept as no-op to prevent errors if called from elsewhere.
 */
async function fetchAndShowQuizRank() {
  // Remove rank section if it exists (cleanup from old behavior)
  const rankSection = document.getElementById('quiz-rank-section');
  if (rankSection) rankSection.remove();
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
      // Read language from data attribute (set by coding editor)
      const language = codeInput.getAttribute('data-language') || null;
      const res = await fetch(BASE_URL + '/api/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
        body: JSON.stringify({ exerciseId, code, courseId, language }),
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
        // Update coding output console (for coding exercises)
        var codingOutput = document.getElementById('coding-output-' + idx);
        if (codingOutput) {
          if (data.passed) {
            codingOutput.innerHTML = '<span class="coding-output-success"><i class="fas fa-check-circle"></i> ' + sanitize(data.message || 'Correct! Well done! 🎉') + '</span>';
          } else {
            codingOutput.innerHTML = '<span class="coding-output-error"><i class="fas fa-times-circle"></i> ' + sanitize(data.message || 'Not quite right. Keep trying!') + '</span>';
          }
        }
      } else {
        result.style.color = '#22c55e';
        result.innerHTML = '<i class="fas fa-check-circle"></i> Solution submitted!';
        var codingOutput2 = document.getElementById('coding-output-' + idx);
        if (codingOutput2) codingOutput2.innerHTML = '<span class="coding-output-success"><i class="fas fa-check-circle"></i> Solution submitted!</span>';
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
    // Check if this is a coding exercise — render full coding interface + link button
    if (exercise.type === 'coding') {
      html += '<div class="exercise-card" data-exerciseid="' + (exercise.id || '') + '" style="margin-bottom:20px; padding-bottom:20px;' + (exIndex < exercises.length - 1 ? ' border-bottom:1px solid rgba(255,255,255,0.06);' : '') + '">';
      if (exercises.length > 1) {
        html += '<div style="font-size:0.75rem; font-weight:700; color:#a78bfa; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Exercise ' + (exIndex + 1) + ' of ' + exercises.length + '</div>';
      }
      // "Practice in Code Editor" button — links to Code Editor page
      html += '<div style="margin-bottom:14px;">';
      html += '  <button onclick="codingPgOpenFromExercise(\'' + (exercise.id || '') + '\')" style="background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:10px;padding:10px 18px;color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.15s;" onmouseover="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 15px rgba(108,71,255,0.4)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'none\'">';
      html += '    <i class="fas fa-external-link-alt"></i> Practice in Code Editor →';
      html += '  </button>';
      html += '</div>';
      html += renderCodingExercise(exercise, exIndex);
      // Hidden textarea for backward-compatible submission
      html += '<textarea id="exercise-code-input-' + exIndex + '" style="display:none;"></textarea>';
      html += '<div id="exercise-submit-result-' + exIndex + '" style="display:none; margin-top:10px; font-size:0.85rem;"></div>';
      html += '</div>';
      return;
    }

    // Default: theory exercise (existing behavior)
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
  const sendBtn = input ? input.nextElementSibling || input.parentElement.querySelector('button') : null;
  if (!input || !messages) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  // Disable input and button during fetch
  input.disabled = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

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
  // Re-enable input and button
  input.disabled = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  input.focus();
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
  const sendBtn = input ? input.closest('.chat-input-bar')?.querySelector('button') : null;

  // Disable input and button during fetch
  input.disabled = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

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

  // Re-enable input and button
  input.disabled = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  input.focus();
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
  if (next && (next.isFree || !!next.videoUrl)) {
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
    _currentVideoData = { lessonId: lesson.id, title: lesson.title, courseTitle: course.title || '', moduleTitle: mod.title, videoUrl: lesson.videoUrl, notesUrl: lesson.notes || '', qualityUrls: lesson.qualityUrls || null };

    await loadVideo(lesson.videoUrl || '', lesson.hlsMasterUrl || null, lesson.hlsQualities || []);
    // Video completion: mark complete only when 90%+ watched (handled by video player event)
    _pendingLessonComplete = lesson.id;
    // Reset AI mentor chat for new lesson
    _aiMentorHistory = [];
    // Auto-load rate tab reviews
    _initLessonRateTab();
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
    if (floatBtn) floatBtn.style.display = (nextLesson && (nextLesson.isFree || !!nextLesson.videoUrl)) ? 'flex' : 'none';

    const notesUrl = lesson.notes || '';
    renderNotesTab(notesUrl, []);

    // Lazy load: quiz and exercise are fetched only when user clicks the tab
    // Store lesson context for lazy fetch
    _currentLessonForTabs = { lessonId: lesson.id, courseId: courseId };
    _tabDataLoaded = { quiz: false, exercise: false, streak: false, homework: false };

    // Cleanup any previous Monaco editor instances
    if (typeof codingCleanupEditors === 'function') codingCleanupEditors();

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
        const canAccess = course.isEnrolled || l.isFree || !!l.videoUrl;
        const item = document.createElement('div');
        item.className = 'playlist-item' + (isActive ? ' active' : '') + (canAccess ? '' : ' locked');
        if (canAccess) item.onclick = () => openVideoFromBackend(courseId, m.id, l.id);
        item.innerHTML =
          '<i class="fas ' + (isCompleted ? 'fa-check-circle' : (canAccess ? 'fa-play-circle' : 'fa-lock')) + '" style="color:' + (isCompleted ? 'var(--success)' : (canAccess ? (isActive ? '#a78bfa' : 'var(--muted)') : 'var(--danger)')) + ';font-size:0.8rem;flex-shrink:0;"></i>' +
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
  }).then(() => {
    // Refresh dashboard cache so completed videos count stays accurate
    StudentAPI.getDashboard().then(data => _applyDashboardData(data, false)).catch(() => {});
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

// ─── HLS / Video Player ───────────────────────────────────────────────────────
var _hlsInstance = null; // not used anymore — kept for compatibility

function _destroyHls() {
  // No-op — we don't use hls.js anymore
}

function _setHlsStatus(msg) {
  var el = document.getElementById('video-hls-status');
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else { el.style.display = 'none'; el.textContent = ''; }
}

function _renderQualityControls(qualityUrls, directUrl) {
  var container = document.getElementById('video-quality-controls');
  if (!container) return;
  container.innerHTML = '';

  var qualities = qualityUrls ? Object.keys(qualityUrls) : [];
  if (!qualities.length && !directUrl) { container.style.display = 'none'; return; }

  container.style.display = 'block';
  container.style.position = 'absolute';
  container.style.top = '12px';
  container.style.right = '12px';
  container.style.zIndex = '20';

  // Gear button
  var gearBtn = document.createElement('button');
  gearBtn.innerHTML = '<i class="fas fa-cog"></i>';
  gearBtn.style.cssText = 'background:rgba(0,0,0,0.6);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;transition:all 0.2s;';
  gearBtn.onmouseover = function() { gearBtn.style.background = 'rgba(255,255,255,0.2)'; };
  gearBtn.onmouseout = function() { if (!dropdown._open) gearBtn.style.background = 'rgba(0,0,0,0.6)'; };

  // Dropdown menu
  var dropdown = document.createElement('div');
  dropdown._open = false;
  dropdown.style.cssText = 'display:none;position:absolute;top:38px;right:0;background:#1a1a2e;border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:6px 0;min-width:130px;box-shadow:0 8px 24px rgba(0,0,0,0.6);';

  // Header
  var header = document.createElement('div');
  header.textContent = 'Quality';
  header.style.cssText = 'font-size:0.68rem;color:rgba(255,255,255,0.4);padding:4px 14px 6px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;';
  dropdown.appendChild(header);

  var activeQuality = 'Original';

  function makeItem(label, isActive, onclick) {
    var item = document.createElement('div');
    item.textContent = label;
    item.style.cssText = 'padding:8px 14px;font-size:0.82rem;cursor:pointer;color:' + (isActive ? '#fff' : 'rgba(255,255,255,0.7)') + ';font-weight:' + (isActive ? '700' : '400') + ';display:flex;align-items:center;justify-content:space-between;';
    if (isActive) item.innerHTML = label + ' <span style="color:#6c47ff;">●</span>';
    item.onmouseover = function() { item.style.background = 'rgba(255,255,255,0.08)'; };
    item.onmouseout = function() { item.style.background = 'none'; };
    item.onclick = function() {
      onclick();
      dropdown.style.display = 'none';
      dropdown._open = false;
      gearBtn.style.background = 'rgba(0,0,0,0.6)';
      activeQuality = label;
      // Rebuild to update active indicator
      _renderQualityControls(qualityUrls, directUrl);
    };
    return item;
  }

  // Original option
  dropdown.appendChild(makeItem('Original', activeQuality === 'Original', function() {
    var videoEl = document.getElementById('video-player');
    if (!videoEl || !directUrl) return;
    var t = videoEl.currentTime;
    videoEl.src = directUrl;
    videoEl.currentTime = t;
    videoEl.muted = false;
    videoEl.volume = 1;
    videoEl.play().catch(function() {});
  }));

  // Quality options
  qualities.forEach(function(q) {
    dropdown.appendChild(makeItem(q, activeQuality === q, function() {
      var videoEl = document.getElementById('video-player');
      if (!videoEl) return;
      var t = videoEl.currentTime;
      videoEl.src = qualityUrls[q];
      videoEl.currentTime = t;
      videoEl.muted = false;
      videoEl.volume = 1;
      videoEl.play().catch(function() {});
    }));
  });

  // Toggle dropdown on gear click
  gearBtn.onclick = function(e) {
    e.stopPropagation();
    if (dropdown._open) {
      dropdown.style.display = 'none';
      dropdown._open = false;
      gearBtn.style.background = 'rgba(0,0,0,0.6)';
    } else {
      dropdown.style.display = 'block';
      dropdown._open = true;
      gearBtn.style.background = 'rgba(255,255,255,0.2)';
    }
  };

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', function closeQualityDropdown() {
    if (dropdown._open) {
      dropdown.style.display = 'none';
      dropdown._open = false;
      gearBtn.style.background = 'rgba(0,0,0,0.6)';
    }
  });

  container.appendChild(dropdown);
  container.appendChild(gearBtn);
}

async function loadVideo(url, hlsMasterUrl, hlsQualities) {
  var iframe = document.getElementById('video-iframe');
  var videoEl = document.getElementById('video-player');
  if (!iframe || !videoEl) return;

  _setHlsStatus(null);
  var qc = document.getElementById('video-quality-controls');
  if (qc) { qc.innerHTML = ''; qc.style.display = 'none'; }

  if (!url) {
    iframe.src = ''; iframe.style.display = 'block';
    videoEl.src = ''; videoEl.style.display = 'none';
    return;
  }

  // YouTube — iframe only
  if (url.includes('youtube') || url.includes('youtu.be')) {
    iframe.src = url.includes('?') ? url + '&rel=0' : url + '?rel=0';
    iframe.style.display = 'block';
    videoEl.style.display = 'none';
    videoEl.src = '';
    return;
  }

  iframe.style.display = 'none';
  iframe.src = '';
  videoEl.style.display = 'block';

  // Attach 90% completion tracker
  _lessonMarkedComplete = false;
  videoEl.ontimeupdate = function() {
    if (_lessonMarkedComplete || !_pendingLessonComplete) return;
    if (videoEl.duration && videoEl.currentTime / videoEl.duration >= 0.9) {
      _lessonMarkedComplete = true;
      markLessonComplete(_pendingLessonComplete);
    }
  };

  // Play original directly — guaranteed perfect audio
  videoEl.src = url;
  videoEl.muted = false;
  videoEl.volume = 1;

  // Show quality gear — always visible
  var qualityUrls = _currentVideoData ? _currentVideoData.qualityUrls : null;
  _renderQualityControls(qualityUrls, url);
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

  // Use cached dashboard data first — no API call needed
  const userId = getCurrentUserId();
  const cacheKey = 'ck_dashboard_cache_' + userId;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data.success && data.enrolledCourses && data.enrolledCourses.length > 0) {
        _renderEnrolledList(container, data.enrolledCourses);
        return;
      }
    } catch {}
  }

  // Fallback: fetch if no cache
  container.innerHTML = '<p style="color:var(--muted)">Loading...</p>';
  try {
    const data = await StudentAPI.getDashboard();
    if (!data.success || !data.enrolledCourses || data.enrolledCourses.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-book-open" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No enrolled courses yet.</p></div>';
      return;
    }
    _renderEnrolledList(container, data.enrolledCourses);
  } catch {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load courses.</p>';
  }
}

function _renderEnrolledList(container, enrolledCourses) {
  container.innerHTML = enrolledCourses.map(c =>
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
}

async function showCompletedVideos() {
  navigate('completed-videos');
  const container = document.getElementById('completed-videos-list');
  if (!container) return;

  // Use cached dashboard data first — no API call needed
  const userId = getCurrentUserId();
  const cacheKey = 'ck_dashboard_cache_' + userId;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data.success) {
        const enrolledCourses = data.enrolledCourses || [];
        const totalCompleted = enrolledCourses.reduce((sum, c) => sum + (c.completedLessons || 0), 0);
        if (totalCompleted === 0) {
          container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No completed videos yet. Start learning!</p></div>';
          return;
        }
        container.innerHTML = enrolledCourses.filter(c => c.completedLessons > 0).map(c =>
          '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">' +
          '<div style="width:36px;height:36px;border-radius:10px;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-check" style="color:#22c55e;font-size:0.8rem"></i></div>' +
          '<div style="flex:1">' +
          '<p style="color:#fff;font-weight:600;font-size:0.88rem;margin:0">' + sanitize(c.title) + '</p>' +
          '<p style="color:var(--muted);font-size:0.75rem;margin:2px 0 0">' + c.completedLessons + ' of ' + c.totalLessons + ' lessons completed</p>' +
          '</div>' +
          '<span style="color:#22c55e;font-size:0.85rem;font-weight:700">' + c.progressPercent + '%</span>' +
          '</div>'
        ).join('');
        return;
      }
    } catch {}
  }

  // Fallback: fetch if no cache
  container.innerHTML = '<p style="color:var(--muted)">Loading...</p>';
  try {
    const data = await StudentAPI.getDashboard();
    if (!data.success) { container.innerHTML = '<p style="color:var(--danger)">Failed to load data.</p>'; return; }
    const enrolledCourses = data.enrolledCourses || [];
    const totalCompleted = enrolledCourses.reduce((sum, c) => sum + (c.completedLessons || 0), 0);
    if (totalCompleted === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No completed videos yet. Start learning!</p></div>';
      return;
    }
    container.innerHTML = enrolledCourses.filter(c => c.completedLessons > 0).map(c =>
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px">' +
      '<div style="width:36px;height:36px;border-radius:10px;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-check" style="color:#22c55e;font-size:0.8rem"></i></div>' +
      '<div style="flex:1">' +
      '<p style="color:#fff;font-weight:600;font-size:0.88rem;margin:0">' + sanitize(c.title) + '</p>' +
      '<p style="color:var(--muted);font-size:0.75rem;margin:2px 0 0">' + c.completedLessons + ' of ' + c.totalLessons + ' lessons completed</p>' +
      '</div>' +
      '<span style="color:#22c55e;font-size:0.85rem;font-weight:700">' + c.progressPercent + '%</span>' +
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

// ─── Attendance Tracking (localStorage only — no backend needed) ─────────────
// Stores per-user session log: { date, loginTime, logoutTime, durationMins }
// Key: ck_attendance_<userId>  →  array of last 60 session records

function _attendanceKey(userId) {
  return 'ck_attendance_' + (userId || getCurrentUserId());
}

function _attendanceRecordLogin() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return;
    const key = _attendanceKey(userId);
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    const dateStr = new Date(now).toISOString().split('T')[0];
    // If already have an open session today (no logoutTime), close it first
    sessions.forEach(function(s) { if (!s.logoutTime) s.logoutTime = now; });
    sessions.push({ date: dateStr, loginTime: now, logoutTime: null });
    // Keep last 60 sessions only
    if (sessions.length > 60) sessions.splice(0, sessions.length - 60);
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {}
}

function _attendanceRecordLogout(userId) {
  try {
    const key = _attendanceKey(userId);
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    // Close the most recent open session
    for (var i = sessions.length - 1; i >= 0; i--) {
      if (!sessions[i].logoutTime) {
        sessions[i].logoutTime = now;
        sessions[i].durationMins = Math.round((now - sessions[i].loginTime) / 60000);
        break;
      }
    }
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {}
}

// Returns attendance summary for the report
function _attendanceGetSummary() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return { todayMins: 0, weekMins: 0, calendar: [], activeDays: 0 };
    const key = _attendanceKey(userId);
    const sessions = JSON.parse(localStorage.getItem(key) || '[]');
    const now = Date.now();
    const todayStr = new Date(now).toISOString().split('T')[0];
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Build per-day totals — always compute live from loginTime/logoutTime
    var dayMap = {};
    sessions.forEach(function(s) {
      var logout = s.logoutTime || now; // open session = still active
      var mins = Math.round((logout - s.loginTime) / 60000);
      if (mins < 0) mins = 0;
      if (mins > 1440) mins = 1440; // cap at 24h
      dayMap[s.date] = (dayMap[s.date] || 0) + mins;
    });

    var todayMins = dayMap[todayStr] || 0;
    var weekMins = 0;
    Object.keys(dayMap).forEach(function(d) {
      if (new Date(d).getTime() >= weekAgo) weekMins += dayMap[d];
    });

    // 30-day calendar
    var calendar = [];
    for (var i = 29; i >= 0; i--) {
      var d = new Date(now - i * 24 * 60 * 60 * 1000);
      var dStr = d.toISOString().split('T')[0];
      var m = dayMap[dStr] || 0;
      calendar.push({ date: dStr, day: d.getDate(), mins: m, active: m > 0 });
    }

    var activeDays = calendar.filter(function(c) { return c.active; }).length;
    return { todayMins: todayMins, weekMins: weekMins, calendar: calendar, activeDays: activeDays };
  } catch { return { todayMins: 0, weekMins: 0, calendar: [], activeDays: 0 }; }
}

function _fmtMins(mins) {
  if (!mins || mins <= 0) return '0 min';
  if (mins < 60) return mins + ' min';
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
}

// ─── Parent Report / My Report ──────────────────────────────────────────────
// Uses only data already fetched by existing APIs — no new backend calls needed.

async function loadParentReport() {
  const loading = document.getElementById('parent-report-loading');
  const content = document.getElementById('parent-report-content');
  if (!loading || !content) return;

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    loading.innerHTML = '<p style="color:var(--muted)">Please log in to view your report.</p>';
    loading.style.display = 'block';
    content.style.display = 'none';
    return;
  }

  const userId = getCurrentUserId();
  const cacheKey = 'ck_dashboard_cache_' + userId;

  // ── Step 1: Render from cache instantly (no loading spinner) ──
  let dashData = null;
  try { const c = localStorage.getItem(cacheKey); if (c) dashData = JSON.parse(c); } catch {}

  if (dashData && dashData.success) {
    loading.style.display = 'none';
    content.style.display = 'block';
    _renderParentReport(dashData, [], _userCoinsCache || 0);
  } else {
    loading.style.display = 'block';
    content.style.display = 'none';
  }

  // ── Step 2: Fetch fresh data in parallel, update silently ──
  try {
    const [freshDash, coinsRes, achRes] = await Promise.all([
      StudentAPI.getDashboard().catch(function() { return null; }),
      fetch(BASE_URL + '/api/coins', { headers: { Authorization: 'Bearer ' + token } }).then(function(r) { return r.json(); }).catch(function() { return {}; }),
      fetch(BASE_URL + '/api/achievements', { headers: { Authorization: 'Bearer ' + token } }).then(function(r) { return r.json(); }).catch(function() { return {}; }),
    ]);

    if (freshDash && freshDash.success) dashData = freshDash;
    if (!dashData || !dashData.success) throw new Error('Could not load your data. Please try again.');

    const totalCoins = (coinsRes.success ? coinsRes.totalCoins : 0) || _userCoinsCache || 0;
    const achievements = (achRes.success ? achRes.achievements : []) || [];

    loading.style.display = 'none';
    content.style.display = 'block';
    _renderParentReport(dashData, achievements, totalCoins);

  } catch (err) {
    if (content.style.display !== 'block') {
      loading.style.display = 'block';
      content.style.display = 'none';
      loading.innerHTML = '<div style="text-align:center;padding:40px;">' +
        '<i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--danger);margin-bottom:12px;display:block;"></i>' +
        '<p style="color:var(--muted)">Failed to load: ' + sanitize(err.message || 'Please try again.') + '</p>' +
        '<button class="btn btn-outline btn-sm" onclick="loadParentReport()" style="margin-top:12px;">Retry</button>' +
        '</div>';
    }
  }
}

function _renderParentReport(dashData, achievements, totalCoins) {
  const enrolledCourses = dashData.enrolledCourses || [];
  const totalEnrolled = dashData.enrolledCount || enrolledCourses.length;
  const totalCompleted = enrolledCourses.reduce(function(s, c) { return s + (c.completedLessons || 0); }, 0);
  const certCount = enrolledCourses.filter(function(c) { return c.progressPercent === 100; }).length;
  const superMasterCount = achievements.filter(function(a) { return a.badgeType === 'super-master'; }).length;
  const masterCount = achievements.filter(function(a) { return a.badgeType === 'master'; }).length;
  const proCount = achievements.filter(function(a) { return a.badgeType === 'pro'; }).length;
  const streakCount = parseInt(document.getElementById('stat-streak')?.textContent || '0') || 0;
  const studentName = document.getElementById('sidebar-user-name')?.textContent || 'Student';
  const att = _attendanceGetSummary();

  // Summary cards
  const summaryCards = [
    { icon: 'fa-book-open',     color: '#6c47ff', label: 'Courses Enrolled',  value: totalEnrolled,           sub: 'total' },
    { icon: 'fa-check-circle',  color: '#22c55e', label: 'Lessons Completed', value: totalCompleted,          sub: 'all time' },
    { icon: 'fa-clock',         color: '#f59e0b', label: 'Today',             value: _fmtMins(att.todayMins), sub: 'learning time' },
    { icon: 'fa-calendar-week', color: '#ec4899', label: 'This Week',         value: _fmtMins(att.weekMins),  sub: att.activeDays + ' active days / 30' },
  ];
  document.getElementById('pr-summary-cards').innerHTML = summaryCards.map(function(c) {
    return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
      '<div style="width:36px;height:36px;border-radius:10px;background:' + c.color + '20;display:flex;align-items:center;justify-content:center;">' +
      '<i class="fas ' + c.icon + '" style="color:' + c.color + ';font-size:0.9rem;"></i></div>' +
      '<span style="font-size:0.78rem;color:var(--muted);font-weight:600;">' + c.label + '</span></div>' +
      '<div style="font-size:1.6rem;font-weight:800;color:#fff;">' + c.value + '</div>' +
      '<div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">' + c.sub + '</div>' +
      '</div>';
  }).join('');

  // Attendance calendar
  var attMeta = document.getElementById('pr-attendance-meta');
  var attCal = document.getElementById('pr-attendance-calendar');
  if (attMeta) attMeta.textContent = att.activeDays + ' active days out of 30 · Today: ' + _fmtMins(att.todayMins) + ' · This week: ' + _fmtMins(att.weekMins);
  if (attCal) {
    attCal.innerHTML = att.calendar.map(function(day) {
      var intensity = day.mins === 0 ? 0 : day.mins < 15 ? 0.3 : day.mins < 30 ? 0.6 : 1;
      var bg = day.active ? 'linear-gradient(135deg,rgba(108,71,255,' + intensity + '),rgba(236,72,153,' + intensity + '))' : 'rgba(255,255,255,0.05)';
      return '<div title="' + day.date + (day.mins > 0 ? ' · ' + _fmtMins(day.mins) : ' · No activity') + '" style="width:100%;aspect-ratio:1;border-radius:4px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:' + (day.active ? '#fff' : 'rgba(255,255,255,0.2)') + ';font-weight:600;">' + day.day + '</div>';
    }).join('');
  }

  // Course progress
  document.getElementById('pr-course-progress').innerHTML = enrolledCourses.length > 0
    ? enrolledCourses.map(function(c) {
        var pct = c.progressPercent || 0;
        return '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">' +
          '<span style="font-size:0.85rem;color:#fff;font-weight:600;">' + sanitize(c.title) + '</span>' +
          '<span style="font-size:0.82rem;font-weight:700;color:' + (pct === 100 ? '#22c55e' : '#a78bfa') + ';">' + pct + '%</span>' +
          '</div>' +
          '<div style="height:6px;background:rgba(255,255,255,0.08);border-radius:50px;overflow:hidden;">' +
          '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#6c47ff,#ec4899);border-radius:50px;"></div>' +
          '</div>' +
          '<div style="font-size:0.72rem;color:var(--muted);margin-top:4px;">' + (c.completedLessons || 0) + ' lessons completed</div>' +
          '</div>';
      }).join('')
    : '<p style="color:var(--muted);font-size:0.85rem;">No courses enrolled yet.</p>';

  // Stats row
  document.getElementById('pr-stats-row').innerHTML = [
    { icon: 'fa-fire',   color: '#ef4444', label: 'Weekly Streak', value: streakCount,         sub: 'lessons this week' },
    { icon: 'fa-trophy', color: '#f59e0b', label: 'Certificates',  value: certCount,           sub: 'courses finished' },
    { icon: 'fa-coins',  color: '#ec4899', label: 'Coins Earned',  value: totalCoins,          sub: 'total' },
    { icon: 'fa-medal',  color: '#a78bfa', label: 'Achievements',  value: achievements.length, sub: 'badges earned' },
  ].map(function(c) {
    return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<i class="fas ' + c.icon + '" style="color:' + c.color + ';font-size:0.85rem;"></i>' +
      '<span style="font-size:0.75rem;color:var(--muted);font-weight:600;">' + c.label + '</span></div>' +
      '<div style="font-size:1.4rem;font-weight:800;color:#fff;">' + c.value + '</div>' +
      '<div style="font-size:0.7rem;color:var(--muted);margin-top:2px;">' + c.sub + '</div>' +
      '</div>';
  }).join('');

  // Achievements badges
  const earnedBadges = [
    { icon: '🏆', color: '#fbbf24', label: 'Super Master', count: superMasterCount },
    { icon: '🥈', color: '#a78bfa', label: 'Master',       count: masterCount },
    { icon: '⭐', color: '#22c55e', label: 'Pro',          count: proCount },
  ].filter(function(b) { return b.count > 0; });
  document.getElementById('pr-achievements').innerHTML = earnedBadges.length === 0
    ? '<p style="color:var(--muted);font-size:0.85rem;">No achievements yet. Complete quizzes to earn badges!</p>'
    : earnedBadges.map(function(b) {
        return '<div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 16px;">' +
          '<span style="font-size:1.5rem;">' + b.icon + '</span>' +
          '<div><div style="font-size:0.88rem;font-weight:700;color:#fff;">' + b.label + '</div>' +
          '<div style="font-size:0.75rem;color:' + b.color + ';font-weight:600;">' + b.count + ' earned</div></div>' +
          '</div>';
      }).join('');

  // Recent achievements
  const recentEl = document.getElementById('pr-recent-achievements');
  if (recentEl) {
    recentEl.innerHTML = achievements.length === 0
      ? '<p style="color:var(--muted);font-size:0.82rem;">No achievements yet.</p>'
      : achievements.slice(0, 5).map(function(a) {
          var icon = a.badgeType === 'super-master' ? '🏆' : a.badgeType === 'master' ? '🥈' : '⭐';
          var date = new Date(a.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
            '<span style="font-size:1.2rem;">' + icon + '</span>' +
            '<div style="flex:1;"><div style="font-size:0.82rem;font-weight:600;color:#fff;">' + sanitize(a.title) + '</div>' +
            '<div style="font-size:0.72rem;color:var(--muted);">' + sanitize(a.lessonTitle || '') + '</div></div>' +
            '<div style="font-size:0.72rem;color:var(--muted);">' + date + '</div></div>';
        }).join('');
  }

  // Store for share
  window._prReportData = { studentName, totalEnrolled, totalCompleted, certCount, totalCoins, streakCount, superMasterCount, masterCount, proCount, enrolledCourses, achievements, att };
}

// ─── Network Diagnostics ──────────────────────────────────────────────────────

async function runNetworkDiagnostics() {
  var iconEl = document.getElementById('net-icon');
  var statusEl = document.getElementById('net-status-text');
  var subEl = document.getElementById('net-status-sub');
  var internetEl = document.getElementById('net-internet');
  var pingEl = document.getElementById('net-ping');
  var qualityEl = document.getElementById('net-quality');
  if (!statusEl) return;

  statusEl.textContent = 'Running diagnostics...';
  subEl.textContent = '';
  if (iconEl) iconEl.textContent = '🔄';
  if (internetEl) internetEl.textContent = '...';
  if (pingEl) pingEl.textContent = '...';
  if (qualityEl) qualityEl.textContent = '...';

  // Check internet
  var online = navigator.onLine;
  if (internetEl) {
    internetEl.textContent = online ? 'Connected' : 'Offline';
    internetEl.style.color = online ? '#22c55e' : '#ef4444';
  }

  if (!online) {
    statusEl.textContent = 'No Internet Connection';
    subEl.textContent = 'Check your WiFi or mobile data';
    if (iconEl) iconEl.textContent = '❌';
    if (pingEl) { pingEl.textContent = '—'; pingEl.style.color = 'var(--muted)'; }
    if (qualityEl) { qualityEl.textContent = '—'; qualityEl.style.color = 'var(--muted)'; }
    return;
  }

  // Ping server
  try {
    var start = performance.now();
    var res = await fetch(BASE_URL + '/api/health');
    var end = performance.now();
    var ping = Math.round(end - start);

    if (res.ok) {
      if (pingEl) { pingEl.textContent = ping + 'ms'; pingEl.style.color = ping < 200 ? '#22c55e' : ping < 500 ? '#f59e0b' : '#ef4444'; }

      var quality = ping < 150 ? 'Excellent' : ping < 300 ? 'Good' : ping < 600 ? 'Fair' : 'Poor';
      var qualColor = ping < 150 ? '#22c55e' : ping < 300 ? '#4ade80' : ping < 600 ? '#f59e0b' : '#ef4444';
      if (qualityEl) { qualityEl.textContent = quality; qualityEl.style.color = qualColor; }

      statusEl.textContent = 'Connection is ' + quality;
      subEl.textContent = 'Server responded in ' + ping + 'ms';
      if (iconEl) iconEl.textContent = ping < 300 ? '✅' : '⚠️';
    } else {
      throw new Error('Server error');
    }
  } catch (err) {
    if (pingEl) { pingEl.textContent = 'Failed'; pingEl.style.color = '#ef4444'; }
    if (qualityEl) { qualityEl.textContent = 'Error'; qualityEl.style.color = '#ef4444'; }
    statusEl.textContent = 'Cannot reach CodingKida servers';
    subEl.textContent = 'Server may be down or your network is blocking the connection';
    if (iconEl) iconEl.textContent = '❌';
  }
}

// ─── My Orders ─────────────────────────────────────────────────────────────────

async function loadOrdersPage() {
  var loading = document.getElementById('orders-loading');
  var content = document.getElementById('orders-content');
  if (!loading || !content) return;
  loading.style.display = 'block'; content.style.display = 'none';

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    var res = await fetch(BASE_URL + '/api/student/orders', { headers: { Authorization: 'Bearer ' + token } });
    var data = await res.json();
    if (!data.success) throw new Error(data.message);

    loading.style.display = 'none'; content.style.display = 'block';
    var orders = data.orders || [];

    if (orders.length === 0) {
      content.innerHTML = '<div class="card" style="text-align:center;padding:40px;"><i class="fas fa-shopping-bag" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block;"></i><p style="color:var(--muted);">No orders yet. Enroll in a course to get started!</p></div>';
      return;
    }

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">' +
      '<div class="card" style="text-align:center;padding:16px;"><div style="font-size:1.6rem;font-weight:800;color:#6c47ff;">' + data.totalOrders + '</div><div style="font-size:0.75rem;color:var(--muted);">Total Orders</div></div>' +
      '<div class="card" style="text-align:center;padding:16px;"><div style="font-size:1.6rem;font-weight:800;color:#22c55e;">₹' + data.totalSpent + '</div><div style="font-size:0.75rem;color:var(--muted);">Total Spent</div></div>' +
      '<div class="card" style="text-align:center;padding:16px;"><div style="font-size:1.6rem;font-weight:800;color:#f59e0b;">' + orders.filter(function(o){return o.status==='success';}).length + '</div><div style="font-size:0.75rem;color:var(--muted);">Successful</div></div>' +
      '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:12px;">';
    orders.forEach(function(o) {
      var statusColor = o.status === 'success' ? '#22c55e' : o.status === 'failed' ? '#ef4444' : '#f59e0b';
      var date = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      html += '<div class="card" style="display:flex;align-items:center;gap:16px;padding:16px;">' +
        '<div style="width:42px;height:42px;border-radius:12px;background:rgba(108,71,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">📚</div>' +
        '<div style="flex:1;"><div style="font-size:0.9rem;font-weight:700;color:#fff;">' + sanitize(o.courseTitle) + '</div><div style="font-size:0.75rem;color:var(--muted);">' + date + '</div></div>' +
        '<div style="text-align:right;"><div style="font-size:1rem;font-weight:800;color:#fff;">₹' + o.amount + '</div><div style="font-size:0.72rem;font-weight:600;color:' + statusColor + ';text-transform:capitalize;">' + o.status + '</div></div>' +
        '</div>';
    });
    html += '</div>';
    content.innerHTML = html;
  } catch (err) {
    loading.innerHTML = '<p style="color:var(--muted);">Failed to load orders.</p>';
  }
}

// ─── CK Mall ──────────────────────────────────────────────────────────────────

async function loadMallPage() {
  var loading = document.getElementById('mall-loading');
  var content = document.getElementById('mall-content');
  if (!loading || !content) return;
  loading.style.display = 'block'; content.style.display = 'none';

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    var res = await fetch(BASE_URL + '/api/mall', { headers: { Authorization: 'Bearer ' + token } });
    var data = await res.json();
    if (!data.success) throw new Error(data.message);

    loading.style.display = 'none'; content.style.display = 'block';

    var html = '<div class="card" style="text-align:center;padding:20px;margin-bottom:20px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);">' +
      '<div style="font-size:2rem;font-weight:800;color:#fbbf24;">🪙 ' + data.balance + '</div><div style="font-size:0.8rem;color:var(--muted);">Your Coin Balance</div></div>';

    // Coupon input
    html += '<div class="card" style="margin-bottom:20px;padding:20px;">' +
      '<div style="font-weight:700;color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;"><i class="fas fa-tag" style="color:#6c47ff;"></i> Apply Coupon Code</div>' +
      '<div style="display:flex;gap:10px;"><input id="mall-coupon-input" type="text" placeholder="Enter coupon code" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#fff;font-size:0.88rem;outline:none;text-transform:uppercase;" />' +
      '<button onclick="applyCoupon()" style="background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:8px;padding:10px 20px;color:#fff;font-weight:700;cursor:pointer;">Apply</button></div>' +
      '<div id="mall-coupon-msg" style="display:none;margin-top:8px;font-size:0.82rem;"></div></div>';

    // Offers grid
    html += '<div style="font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;"><i class="fas fa-gift" style="color:#f59e0b;"></i> Redeem with Coins</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';
    (data.offers || []).forEach(function(offer) {
      var opacity = offer.available ? '1' : '0.5';
      html += '<div class="card" style="padding:16px;opacity:' + opacity + ';">' +
        '<div style="font-size:1.5rem;margin-bottom:8px;">' + offer.icon + '</div>' +
        '<div style="font-size:0.88rem;font-weight:700;color:#fff;margin-bottom:4px;">' + offer.title + '</div>' +
        '<div style="font-size:0.75rem;color:var(--muted);margin-bottom:12px;">' + offer.description + '</div>' +
        '<button onclick="redeemOffer(\'' + offer.id + '\')" ' + (offer.available ? '' : 'disabled') + ' style="background:' + (offer.available ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'rgba(255,255,255,0.1)') + ';border:none;border-radius:8px;padding:8px 14px;color:' + (offer.available ? '#000' : 'var(--muted)') + ';font-size:0.78rem;font-weight:700;cursor:' + (offer.available ? 'pointer' : 'not-allowed') + ';width:100%;">🪙 ' + offer.coinsRequired + ' Coins</button>' +
        '</div>';
    });
    html += '</div>';
    content.innerHTML = html;
  } catch (err) {
    loading.innerHTML = '<p style="color:var(--muted);">Failed to load mall.</p>';
  }
}

async function applyCoupon() {
  var input = document.getElementById('mall-coupon-input');
  var msg = document.getElementById('mall-coupon-msg');
  if (!input || !msg) return;
  var code = input.value.trim();
  if (!code) { msg.style.display = 'block'; msg.style.color = '#ef4444'; msg.textContent = 'Please enter a coupon code'; return; }

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    var res = await fetch(BASE_URL + '/api/mall/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ couponCode: code }),
    });
    var data = await res.json();
    msg.style.display = 'block';
    if (data.success) { msg.style.color = '#22c55e'; msg.textContent = '✅ ' + data.message + ' — ' + data.coupon.discount + '% off!'; }
    else { msg.style.color = '#ef4444'; msg.textContent = '❌ ' + data.message; }
  } catch { msg.style.display = 'block'; msg.style.color = '#ef4444'; msg.textContent = 'Network error'; }
}

async function redeemOffer(offerId) {
  if (!confirm('Are you sure you want to redeem this offer?')) return;
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    var res = await fetch(BASE_URL + '/api/mall/redeem', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ offerId: offerId }),
    });
    var data = await res.json();
    if (data.success) { alert('✅ ' + data.message + '\nNew balance: ' + data.newBalance + ' coins'); loadMallPage(); }
    else { alert('❌ ' + data.message); }
  } catch { alert('Network error'); }
}

// ─── Rate Us ──────────────────────────────────────────────────────────────────

var _selectedRating = 0;

function loadRateUsPage() {
  var container = document.getElementById('rate-stars');
  if (!container) return;
  _selectedRating = 0;
  container.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('span');
    star.textContent = '☆';
    star.dataset.value = i;
    star.style.cssText = 'font-size:2.5rem;cursor:pointer;transition:all 0.2s;color:rgba(255,255,255,0.3);';
    star.onclick = function() {
      _selectedRating = parseInt(this.dataset.value);
      container.querySelectorAll('span').forEach(function(s) {
        s.textContent = parseInt(s.dataset.value) <= _selectedRating ? '★' : '☆';
        s.style.color = parseInt(s.dataset.value) <= _selectedRating ? '#fbbf24' : 'rgba(255,255,255,0.3)';
      });
    };
    container.appendChild(star);
  }
  var msg = document.getElementById('rate-msg');
  if (msg) msg.style.display = 'none';

  // Load existing app ratings
  _loadAppRatings();
}

async function _loadAppRatings() {
  var content = document.getElementById('rate-us-content');
  if (!content) return;

  var reviewsDiv = document.getElementById('rate-us-reviews');
  if (!reviewsDiv) {
    reviewsDiv = document.createElement('div');
    reviewsDiv.id = 'rate-us-reviews';
    reviewsDiv.style.cssText = 'margin-top:20px;max-width:500px;';
    content.appendChild(reviewsDiv);
  }
  reviewsDiv.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.82rem;padding:12px;"><i class="fas fa-spinner fa-spin"></i> Loading reviews...</div>';

  try {
    var res = await fetch(BASE_URL + '/api/feedback/lesson?lessonId=app_rating');
    var data = await res.json();
    if (!data.success || data.totalReviews === 0) {
      reviewsDiv.innerHTML = '<div class="card" style="text-align:center;padding:20px;color:var(--muted);font-size:0.85rem;">No reviews yet. Be the first to rate!</div>';
      return;
    }

    var html = '<div class="card" style="padding:20px;">';
    html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">';
    html += '<div style="text-align:center;"><div style="font-size:2.2rem;font-weight:800;color:#fbbf24;">' + data.avgRating + '</div><div style="font-size:0.72rem;color:var(--muted);">' + data.totalReviews + ' review' + (data.totalReviews > 1 ? 's' : '') + '</div></div>';
    html += '<div style="flex:1;">';
    for (var s = 5; s >= 1; s--) {
      var count = data.ratingCounts[s] || 0;
      var pct = data.totalReviews > 0 ? Math.round(count / data.totalReviews * 100) : 0;
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">';
      html += '<span style="font-size:0.7rem;color:var(--muted);width:14px;">' + s + '★</span>';
      html += '<div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:#fbbf24;border-radius:3px;"></div></div>';
      html += '<span style="font-size:0.68rem;color:var(--muted);width:20px;text-align:right;">' + count + '</span>';
      html += '</div>';
    }
    html += '</div></div>';

    // Show recent reviews
    if (data.reviews && data.reviews.length > 0) {
      html += '<div style="border-top:1px solid rgba(255,255,255,0.06);margin-top:14px;padding-top:14px;">';
      html += '<div style="font-weight:700;font-size:0.85rem;color:#fff;margin-bottom:10px;">Recent Reviews</div>';
      data.reviews.slice(0, 8).forEach(function(r) {
        var stars = '';
        for (var i = 1; i <= 5; i++) stars += i <= r.rating ? '★' : '☆';
        var date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        html += '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">';
        html += '<span style="font-size:0.8rem;font-weight:600;color:#fff;">' + sanitize(r.studentName) + '</span>';
        html += '<span style="font-size:0.7rem;color:var(--muted);">' + date + '</span></div>';
        html += '<div style="font-size:0.75rem;color:#fbbf24;margin-bottom:3px;">' + stars + '</div>';
        if (r.feedback) html += '<div style="font-size:0.78rem;color:rgba(255,255,255,0.6);">' + sanitize(r.feedback) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    reviewsDiv.innerHTML = html;
  } catch { reviewsDiv.innerHTML = ''; }
}

async function submitRating() {
  if (_selectedRating === 0) { alert('Please select a rating'); return; }
  var feedback = (document.getElementById('rate-feedback') || {}).value || '';
  var msg = document.getElementById('rate-msg');
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  try {
    var res = await fetch(BASE_URL + '/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ rating: _selectedRating, feedback: feedback, lessonId: 'app_rating', lessonTitle: 'App Rating' }),
    });
    var data = await res.json();
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = data.success ? '#22c55e' : '#ef4444';
      msg.textContent = data.success ? '🎉 Thank you for your feedback!' : '❌ ' + data.message;
    }
    if (data.success) _loadAppRatings();
  } catch { if (msg) { msg.style.display = 'block'; msg.style.color = '#ef4444'; msg.textContent = 'Network error'; } }
}

// ─── Help & Support ───────────────────────────────────────────────────────────

var _helpFaqs = [
  { q: 'How do I enroll in a course?', a: 'Go to Courses, click on any course and tap "Enroll Now".' },
  { q: 'How do I earn coins?', a: 'Complete quizzes and rank in the top 10 to earn coins automatically.' },
  { q: 'Can I download lessons for offline use?', a: 'Yes! Open any lesson and tap the Download button. Find them in Downloads.' },
  { q: 'How do I track my progress?', a: 'Visit My Report in the sidebar to see your full learning progress.' },
  { q: 'What are achievements?', a: 'Complete quizzes and rank #1–10 to earn Super Master, Master, or Pro badges.' },
];

function loadHelpPage() {
  var faqEl = document.getElementById('help-faq-list');
  if (!faqEl) return;
  faqEl.innerHTML = _helpFaqs.map(function(f, i) {
    return '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">' +
      '<div onclick="helpToggleFaq(' + i + ')" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);" id="help-faq-q-' + i + '">' +
      '<span style="font-size:0.85rem;font-weight:600;color:#fff;">' + sanitize(f.q) + '</span>' +
      '<i class="fas fa-chevron-down" style="color:var(--muted);font-size:0.75rem;transition:transform 0.2s;" id="help-faq-icon-' + i + '"></i>' +
      '</div>' +
      '<div id="help-faq-a-' + i + '" style="display:none;padding:10px 14px;font-size:0.82rem;color:rgba(255,255,255,0.7);line-height:1.6;background:rgba(255,255,255,0.01);border-top:1px solid rgba(255,255,255,0.04);">' + sanitize(f.a) + '</div>' +
      '</div>';
  }).join('');
}

function helpToggleFaq(i) {
  var ans = document.getElementById('help-faq-a-' + i);
  var icon = document.getElementById('help-faq-icon-' + i);
  if (!ans) return;
  var open = ans.style.display === 'block';
  ans.style.display = open ? 'none' : 'block';
  if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
}

function helpOpenWhatsApp() {
  var msg = 'Hi CodingKida Support! I need help with the app.';
  var url = 'https://wa.me/919999999999?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

function helpOpenEmail() {
  _showShareModal('To: support@codingkida.com\nSubject: Help Request\n\nHi CodingKida Support,\n\nI need help with:\n\n[Describe your issue here]\n\nThank you');
}

// ─── Refer & Earn ─────────────────────────────────────────────────────────────
// Referral code = first 6 chars of userId uppercased + "CK"
// Stored in localStorage: ck_referral_<userId> = { code, referredCount, coinsEarned }

function _getReferralData() {
  var userId = getCurrentUserId();
  if (!userId) return null;
  var key = 'ck_referral_' + userId;
  var stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  // Generate code from userId
  var code = (userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'USER') + 'CK';
  var data = { code: code, referredCount: 0, coinsEarned: 0 };
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}

function loadReferralPage() {
  var data = _getReferralData();
  if (!data) return;
  var codeEl = document.getElementById('referral-code-display');
  var countEl = document.getElementById('referral-count');
  var coinsEl = document.getElementById('referral-coins-earned');
  if (codeEl) codeEl.textContent = data.code;
  if (countEl) countEl.textContent = data.referredCount;
  if (coinsEl) coinsEl.textContent = data.coinsEarned;
}

function referralCopyCode() {
  var data = _getReferralData();
  if (!data) return;
  var ta = document.createElement('textarea');
  ta.value = data.code;
  ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    _showReferralToast('✅ Code ' + data.code + ' copied!');
  } catch {}
  document.body.removeChild(ta);
}

function referralShareWhatsApp() {
  var data = _getReferralData();
  if (!data) return;
  var studentName = document.getElementById('sidebar-user-name')?.textContent || 'My friend';
  var msg = '🎓 Hey! ' + studentName + ' invited you to join CodingKida — India\'s best coding platform for kids!\n\n' +
    '✅ Learn Java, Python, Web Dev & more\n' +
    '🏆 Earn badges & certificates\n' +
    '🤖 24/7 AI mentor\n\n' +
    '👉 Use my referral code: *' + data.code + '*\n' +
    'Download: https://codingkida.com';
  var url = 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
}

function _showReferralToast(msg) {
  var toast = document.getElementById('referral-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'referral-toast';
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1e1e2e;border:1px solid rgba(245,158,11,0.4);color:#fbbf24;padding:12px 24px;border-radius:12px;font-size:0.88rem;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.4);transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function() { toast.style.opacity = '0'; }, 3000);
}

// ── Share report ─────────────────────────────────────────────────────────────

function _buildReportText() {
  const d = window._prReportData;
  if (!d) return null;
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const courseLines = (d.enrolledCourses || []).map(function(c) {
    return '  • ' + c.title + ' — ' + (c.progressPercent || 0) + '% (' + (c.completedLessons || 0) + ' lessons done)';
  }).join('\n') || '  No courses yet';
  const badgeLines = [
    d.superMasterCount > 0 ? '  🏆 Super Master x' + d.superMasterCount : '',
    d.masterCount > 0      ? '  🥈 Master x' + d.masterCount : '',
    d.proCount > 0         ? '  ⭐ Pro x' + d.proCount : '',
  ].filter(Boolean).join('\n') || '  None yet';
  const att = d.att || {};

  return '📊 CodingKida Learning Report\n' +
    'Student: ' + d.studentName + '\n' +
    'Date: ' + date + '\n\n' +
    '⏱ Attendance\n' +
    '  Today: ' + _fmtMins(att.todayMins || 0) + '\n' +
    '  This Week: ' + _fmtMins(att.weekMins || 0) + '\n' +
    '  Active Days (30d): ' + (att.activeDays || 0) + '/30\n\n' +
    '📚 Courses Enrolled: ' + d.totalEnrolled + '\n' +
    '✅ Lessons Completed: ' + d.totalCompleted + '\n' +
    '🎓 Certificates: ' + d.certCount + '\n' +
    '🔥 Weekly Streak: ' + d.streakCount + '\n' +
    '🪙 Coins Earned: ' + d.totalCoins + '\n\n' +
    '📈 Course Progress:\n' + courseLines + '\n\n' +
    '🏆 Achievements:\n' + badgeLines + '\n\n' +
    'Powered by CodingKida — codingkida.com';
}

function shareReportWhatsApp() {
  const text = _buildReportText();
  if (!text) { alert('Please wait for the report to load first.'); return; }
  // window.open works in Electron — opens WhatsApp Web in a new window
  const url = 'https://wa.me/?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

function shareReportEmail() {
  const text = _buildReportText();
  if (!text) { alert('Please wait for the report to load first.'); return; }
  // Show share modal with text ready to copy — mailto doesn't work in WSL Electron
  _showShareModal(text);
}

function _showShareModal(text) {
  var existing = document.getElementById('pr-share-modal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'pr-share-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML =
    '<div style="background:#1a1a2e;border:1px solid rgba(108,71,255,0.3);border-radius:20px;padding:28px;width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;gap:16px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
    '<div style="font-size:1rem;font-weight:700;color:#fff;">📊 Share Learning Report</div>' +
    '<button onclick="document.getElementById(\'pr-share-modal\').remove()" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.2rem;cursor:pointer;">✕</button>' +
    '</div>' +
    '<p style="font-size:0.82rem;color:var(--muted);margin:0;">Copy the report below and paste it in WhatsApp, Gmail, or any app.</p>' +
    '<textarea id="pr-share-text" readonly style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px;color:rgba(255,255,255,0.85);font-size:0.78rem;line-height:1.6;resize:none;height:220px;font-family:monospace;outline:none;">' + text.replace(/</g,'&lt;') + '</textarea>' +
    '<button onclick="_copyShareText()" id="pr-copy-btn" style="background:linear-gradient(135deg,#6c47ff,#ec4899);border:none;border-radius:10px;padding:12px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;">📋 Copy Report</button>' +
    '</div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

function _copyShareText() {
  var ta = document.getElementById('pr-share-text');
  if (!ta) return;
  ta.select();
  try {
    document.execCommand('copy');
    var btn = document.getElementById('pr-copy-btn');
    if (btn) { btn.textContent = '✅ Copied! Paste in WhatsApp or Gmail'; btn.style.background = 'linear-gradient(135deg,#10b981,#059669)'; }
    setTimeout(function() {
      var b = document.getElementById('pr-copy-btn');
      if (b) { b.textContent = '📋 Copy Report'; b.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)'; }
    }, 3000);
  } catch {}
}

// Open URL — uses the same pattern as the rest of the app
function _openUrl(url) {
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.invoke('open-external', url).catch(function() {
      window.open(url, '_blank');
    });
  } else {
    window.open(url, '_blank');
  }
}

function _showShareToast(msg) {
  var toast = document.getElementById('pr-share-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'pr-share-toast';
    toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1e1e2e;border:1px solid rgba(108,71,255,0.4);color:#fff;padding:12px 24px;border-radius:12px;font-size:0.88rem;font-weight:600;z-index:9999;box-shadow:0 8px 30px rgba(0,0,0,0.4);transition:opacity 0.3s;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(function() { toast.style.opacity = '0'; }, 3000);
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



// ─── Coins & Leaderboard System ──────────────────────────────────────────────

var _quizStartTime = null;
var _userCoinsCache = 0;

// Load user coins from server and update widget
async function loadUserCoins() {
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;
  try {
    const res = await fetch(BASE_URL + '/api/coins', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success) {
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

// Call initialization when navigate to dashboard
document.addEventListener('DOMContentLoaded', _initWelcomeCoinsBadge);
setTimeout(_initWelcomeCoinsBadge, 1000); // Fallback after 1s

async function _loadCoinsPopupData() {
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;
  try {
    const res = await fetch(BASE_URL + '/api/coins', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success) {
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
  } catch {}
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


// ─── Homework Tab (Lazy Load) ────────────────────────────────────────────────

async function _lazyLoadHomework(lessonId, token) {
  const el = document.getElementById('vp-homework');
  if (!el) return;
  el.innerHTML = '<div class="tab-card" style="text-align:center;padding:30px;"><div class="skeleton-shimmer" style="width:60%;height:16px;margin:0 auto 12px;"></div><div class="skeleton-shimmer" style="width:80%;height:12px;margin:0 auto 8px;"></div></div>';
  try {
    const res = await fetch(BASE_URL + '/api/homework?lessonId=' + lessonId, {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    const data = await res.json();
    if (data.success && data.homeworks && data.homeworks.length > 0) {
      renderHomeworkTab(data.homeworks);
    } else {
      renderHomeworkTab(null);
    }
  } catch { renderHomeworkTab(null); }
}

function renderHomeworkTab(homeworks) {
  const el = document.getElementById('vp-homework');
  if (!el) return;
  let html = '<div class="tab-card">';
  html += '<div class="tab-card-title"><i class="fas fa-pencil-alt"></i> Homework (Practice)</div>';

  if (!homeworks || homeworks.length === 0) {
    html += '<div style="text-align:center;padding:30px 20px;">';
    html += '<i class="fas fa-book-reader" style="font-size:2.5rem;color:rgba(255,255,255,0.15);margin-bottom:12px;display:block;"></i>';
    html += '<p style="color:var(--muted);font-size:0.9rem;">No homework for this lesson yet.</p>';
    html += '</div>';
    html += '</div>';
    el.innerHTML = html;
    return;
  }

  homeworks.forEach(function(hw, i) {
    const diffColor = hw.difficulty === 'easy' ? '#22c55e' : hw.difficulty === 'hard' ? '#ef4444' : '#f59e0b';
    html += '<div style="margin-bottom:16px;padding:16px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    html += '<span style="font-size:0.85rem;font-weight:700;color:#fff;">Q' + (i + 1) + '. ' + sanitize(hw.title) + '</span>';
    html += '<span style="font-size:0.7rem;font-weight:600;color:' + diffColor + ';background:' + diffColor + '15;padding:3px 8px;border-radius:6px;text-transform:capitalize;">' + hw.difficulty + '</span>';
    html += '</div>';
    html += '<p style="color:rgba(255,255,255,0.75);font-size:0.88rem;line-height:1.7;">' + sanitize(hw.description) + '</p>';
    html += '</div>';
  });

  html += '<p style="color:var(--muted);font-size:0.75rem;text-align:center;margin-top:12px;"><i class="fas fa-info-circle"></i> Practice problems — no submission required</p>';
  html += '</div>';
  el.innerHTML = html;
}

// ─── Lesson Rating Tab ────────────────────────────────────────────────────────

var _lessonRating = 0;

function _initLessonRateTab() {
  _lessonRating = 0;
  var container = document.getElementById('vp-rate-stars');
  if (!container) return;
  container.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('span');
    star.textContent = '☆';
    star.dataset.value = i;
    star.style.cssText = 'font-size:2.2rem;cursor:pointer;transition:all 0.2s;color:rgba(255,255,255,0.3);';
    star.onclick = function() {
      _lessonRating = parseInt(this.dataset.value);
      container.querySelectorAll('span').forEach(function(s) {
        s.textContent = parseInt(s.dataset.value) <= _lessonRating ? '★' : '☆';
        s.style.color = parseInt(s.dataset.value) <= _lessonRating ? '#fbbf24' : 'rgba(255,255,255,0.3)';
      });
    };
    container.appendChild(star);
  }
  var msg = document.getElementById('vp-rate-msg');
  if (msg) msg.style.display = 'none';
  var fb = document.getElementById('vp-rate-feedback');
  if (fb) fb.value = '';

  // Load existing reviews for this lesson
  _loadLessonReviews();
}

async function _loadLessonReviews() {
  var lessonId = _currentVideoData ? _currentVideoData.lessonId : null;
  if (!lessonId) return;

  var panel = document.getElementById('vp-rate');
  if (!panel) return;

  // Find or create reviews container
  var reviewsDiv = document.getElementById('vp-rate-reviews');
  if (!reviewsDiv) {
    reviewsDiv = document.createElement('div');
    reviewsDiv.id = 'vp-rate-reviews';
    reviewsDiv.style.cssText = 'margin-top:16px;';
    panel.querySelector('.tab-card').appendChild(reviewsDiv);
  }
  reviewsDiv.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.82rem;padding:12px;"><i class="fas fa-spinner fa-spin"></i> Loading reviews...</div>';

  try {
    var res = await fetch(BASE_URL + '/api/feedback/lesson?lessonId=' + lessonId);
    var data = await res.json();
    if (!data.success) { reviewsDiv.innerHTML = ''; return; }

    var html = '';

    // Rating summary
    if (data.totalReviews > 0) {
      html += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;margin-top:16px;">';
      html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">';
      html += '<div style="text-align:center;"><div style="font-size:2rem;font-weight:800;color:#fbbf24;">' + data.avgRating + '</div><div style="font-size:0.72rem;color:var(--muted);">' + data.totalReviews + ' review' + (data.totalReviews > 1 ? 's' : '') + '</div></div>';
      html += '<div style="flex:1;">';
      for (var s = 5; s >= 1; s--) {
        var count = data.ratingCounts[s] || 0;
        var pct = data.totalReviews > 0 ? Math.round(count / data.totalReviews * 100) : 0;
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">';
        html += '<span style="font-size:0.7rem;color:var(--muted);width:14px;">' + s + '★</span>';
        html += '<div style="flex:1;height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:#fbbf24;border-radius:3px;"></div></div>';
        html += '<span style="font-size:0.68rem;color:var(--muted);width:20px;text-align:right;">' + count + '</span>';
        html += '</div>';
      }
      html += '</div></div>';

      // Reviews list
      html += '<div style="font-weight:700;font-size:0.88rem;color:#fff;margin-bottom:10px;">Student Reviews</div>';
      data.reviews.slice(0, 10).forEach(function(r) {
        var stars = '';
        for (var i = 1; i <= 5; i++) stars += i <= r.rating ? '★' : '☆';
        var date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        html += '<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-size:0.82rem;font-weight:600;color:#fff;">' + sanitize(r.studentName) + '</span>';
        html += '<span style="font-size:0.72rem;color:var(--muted);">' + date + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.78rem;color:#fbbf24;margin-bottom:4px;">' + stars + '</div>';
        if (r.feedback) html += '<div style="font-size:0.8rem;color:rgba(255,255,255,0.6);line-height:1.5;">' + sanitize(r.feedback) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px 0;text-align:center;color:var(--muted);font-size:0.82rem;">No reviews yet. Be the first to rate!</div>';
    }

    reviewsDiv.innerHTML = html;
  } catch { reviewsDiv.innerHTML = ''; }
}

async function submitLessonRating() {
  if (_lessonRating === 0) { alert('Please select a star rating'); return; }
  var feedback = (document.getElementById('vp-rate-feedback') || {}).value || '';
  var msg = document.getElementById('vp-rate-msg');
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  var lessonId = _currentVideoData ? _currentVideoData.lessonId : null;
  var lessonTitle = _currentVideoData ? _currentVideoData.title : '';

  try {
    var res = await fetch(BASE_URL + '/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ rating: _lessonRating, feedback: feedback, lessonId: lessonId, lessonTitle: lessonTitle }),
    });
    var data = await res.json();
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = data.success ? '#22c55e' : '#ef4444';
      msg.textContent = data.success ? '🎉 Thank you! Your rating has been submitted.' : '❌ ' + (data.message || 'Failed');
    }
  } catch { if (msg) { msg.style.display = 'block'; msg.style.color = '#ef4444'; msg.textContent = 'Network error'; } }
}

// ─── Achievements Page ───────────────────────────────────────────────────────

async function showAchievements() {
  navigate('achievements');
  const container = document.getElementById('achievements-list');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted)">Loading achievements...</p>';

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    container.innerHTML = '<p style="color:var(--muted)">Please log in to view achievements.</p>';
    return;
  }

  try {
    const res = await fetch(BASE_URL + '/api/achievements', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success && data.achievements && data.achievements.length > 0) {
      container.innerHTML = data.achievements.map(function(a) {
        const badgeIcon = a.badgeType === 'super-master' ? '🏆' : a.badgeType === 'master' ? '🥈' : '⭐';
        const badgeColor = a.badgeType === 'super-master' ? '#fbbf24' : a.badgeType === 'master' ? '#a78bfa' : '#22c55e';
        const date = new Date(a.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;position:relative;overflow:hidden;">' +
          '<div style="position:absolute;top:0;right:0;width:100px;height:100px;background:radial-gradient(circle,' + badgeColor + '20,transparent);border-radius:50%;filter:blur(20px);"></div>' +
          '<div style="display:flex;align-items:flex-start;gap:16px;">' +
          '<div style="width:50px;height:50px;border-radius:14px;background:' + badgeColor + '20;border:1px solid ' + badgeColor + '40;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">' + badgeIcon + '</div>' +
          '<div style="flex:1;">' +
          '<div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:4px;">' + sanitize(a.title) + ' Certificate</div>' +
          '<div style="font-size:0.82rem;color:var(--muted);margin-bottom:8px;">' + sanitize(a.lessonTitle) + ' · ' + sanitize(a.courseTitle) + '</div>' +
          '<div style="font-size:0.8rem;color:rgba(255,255,255,0.6);line-height:1.6;">' +
          'Score: <strong style="color:#4ade80;">' + a.score + '%</strong> · Rank: <strong style="color:' + badgeColor + ';">#' + a.rank + '</strong><br/>' +
          'Awarded to: <strong style="color:#fff;">' + sanitize(a.studentName) + '</strong><br/>' +
          'Instructor: ' + sanitize(a.instructor) + '<br/>' +
          'Issued by: CodingKida Team · ' + date +
          '</div>' +
          '</div>' +
          '</div>' +
          '</div>';
      }).join('');
    } else {
      container.innerHTML = '<div style="text-align:center;padding:40px;"><i class="fas fa-trophy" style="font-size:2.5rem;color:var(--muted);margin-bottom:12px;display:block;"></i><p style="color:var(--muted);font-size:0.9rem;">No achievements yet. Complete quizzes and rank in top 10 to earn certificates!</p></div>';
    }
  } catch {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load achievements.</p>';
  }
}

// ─── Student Progress Feature ──────────────────────────────────────────────

async function loadStudentProgress() {
  var loading = document.getElementById('student-progress-loading');
  var content = document.getElementById('student-progress-content');
  if (!loading || !content) return;

  loading.style.display = 'block';
  content.style.display = 'none';

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    loading.innerHTML = '<p style="color:var(--muted)">Please log in to view progress.</p>';
    return;
  }

  try {
    var res = await fetch(BASE_URL + '/api/student/progress', {
      headers: { Authorization: 'Bearer ' + token },
    });
    var data = await res.json();
    if (!data.success) throw new Error(data.message || 'Failed to load progress.');

    loading.style.display = 'none';
    content.style.display = 'block';
    _renderStudentProgress(data);
  } catch (err) {
    loading.innerHTML = '<div style="text-align:center;padding:40px;">' +
      '<i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--danger);margin-bottom:12px;display:block;"></i>' +
      '<p style="color:var(--muted)">' + sanitize(err.message || 'Failed to load progress.') + '</p>' +
      '<button class="btn btn-outline btn-sm" onclick="loadStudentProgress()" style="margin-top:12px;">Retry</button></div>';
  }
}

function _renderStars(rating) {
  var html = '';
  for (var i = 1; i <= 5; i++) {
    html += '<i class="fas fa-star" style="color:' + (i <= rating ? '#fbbf24' : 'rgba(255,255,255,0.15)') + ';font-size:1.2rem;"></i>';
  }
  return html;
}

function _renderStudentProgress(data) {
  var content = document.getElementById('student-progress-content');
  if (!content) return;

  // Overall Rating Card
  var overallHtml = '<div style="background:linear-gradient(135deg,rgba(108,71,255,0.15),rgba(236,72,153,0.1));border:1px solid rgba(108,71,255,0.3);border-radius:20px;padding:28px;margin-bottom:24px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">' +
    '<div>' +
    '<div style="font-size:0.8rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Overall Student Rating</div>' +
    '<div style="display:flex;align-items:center;gap:8px;">' + _renderStars(data.overallRating) + '<span style="font-size:1.8rem;font-weight:800;color:#fff;margin-left:8px;">' + data.overallRating + '/5</span></div>' +
    '<div style="font-size:0.78rem;color:var(--muted);margin-top:6px;">Based on quiz accuracy (70%) + exercise completion (30%) · Score: ' + data.overallScore + '%</div>' +
    '</div>' +
    '<div style="display:flex;gap:12px;">' +
    '<div style="text-align:center;padding:12px 16px;background:rgba(255,255,255,0.05);border-radius:12px;cursor:pointer;" onclick="document.getElementById(\'sp-rating-detail\').style.display=document.getElementById(\'sp-rating-detail\').style.display===\'none\'?\'block\':\'none\'">' +
    '<div style="font-size:1.3rem;font-weight:800;color:#fff;">' + data.totalLessonsCompleted + '/' + data.totalLessons + '</div>' +
    '<div style="font-size:0.7rem;color:var(--muted);">Lessons Done</div></div>' +
    '<div style="text-align:center;padding:12px 16px;background:rgba(255,255,255,0.05);border-radius:12px;">' +
    '<div style="font-size:1.3rem;font-weight:800;color:#fff;">' + data.courses.length + '</div>' +
    '<div style="font-size:0.7rem;color:var(--muted);">Courses</div></div>' +
    '</div></div>' +
    // Rating breakdown (click to expand)
    '<div id="sp-rating-detail" style="display:none;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    // Quiz rating
    '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><i class="fas fa-brain" style="color:#a78bfa;"></i><span style="font-weight:700;color:#fff;font-size:0.9rem;">Quiz Rating</span></div>' +
    '<div style="margin-bottom:8px;">' + _renderStars(data.ratingBreakdown.quiz.rating) + ' <span style="color:#fff;font-weight:700;">' + data.ratingBreakdown.quiz.rating + '/5</span></div>' +
    '<div style="font-size:0.78rem;color:var(--muted);line-height:1.8;">' +
    'Accuracy: <strong style="color:#4ade80;">' + data.ratingBreakdown.quiz.accuracy + '%</strong><br/>' +
    'Total Quizzes: ' + data.ratingBreakdown.quiz.totalQuizzes + '<br/>' +
    'Attempted: ' + data.ratingBreakdown.quiz.attempted + '<br/>' +
    'Correct: ' + data.ratingBreakdown.quiz.correct +
    '</div></div>' +
    // Exercise rating
    '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:16px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><i class="fas fa-code" style="color:#22c55e;"></i><span style="font-weight:700;color:#fff;font-size:0.9rem;">Exercise Rating</span></div>' +
    '<div style="margin-bottom:8px;">' + _renderStars(data.ratingBreakdown.exercise.rating) + ' <span style="color:#fff;font-weight:700;">' + data.ratingBreakdown.exercise.rating + '/5</span></div>' +
    '<div style="font-size:0.78rem;color:var(--muted);line-height:1.8;">' +
    'Pass Rate: <strong style="color:#4ade80;">' + data.ratingBreakdown.exercise.passRate + '%</strong><br/>' +
    'Total Exercises: ' + data.ratingBreakdown.exercise.totalExercises + '<br/>' +
    'Attempted: ' + data.ratingBreakdown.exercise.attempted + '<br/>' +
    'Passed: ' + data.ratingBreakdown.exercise.passed +
    '</div></div>' +
    '</div></div>' +
    '</div>';

  // Per-course progress
  var coursesHtml = '';
  data.courses.forEach(function(course) {
    coursesHtml += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;margin-bottom:16px;overflow:hidden;">' +
      // Course header
      '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'.sp-chevron\').classList.toggle(\'fa-chevron-down\');this.querySelector(\'.sp-chevron\').classList.toggle(\'fa-chevron-up\')" style="padding:18px 20px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:14px;">' +
      '<div style="width:42px;height:42px;border-radius:12px;background:' + (course.color || 'linear-gradient(135deg,#6c47ff,#ec4899)') + ';display:flex;align-items:center;justify-content:center;"><i class="' + (course.icon || 'fas fa-book') + '" style="color:#fff;font-size:1rem;"></i></div>' +
      '<div><div style="font-size:1rem;font-weight:700;color:#fff;">' + sanitize(course.title) + '</div>' +
      '<div style="font-size:0.75rem;color:var(--muted);">' + course.lessonsCompleted + '/' + course.totalLessons + ' lessons · Quiz: ' + course.quiz.accuracy + '% · Progress: ' + course.progressPercent + '%</div></div></div>' +
      '<i class="fas fa-chevron-down sp-chevron" style="color:var(--muted);font-size:0.8rem;"></i>' +
      '</div>' +
      // Course content (modules + lessons) - collapsed by default
      '<div style="display:none;padding:0 20px 20px;">';

    // Course quiz/exercise summary
    coursesHtml += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">' +
      '<div style="background:rgba(108,71,255,0.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:#fff;">' + course.quiz.attempted + '/' + course.quiz.total + '</div><div style="font-size:0.68rem;color:var(--muted);">Quizzes Done</div></div>' +
      '<div style="background:rgba(34,197,94,0.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:#fff;">' + course.exercise.passed + '/' + course.exercise.total + '</div><div style="font-size:0.68rem;color:var(--muted);">Exercises Passed</div></div>' +
      '<div style="background:rgba(245,158,11,0.1);border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.1rem;font-weight:800;color:#fff;">' + course.quiz.accuracy + '%</div><div style="font-size:0.68rem;color:var(--muted);">Quiz Accuracy</div></div>' +
      '</div>';

    // Modules
    course.modules.forEach(function(mod) {
      coursesHtml += '<div style="margin-bottom:12px;">' +
        '<div style="font-size:0.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding-left:4px;">' + sanitize(mod.title) + '</div>';

      // Lessons
      mod.lessons.forEach(function(lesson) {
        var quizBadge = lesson.quiz.total > 0
          ? '<span style="font-size:0.68rem;padding:2px 8px;border-radius:6px;background:' + (lesson.quiz.accuracy !== null && lesson.quiz.accuracy >= 70 ? 'rgba(34,197,94,0.15);color:#4ade80' : 'rgba(245,158,11,0.15);color:#fbbf24') + ';">Quiz: ' + (lesson.quiz.accuracy !== null ? lesson.quiz.accuracy + '%' : 'Not taken') + '</span>'
          : '';
        var exerciseBadge = lesson.exercise.total > 0
          ? '<span style="font-size:0.68rem;padding:2px 8px;border-radius:6px;background:' + (lesson.exercise.passed > 0 ? 'rgba(34,197,94,0.15);color:#4ade80' : 'rgba(239,68,68,0.15);color:#f87171') + ';">Ex: ' + lesson.exercise.passed + '/' + lesson.exercise.total + '</span>'
          : '';
        var achieveBadge = lesson.achievements.length > 0
          ? lesson.achievements.map(function(a) { return '<span style="font-size:0.68rem;padding:2px 8px;border-radius:6px;background:rgba(251,191,36,0.15);color:#fbbf24;">' + (a.badgeType === 'super-master' ? '🏆' : a.badgeType === 'master' ? '🥈' : '⭐') + '</span>'; }).join('')
          : '';
        var hwBadge = lesson.homeworkCount > 0
          ? '<span style="font-size:0.68rem;padding:2px 8px;border-radius:6px;background:rgba(236,72,153,0.15);color:#ec4899;">HW: ' + lesson.homeworkCount + '</span>'
          : '';

        coursesHtml += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:10px;margin-bottom:6px;">' +
          '<i class="fas ' + (lesson.completed ? 'fa-check-circle' : 'fa-circle') + '" style="color:' + (lesson.completed ? '#22c55e' : 'rgba(255,255,255,0.2)') + ';font-size:0.8rem;flex-shrink:0;"></i>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:0.82rem;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sanitize(lesson.title) + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">' + quizBadge + exerciseBadge + hwBadge + achieveBadge + '</div>' +
          '</div>' +
          '<span style="font-size:0.7rem;color:var(--muted);flex-shrink:0;">' + (lesson.duration || '') + '</span>' +
          '</div>';
      });

      coursesHtml += '</div>';
    });

    coursesHtml += '</div></div>';
  });

  if (data.courses.length === 0) {
    coursesHtml = '<div style="text-align:center;padding:40px;"><i class="fas fa-book-open" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block;"></i><p style="color:var(--muted);">No enrolled courses yet. Start learning to see your progress!</p></div>';
  }

  content.innerHTML = overallHtml + '<div style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:16px;">Course-wise Progress</div>' + coursesHtml;
}
