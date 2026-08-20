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

    const topbarProfileInitial = document.getElementById('topbar-profile-initial');
    if (topbarProfileInitial) topbarProfileInitial.textContent = initial;

    const dashWelcome = document.getElementById('dashboard-welcome-name');
    if (dashWelcome) dashWelcome.textContent = name;

    const dashGreeting = document.getElementById('dashboard-greeting');
    // Greeting is now static "Hey [name]!" — no JS update needed

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

    // Profile hero quick stats — from existing cached dashboard data
    var profileStatCourses = document.getElementById('profile-stat-courses');
    var profileStatAch = document.getElementById('profile-stat-achievements');
    var profileStatStreak = document.getElementById('profile-stat-streak');
    var dashCacheForProfile = ckCacheGet('/api/student/dashboard') || JSON.parse(localStorage.getItem('ck_dashboard_cache_' + userId) || 'null');
    if (profileStatCourses) profileStatCourses.textContent = String((dashCacheForProfile && dashCacheForProfile.enrolledCount) || 0);
    var achCachedForProfile = ckCacheGet('/api/achievements');
    if (profileStatAch) profileStatAch.textContent = String((achCachedForProfile && achCachedForProfile.success && achCachedForProfile.achievements) ? achCachedForProfile.achievements.length : 0);
    var streakElForProfile = document.getElementById('stat-streak');
    if (profileStatStreak) profileStatStreak.textContent = streakElForProfile ? streakElForProfile.textContent : '0';

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
            const topbarProfileImg = document.getElementById('topbar-profile-avatar-img');
            const topbarProfileText = document.getElementById('topbar-profile-initial');
            if (topbarProfileImg) { topbarProfileImg.src = avatarData.avatarUrl; topbarProfileImg.style.display = 'block'; }
            if (topbarProfileText) topbarProfileText.style.display = 'none';
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
    // Update enrolled subtext
    var enrolledSubtext = document.getElementById('stat-enrolled-subtext');
    if (enrolledSubtext) {
      var count = data.enrolledCount || 0;
      enrolledSubtext.textContent = count === 0 ? 'No courses yet' : count + ' course' + (count > 1 ? 's' : '') + ' enrolled';
    }
    // Videos completed — use backend's pre-computed total (includes free videos)
    const enrolledCompletedCount = data.completedVideos || (data.enrolledCourses || []).reduce((sum, c) => sum + (c.completedLessons || 0), 0);
    if (completedEl) completedEl.innerHTML = String(enrolledCompletedCount);

    // Achievements count — from cached /api/achievements data
    var achCached = ckCacheGet('/api/achievements');
    var achCount = (achCached && achCached.success && achCached.achievements) ? achCached.achievements.length : 0;
    if (certEl) certEl.innerHTML = String(achCount);
    var topbarAchEl = document.getElementById('topbar-achievements-count');
    if (topbarAchEl) topbarAchEl.textContent = String(achCount);

    // Zero-state toggle for first 3 cards (not streak)
    var enrolledCard = document.querySelector('[data-card="enrolled"]');
    var videosCard = document.querySelector('[data-card="videos"]');
    var achievementsCard = document.querySelector('[data-card="achievements"]');
    var eCount = data.enrolledCount || 0;
    if (enrolledCard) {
      if (eCount === 0) {
        enrolledCard.classList.add('is-zero');
        if (enrolledSubtext) enrolledSubtext.textContent = 'Unlock your 1st Quest! \uD83D\uDE80';
      } else {
        enrolledCard.classList.remove('is-zero');
        if (enrolledSubtext) enrolledSubtext.textContent = eCount + ' course' + (eCount > 1 ? 's' : '') + ' enrolled';
      }
    }
    if (videosCard) {
      if (enrolledCompletedCount === 0) { videosCard.classList.add('is-zero'); }
      else { videosCard.classList.remove('is-zero'); }
    }
    if (achievementsCard) {
      if (achCount === 0) { achievementsCard.classList.add('is-zero'); }
      else { achievementsCard.classList.remove('is-zero'); }
    }

    // Weekly streak count — fetched separately (not in polling)
    // Streak is loaded once on dashboard navigate, not every 5s
    if (streakEl && !streakEl.dataset.loaded) {
      streakEl.innerHTML = '0';
      // Apply zero-state to streak card
      var streakCard = document.querySelector('[data-card="streak"]');
      if (streakCard) streakCard.classList.add('is-zero');
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
      // Try to get more accurate progress from enrolledCourses if available
      var matchedCourseForProgress = (data.enrolledCourses || []).find(function(c) { return c.id === lw.courseId; });
      var actualProgress = matchedCourseForProgress
        ? matchedCourseForProgress.progressPercent
        : progress;
      if (cFill) cFill.style.width = actualProgress + '%';

      // Progress text — gamified motivational
      if (cText) {
        if (progress === 0)        cText.textContent = '\uD83D\uDE80 Ready to start!';
        else if (progress === 100) cText.textContent = '\uD83C\uDFC6 Quest Complete!';
        else if (progress < 30)    cText.textContent = '\u26A1 Just started \u00b7 ' + progress + '%';
        else if (progress < 70)    cText.textContent = '\u26A1 Halfway there! ' + progress + '%';
        else                       cText.textContent = '\uD83D\uDD25 Almost done! ' + progress + '%';
      }

      // Lessons count — from enrolledCourses (matching by courseId)
      var lessonsCountEl = document.getElementById('continue-lessons-count');
      if (lessonsCountEl && lw.courseId && data.enrolledCourses) {
        var matchedCourse = data.enrolledCourses.find(function(c) { return c.id === lw.courseId; });
        if (matchedCourse && matchedCourse.totalLessons > 0) {
          lessonsCountEl.textContent = matchedCourse.completedLessons + ' of ' + matchedCourse.totalLessons + ' lessons completed';
        } else {
          lessonsCountEl.textContent = '';
        }
      } else if (lessonsCountEl) { lessonsCountEl.textContent = ''; }

      // Remove old pip logic (no pips in new design)
      var pipsContainer = document.getElementById('continue-pips');
      if (pipsContainer) pipsContainer.style.display = 'none';
      // Language chip — derive from courseIcon (e.g. "fab fa-python" → "Python")
      var langChip = document.getElementById('continue-lang-chip');
      if (langChip && lw.courseIcon) {
        var ic = (lw.courseIcon || '').toLowerCase();
        var label = '';
        if (ic.includes('python'))       label = 'Python';
        else if (ic.includes('java'))    label = 'Java';
        else if (ic.includes('react'))   label = 'React';
        else if (ic.includes('js') || ic.includes('javascript')) label = 'JavaScript';
        else if (ic.includes('html'))    label = 'HTML/CSS';
        else if (ic.includes('node'))    label = 'Node.js';
        else if (ic.includes('cpp') || ic.includes('c++')) label = 'C++';
        else if (ic.includes('swift'))   label = 'Swift';
        else if (ic.includes('android')) label = 'Android';
        if (!label && lw.courseTitle) label = lw.courseTitle.split(' ')[0];
        if (label) { langChip.textContent = label; langChip.style.display = 'inline-block'; }
        else { langChip.style.display = 'none'; }
      } else if (langChip) { langChip.style.display = 'none'; }
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

      // --- Enhanced Continue Learning card fields ---
      // Reuse matchedCourse from above (or find it if not already set)
      if (!matchedCourse) matchedCourse = (data.enrolledCourses || []).find(function(c) { return c.id === lw.courseId; });

      // Difficulty badge
      var diffEl = document.getElementById('continue-difficulty');
      if (diffEl) {
        var prog = actualProgress || 0;
        if (prog >= 70) { diffEl.innerHTML = '🟠 Advanced'; diffEl.style.color = '#fdba74'; diffEl.style.borderColor = 'rgba(249,115,22,0.25)'; diffEl.style.background = 'rgba(249,115,22,0.1)'; }
        else if (prog >= 30) { diffEl.innerHTML = '🟡 Intermediate'; diffEl.style.color = '#fde047'; diffEl.style.borderColor = 'rgba(251,191,36,0.25)'; diffEl.style.background = 'rgba(251,191,36,0.1)'; }
        else { diffEl.innerHTML = '🟢 Beginner'; diffEl.style.color = '#6ee7b7'; diffEl.style.borderColor = 'rgba(16,185,129,0.25)'; diffEl.style.background = 'rgba(16,185,129,0.1)'; }
      }

      // Time estimate (rough: remaining lessons × 8 mins)
      var timeEl = document.getElementById('continue-time-left');
      if (timeEl && matchedCourse && matchedCourse.totalLessons > 0) {
        var remaining = matchedCourse.totalLessons - (matchedCourse.completedLessons || 0);
        var mins = remaining * 8;
        if (mins > 60) { timeEl.textContent = '\u23F1 ~' + Math.round(mins / 60) + 'h remaining'; }
        else if (mins > 0) { timeEl.textContent = '\u23F1 ~' + mins + ' min remaining'; }
        else { timeEl.textContent = '\u2705 Complete!'; }
      } else if (timeEl) { timeEl.textContent = ''; }

      // Mission chips (based on completed/total lessons)
      var chipsEl = document.getElementById('continue-mission-chips');
      if (chipsEl && matchedCourse && matchedCourse.totalLessons > 0) {
        var completed = matchedCourse.completedLessons || 0;
        var total = Math.min(matchedCourse.totalLessons, 5); // show max 5 chips
        var chipsHtml = '';
        for (var i = 0; i < total; i++) {
          if (i < completed) {
            chipsHtml += '<span style="font-size:0.65rem;font-weight:600;color:#6ee7b7;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:2px 8px;display:inline-flex;align-items:center;gap:3px;">✓ Lesson ' + (i + 1) + '</span>';
          } else if (i === completed) {
            chipsHtml += '<span style="font-size:0.65rem;font-weight:700;color:#c4b5fd;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.4);border-radius:8px;padding:3px 10px;display:inline-flex;align-items:center;gap:3px;box-shadow:0 0 8px rgba(139,92,246,0.25);">▶ Lesson ' + (i + 1) + '</span>';
          } else {
            chipsHtml += '<span style="font-size:0.65rem;font-weight:600;color:#64748b;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:2px 8px;display:inline-flex;align-items:center;gap:3px;">○ Lesson ' + (i + 1) + '</span>';
          }
        }
        if (matchedCourse.totalLessons > 5) {
          chipsHtml += '<span style="font-size:0.65rem;color:#64748b;padding:2px 4px;">+' + (matchedCourse.totalLessons - 5) + ' more</span>';
        }
        chipsEl.innerHTML = chipsHtml;
      } else if (chipsEl) { chipsEl.innerHTML = ''; }

      // XP reward — scale with progress
      var xpEl = document.getElementById('continue-xp-reward');
      if (xpEl) {
        var xpAmount = actualProgress >= 80 ? 50 : actualProgress >= 40 ? 30 : 20;
        xpEl.innerHTML = '\u2B50 Earn +' + xpAmount + ' XP';
      }

      // Badge hint — hide if complete
      var badgeHint = document.getElementById('continue-badge-hint');
      if (badgeHint) {
        if (actualProgress >= 100) { badgeHint.style.display = 'none'; }
        else { badgeHint.style.display = 'flex'; }
      }
    } else {
      if (continueSection) continueSection.style.display = 'none';
    }

    // Profile enrolled courses — always update regardless of which page is active
    const profileCoursesContainer = document.querySelector('.profile-courses-list');
    if (profileCoursesContainer) {
      if (data.enrolledCourses && data.enrolledCourses.length > 0) {
        profileCoursesContainer.innerHTML = data.enrolledCourses.map(c => {
          // Determine course icon based on title
          var ct = (c.title || '').toLowerCase();
          var courseIcon = '';
          var iconColor = '#c4b5fd';
          var iconBg = 'rgba(139,92,246,0.2)';
          var iconBorder = 'rgba(139,92,246,0.2)';
          if (ct.includes('java') && !ct.includes('javascript')) { courseIcon = '<i class="fab fa-java" style="font-size:1.3rem;"></i>'; iconColor = '#f97316'; iconBg = 'rgba(249,115,22,0.15)'; iconBorder = 'rgba(249,115,22,0.25)'; }
          else if (ct.includes('python')) { courseIcon = '<i class="fab fa-python" style="font-size:1.1rem;"></i>'; iconColor = '#22c55e'; iconBg = 'rgba(16,185,129,0.15)'; iconBorder = 'rgba(16,185,129,0.25)'; }
          else if (ct.includes('javascript') || ct.includes(' js')) { courseIcon = '<i class="fab fa-js" style="font-size:1.1rem;"></i>'; iconColor = '#fbbf24'; iconBg = 'rgba(251,191,36,0.15)'; iconBorder = 'rgba(251,191,36,0.25)'; }
          else if (ct.includes('html') || ct.includes('web')) { courseIcon = '<i class="fab fa-html5" style="font-size:1.1rem;"></i>'; iconColor = '#f472b6'; iconBg = 'rgba(236,72,153,0.15)'; iconBorder = 'rgba(236,72,153,0.25)'; }
          else if (ct.includes('react')) { courseIcon = '<i class="fab fa-react" style="font-size:1.1rem;"></i>'; iconColor = '#67e8f9'; iconBg = 'rgba(34,211,238,0.15)'; iconBorder = 'rgba(34,211,238,0.25)'; }
          else if (ct.includes('node')) { courseIcon = '<i class="fab fa-node-js" style="font-size:1.1rem;"></i>'; iconColor = '#4ade80'; iconBg = 'rgba(34,197,94,0.15)'; iconBorder = 'rgba(34,197,94,0.25)'; }
          else if (ct === 'c' || ct.includes('c programming') || ct.includes('c lang')) { courseIcon = '<span style="font-size:1.1rem;font-weight:800;font-family:Courier New,monospace;">C</span>'; iconColor = '#67e8f9'; iconBg = 'rgba(34,211,238,0.15)'; iconBorder = 'rgba(34,211,238,0.25)'; }
          else if (ct.includes('c++') || ct.includes('cpp')) { courseIcon = '<span style="font-size:0.9rem;font-weight:800;font-family:Courier New,monospace;">C++</span>'; iconColor = '#a78bfa'; iconBg = 'rgba(139,92,246,0.15)'; iconBorder = 'rgba(139,92,246,0.25)'; }
          else { courseIcon = '<span style="font-size:1.2rem;font-weight:800;font-family:Courier New,monospace;">' + sanitize(c.title.charAt(0)) + '</span>'; }

          return '<div style="margin-bottom:14px;background:rgba(22,22,38,0.6);padding:16px 18px;border-radius:16px;border:1px solid ' + iconBorder + ';display:flex;align-items:center;gap:14px;transition:all 0.25s;cursor:pointer;overflow:hidden;position:relative;" onmouseover="this.style.borderColor=\'' + iconColor + '50\';this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px ' + iconBg + '\'" onmouseout="this.style.borderColor=\'' + iconBorder + '\';this.style.transform=\'translateY(0)\';this.style.boxShadow=\'none\'" onclick="openCourseDetail(\'' + c.id + '\')">' +
          '<div style="width:46px;height:46px;min-width:46px;border-radius:14px;background:' + iconBg + ';border:1px solid ' + iconBorder + ';display:flex;align-items:center;justify-content:center;color:' + iconColor + ';">' + courseIcon + '</div>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
          '<span style="font-weight:700;font-size:0.9rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%;">' + sanitize(c.title) + '</span>' +
          '<span style="font-size:0.85rem;font-weight:800;color:' + ((c.progressPercent || 0) >= 100 ? '#22c55e' : iconColor) + ';flex-shrink:0;">' + (c.progressPercent || 0) + '%</span>' +
          '</div>' +
          '<div style="font-size:0.72rem;color:#64748b;margin-bottom:8px;">' + (c.completedLessons || 0) + ' of ' + (c.totalLessons || 0) + ' lessons completed</div>' +
          '<div style="height:5px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;position:relative;">' +
          '<div class="enrolled-progress-fill" style="width:' + (c.progressPercent || 0) + '%;height:100%;border-radius:10px;background:linear-gradient(90deg,#6c47ff,#a855f7,#ec4899);box-shadow:0 0 6px rgba(139,92,246,0.4);animation:progressFillIn 1s ease-out;position:relative;overflow:hidden;"></div>' +
          '</div>' +
          '</div>' +
          '</div>';
        }).join('');
      } else {
        profileCoursesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted); font-size:0.85rem">No courses enrolled yet.</div>';
      }
    }
}
