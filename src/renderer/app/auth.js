/**
 * CodingKida Desktop — Authentication
 * Login, signup, student data loading, and dashboard data application.
 */

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
    // Detect user change and handle cache
    var newUserId = (data.user && (data.user.id || data.user.userId)) || '';
    if (newUserId) _ckCacheDetectUserChange(newUserId);
    await loadStudentData();
    _attendanceRecordLogin();
    // Pre-fetch all endpoints for instant subsequent loads
    _ckCachePreFetchAll();
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
    // Detect user change and handle cache
    var newUserId = (data.user && (data.user.id || data.user.userId)) || '';
    if (newUserId) _ckCacheDetectUserChange(newUserId);
    await loadStudentData();
    _attendanceRecordLogin();
    // Pre-fetch all endpoints for instant subsequent loads
    _ckCachePreFetchAll();
    navigate('dashboard');
  } catch (err) {
    showAuthError('signup', err.message || 'Signup failed. Try again.');
  } finally {
    setButtonLoading('signup-btn', false, 'Create Free Account');
  }
}

async function loadStudentData() {
  try {
    // Cache-first: use cached profile for instant UI, refresh in background
    var cachedProfile = ckCacheGet('/api/student');
    const data = cachedProfile || await StudentAPI.getProfile();
    // Store in cache if freshly fetched
    if (!cachedProfile && data) ckCacheSet('/api/student', data);
    // Background refresh if we used cached data
    if (cachedProfile) {
      StudentAPI.getProfile().then(function(freshData) {
        if (freshData) ckCacheSet('/api/student', freshData);
      }).catch(function() {});
    }
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
  // Pre-fetch coding problems so Code Editor opens instantly (no loading spinner)
  _preloadCodingProblems();
}

/**
 * Pre-fetch coding problems in background after login.
 * Stores result in localStorage so codingPgLoadProblems() can use it instantly.
 * Uses persistent cache for instant load on re-login.
 */
function _preloadCodingProblems() {
  // Check persistent cache first — if available, store in session cache for instant use
  var cached = ckCacheGet('/api/coding-problems');
  if (cached && cached.success && cached.problems && cached.problems.length > 0) {
    try { localStorage.setItem('ck_coding_problems_cache', JSON.stringify(cached)); } catch(e) {}
  }
  // Always do background refresh
  fetch(BASE_URL + '/api/coding-problems')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        ckCacheSet('/api/coding-problems', data);
        try { localStorage.setItem('ck_coding_problems_cache', JSON.stringify(data)); } catch(e) {}
      }
    })
    .catch(function() { /* silent — coding page will fetch on its own if this fails */ });
}

// Apply cached dashboard data instantly (no shimmer flash)
function _applyCachedDashboard() {
  const userId = getCurrentUserId();
  const cacheKey = 'ck_dashboard_cache_' + userId;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      _applyDashboardData(data, true);
      return;
    } catch {}
  }
  // Fallback: try persistent 7-day cache
  var pcached = ckCacheGet('/api/student/dashboard');
  if (pcached) {
    _applyDashboardData(pcached, true);
  }
}

async function _applyDashboardData(data, isFromCache) {
    if (!data.success) return;

    // Save to localStorage cache for instant load next time
    if (!isFromCache) {
      const userId = getCurrentUserId();
      const cacheKey = 'ck_dashboard_cache_' + userId;
      try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      // Also save to persistent 7-day cache
      ckCacheSet('/api/student/dashboard', data);
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

    // Achievements count — from cached /api/achievements data
    var achCached = ckCacheGet('/api/achievements');
    var achCount = (achCached && achCached.success && achCached.achievements) ? achCached.achievements.length : 0;
    if (certEl) certEl.innerHTML = String(achCount);

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
