/**
 * CodingKida Desktop — Page Functions
 * All remaining page-level functions: enrolled detail, completed videos, streak history,
 * parent report, network diagnostics, orders, mall, rate us, help, referral, sharing,
 * achievements, student progress, homework, and lesson rating.
 */

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
  // Update header stats
  var statsEl = document.getElementById('enrolled-detail-stats');
  if (statsEl) {
    var totalCourses = enrolledCourses.length;
    var avgProgress = totalCourses > 0 ? Math.round(enrolledCourses.reduce(function(s, c) { return s + (c.progressPercent || 0); }, 0) / totalCourses) : 0;
    statsEl.innerHTML = '<span style="font-size:0.82rem;font-weight:600;color:#c4b5fd;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);border-radius:10px;padding:5px 12px;display:flex;align-items:center;gap:5px;">\uD83D\uDCDA ' + totalCourses + ' Course' + (totalCourses > 1 ? 's' : '') + '</span>' +
      '<span style="font-size:0.82rem;font-weight:600;color:#fbbf24;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:5px 12px;display:flex;align-items:center;gap:5px;">\u26A1 ' + avgProgress + '% Progress</span>';
  }

  // Get last watched for "last learned" info
  var lw = JSON.parse(localStorage.getItem('ck_last_lesson') || 'null');

  container.innerHTML = enrolledCourses.map(function(c) {
    var percent = c.progressPercent || 0;
    var completed = c.completedLessons || 0;
    var total = c.totalLessons || 0;
    var remaining = total - completed;
    var isComplete = percent >= 100;
    var accentColor = isComplete ? '#22c55e' : '#a78bfa';
    var diffLabel = percent >= 70 ? '\uD83D\uDFE0 Advanced' : percent >= 30 ? '\uD83D\uDFE1 Intermediate' : '\uD83D\uDFE2 Beginner';
    var diffColor = percent >= 70 ? '#fdba74' : percent >= 30 ? '#fde047' : '#6ee7b7';

    // Determine last learned lesson for this course
    var lastLearned = '';
    if (lw && lw.courseId === c.id && lw.lessonTitle) {
      lastLearned = lw.lessonTitle;
    }

    return '<div style="position:relative;background:rgba(22,22,38,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(139,92,246,0.12);border-radius:22px;padding:24px 28px;display:flex;gap:20px;transition:all 0.3s ease;cursor:pointer;overflow:hidden;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.borderColor=\'rgba(139,92,246,0.35)\';this.style.boxShadow=\'0 12px 30px rgba(139,92,246,0.12)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.borderColor=\'rgba(139,92,246,0.12)\';this.style.boxShadow=\'none\'" onclick="openCourseDetail(\'' + c.id + '\')">' +
      '<!-- Watermark -->' +
      '<div style="position:absolute;top:50%;right:24px;transform:translateY(-50%);font-size:3.5rem;font-weight:900;color:rgba(139,92,246,0.04);font-family:Courier New,monospace;pointer-events:none;user-select:none;">{ }</div>' +
      '<!-- Ambient glow -->' +
      '<div style="position:absolute;top:-30%;left:-5%;width:140px;height:140px;background:radial-gradient(circle,rgba(139,92,246,0.1),transparent 70%);pointer-events:none;"></div>' +
      '<!-- Course icon -->' +
      '<div style="width:64px;min-width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(99,102,241,0.1));border:1px solid rgba(139,92,246,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.2),0 0 8px rgba(139,92,246,0.1);align-self:flex-start;margin-top:2px;">' +
      '<span style="font-size:1.4rem;font-weight:800;color:#c4b5fd;font-family:Courier New,monospace;">' + sanitize(c.title.charAt(0)) + '</span>' +
      '</div>' +
      '<!-- Details -->' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;">' +
      '<!-- Title + difficulty -->' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
      '<h4 style="color:#fff;font-weight:800;font-size:1.05rem;margin:0;">' + sanitize(c.title) + '</h4>' +
      '<span style="font-size:0.62rem;font-weight:700;color:' + diffColor + ';background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:2px 8px;">' + diffLabel + '</span>' +
      '</div>' +
      '<!-- Lessons count -->' +
      '<div style="font-size:0.8rem;color:#94a3b8;display:flex;align-items:center;gap:4px;">\u26A1 ' + completed + ' of ' + total + ' lessons completed</div>' +
      (lastLearned ? '<div style="font-size:0.75rem;color:#64748b;display:flex;align-items:center;gap:5px;">\uD83D\uDCCD Last learned: <span style="color:#c4b5fd;font-weight:500;">' + sanitize(lastLearned) + '</span></div>' : '') +
      (remaining > 0 && !isComplete ? '<div style="font-size:0.75rem;color:#64748b;display:flex;align-items:center;gap:5px;">\u25B6 Next: <span style="color:#f0abfc;font-weight:500;">' + remaining + ' lesson' + (remaining > 1 ? 's' : '') + ' remaining</span></div>' : '') +
      '<!-- Progress bar -->' +
      '<div style="display:flex;align-items:center;gap:10px;margin-top:4px;">' +
      '<div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;position:relative;">' +
      '<div class="enrolled-progress-fill" style="width:' + percent + '%;height:100%;border-radius:10px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7);box-shadow:0 0 8px rgba(139,92,246,0.4);animation:progressFillIn 1.2s ease-out;position:relative;overflow:hidden;"></div>' +
      '</div>' +
      '<span style="font-size:0.82rem;font-weight:800;color:' + accentColor + ';min-width:38px;text-align:right;">' + percent + '%</span>' +
      '</div>' +
      '<!-- Resume -->' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">' +
      (isComplete ? '<span style="font-size:0.75rem;color:#22c55e;font-weight:600;">\u2705 Course Complete!</span>' : '<span style="font-size:0.72rem;color:#64748b;">\u23F1 ~' + (remaining * 8) + ' min remaining</span>') +
      '<span style="font-size:0.78rem;font-weight:700;color:#a78bfa;display:flex;align-items:center;gap:5px;">' + (isComplete ? 'Review Course' : 'Resume') + ' \u2192</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');
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
        const totalCompleted = data.completedVideos || enrolledCourses.reduce((sum, c) => sum + (c.completedLessons || 0), 0);
        if (totalCompleted === 0) {
          container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No completed lessons yet. Start learning!</p></div>';
          return;
        }
        _renderCompletedVideosList(container, enrolledCourses, totalCompleted);
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
    const totalCompleted = data.completedVideos || enrolledCourses.reduce((sum, c) => sum + (c.completedLessons || 0), 0);
    if (totalCompleted === 0) {
      container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No completed lessons yet. Start learning!</p></div>';
      return;
    }
    _renderCompletedVideosList(container, enrolledCourses, totalCompleted);
  } catch {
    container.innerHTML = '<p style="color:var(--danger)">Failed to load data.</p>';
  }
}

function _renderCompletedVideosList(container, enrolledCourses, totalCompleted) {
  // Header stats — use actual enrolled data sum for accuracy
  var statsEl = document.getElementById('completed-videos-stats');
  if (statsEl) {
    var enrolledCompleted = enrolledCourses.reduce(function(s, c) { return s + (c.completedLessons || 0); }, 0);
    var enrolledTotal = enrolledCourses.reduce(function(s, c) { return s + (c.totalLessons || 0); }, 0);
    statsEl.innerHTML = '<span style="font-size:0.82rem;font-weight:600;color:#6ee7b7;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:5px 12px;display:flex;align-items:center;gap:5px;">\u2705 ' + enrolledCompleted + ' Lesson' + (enrolledCompleted !== 1 ? 's' : '') + ' Completed</span>';
  }

  var enrolledWithProgress = enrolledCourses.filter(function(c) { return c.completedLessons > 0; });

  if (enrolledWithProgress.length === 0) {
    // Free videos watched but no enrolled courses
    container.innerHTML = '<div style="position:relative;background:rgba(22,22,38,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(16,185,129,0.12);border-radius:22px;padding:24px 28px;display:flex;gap:20px;overflow:hidden;">' +
      '<div style="width:64px;min-width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(34,197,94,0.1));border:1px solid rgba(16,185,129,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
      '<i class="fas fa-check" style="font-size:1.3rem;color:#6ee7b7;"></i></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">' +
      '<h4 style="color:#fff;font-weight:800;font-size:1.05rem;margin:0;">Free Lessons</h4>' +
      '<p style="color:#94a3b8;font-size:0.82rem;margin:0;">' + totalCompleted + ' lesson' + (totalCompleted > 1 ? 's' : '') + ' completed</p>' +
      '<p style="color:#6ee7b7;font-size:0.78rem;margin:0;font-weight:500;">\uD83C\uDF89 Keep it up!</p>' +
      '</div></div>';
    return;
  }

  container.innerHTML = enrolledWithProgress.map(function(c) {
    var percent = c.progressPercent || 0;
    var completed = c.completedLessons || 0;
    var total = c.totalLessons || 0;
    var isComplete = percent >= 100;
    var statusLabel = isComplete ? '\u2705 Completed' : '\uD83D\uDFE2 In Progress';
    var statusColor = isComplete ? '#22c55e' : '#6ee7b7';
    var motivational = '';
    if (isComplete) motivational = '\uD83C\uDFC6 Course mastered!';
    else if (percent >= 75) motivational = '\uD83D\uDD25 You\'re almost there!';
    else if (percent >= 40) motivational = '\uD83C\uDF89 Great progress!';
    else motivational = '\uD83D\uDE80 Good start, keep going!';

    // SVG completion ring
    var ringSize = 56;
    var strokeWidth = 5;
    var radius = (ringSize - strokeWidth) / 2;
    var circumference = 2 * Math.PI * radius;
    var dashOffset = circumference - (percent / 100) * circumference;
    var ringColor = isComplete ? '#22c55e' : '#a855f7';
    var ringSvg = '<svg width="' + ringSize + '" height="' + ringSize + '" style="flex-shrink:0;">' +
      '<circle cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="' + strokeWidth + '"/>' +
      '<circle class="progress-ring-circle" cx="' + (ringSize/2) + '" cy="' + (ringSize/2) + '" r="' + radius + '" fill="none" stroke="' + ringColor + '" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + dashOffset + '" transform="rotate(-90 ' + (ringSize/2) + ' ' + (ringSize/2) + ')" style="animation:ringDraw 1.5s ease-out forwards;"/>' +
      '<text x="50%" y="50%" text-anchor="middle" dy="0.35em" style="font-size:0.7rem;font-weight:800;fill:#fff;">' + percent + '%</text>' +
      '</svg>';

    return '<div style="position:relative;background:rgba(22,22,38,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(16,185,129,0.12);border-radius:22px;padding:24px 28px;display:flex;gap:20px;transition:all 0.3s ease;cursor:pointer;overflow:hidden;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.borderColor=\'rgba(16,185,129,0.35)\';this.style.boxShadow=\'0 12px 30px rgba(16,185,129,0.1)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.borderColor=\'rgba(16,185,129,0.12)\';this.style.boxShadow=\'none\'" onclick="openCourseDetail(\'' + c.id + '\')">' +
      '<!-- Watermark -->' +
      '<div style="position:absolute;top:50%;right:24px;transform:translateY(-50%);font-size:3rem;font-weight:900;color:rgba(16,185,129,0.04);font-family:Courier New,monospace;pointer-events:none;user-select:none;">\u2713</div>' +
      '<!-- Ambient glow -->' +
      '<div style="position:absolute;top:-30%;left:-5%;width:120px;height:120px;background:radial-gradient(circle,rgba(16,185,129,0.08),transparent 70%);pointer-events:none;"></div>' +
      '<!-- Completion ring -->' +
      ringSvg +
      '<!-- Details -->' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;">' +
      '<!-- Title + status -->' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
      '<h4 style="color:#fff;font-weight:800;font-size:1.05rem;margin:0;">' + sanitize(c.title) + '</h4>' +
      '<span style="font-size:0.62rem;font-weight:700;color:' + statusColor + ';background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:2px 8px;">' + statusLabel + '</span>' +
      '</div>' +
      '<!-- Lessons count -->' +
      '<div style="font-size:0.8rem;color:#94a3b8;">' + completed + ' of ' + total + ' lessons completed</div>' +
      '<!-- Progress bar -->' +
      '<div style="width:100%;height:5px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;position:relative;">' +
      '<div class="enrolled-progress-fill" style="width:' + percent + '%;height:100%;border-radius:10px;background:linear-gradient(90deg,#10b981,#22c55e);box-shadow:0 0 6px rgba(16,185,129,0.4);animation:progressFillIn 1.2s ease-out;position:relative;overflow:hidden;"></div>' +
      '</div>' +
      '<!-- Motivational + CTA -->' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">' +
      '<span style="font-size:0.78rem;color:#6ee7b7;font-weight:500;">' + motivational + '</span>' +
      '<span style="font-size:0.78rem;font-weight:700;color:#22c55e;display:flex;align-items:center;gap:5px;">Watch Again \u25B6</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  }).join('');
}

// Weekly Streak History
async function showWeeklyStreakHistory() {
  navigate('streak-history');
  const container = document.getElementById('streak-history-list');
  if (!container) return;

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    container.innerHTML = '<p style="color:var(--muted)">Please log in to view streak history.</p>';
    return;
  }

  // Cache-first: show cached streak data instantly
  var cached = ckCacheGet('/api/weekly-streak-all');
  if (cached !== null) {
    _renderStreakHistory(container, cached);
  } else {
    container.innerHTML = '<p style="color:var(--muted)">Loading...</p>';
  }

  // Background refresh
  try {
    var allStreaks = await _fetchAllStreakData(token);
    ckCacheSet('/api/weekly-streak-all', allStreaks);
    _renderStreakHistory(container, allStreaks);
  } catch {
    if (!cached) container.innerHTML = '<p style="color:var(--danger)">Failed to load streak history.</p>';
  }
}

/**
 * Fetch all streak data across enrolled courses (shared by history + count)
 */
async function _fetchAllStreakData(token) {
  var dashData = ckCacheGet('/api/student/dashboard');
  if (!dashData || !dashData.success) {
    dashData = await StudentAPI.getDashboard();
  }
  if (!dashData || !dashData.success || !dashData.enrolledCourses || dashData.enrolledCourses.length === 0) {
    return [];
  }

  var allStreaks = [];
  for (var ci = 0; ci < dashData.enrolledCourses.length; ci++) {
    var course = dashData.enrolledCourses[ci];
    try {
      var res = await fetch(BASE_URL + '/api/weekly-streak?courseId=' + course.id, {
        headers: { Authorization: 'Bearer ' + token },
      });
      var data = await res.json();
      if (data.success && data.streaks) {
        data.streaks.forEach(function(s) {
          allStreaks.push({ weekNumber: s.weekNumber, title: s.title, completed: s.completed, courseTitle: course.title });
        });
      }
    } catch {}
  }
  return allStreaks;
}

/**
 * Render streak history list (reused by cached + fresh paths)
 */
function _renderStreakHistory(container, allStreaks) {
  if (!allStreaks || allStreaks.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px"><i class="fas fa-fire" style="font-size:2rem;color:var(--muted);margin-bottom:12px;display:block"></i><p style="color:var(--muted)">No weekly challenges created yet. Complete lessons to unlock!</p></div>';
    return;
  }
  container.innerHTML = allStreaks.map(function(s) {
    return '<div style="background:rgba(255,255,255,0.03);border:1px solid ' + (s.completed ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.2)') + ';border-radius:12px;padding:16px;display:flex;align-items:center;gap:14px">' +
      '<div style="width:40px;height:40px;border-radius:10px;background:' + (s.completed ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + (s.completed ? 'fa-check' : 'fa-fire') + '" style="color:' + (s.completed ? '#22c55e' : '#f59e0b') + '"></i></div>' +
      '<div style="flex:1">' +
      '<p style="color:#fff;font-weight:600;font-size:0.9rem;margin:0">Week ' + s.weekNumber + ': ' + sanitize(s.title) + '</p>' +
      '<p style="color:var(--muted);font-size:0.75rem;margin:2px 0 0">' + sanitize(s.courseTitle) + '</p>' +
      '</div>' +
      '<span style="font-size:0.75rem;font-weight:700;padding:4px 10px;border-radius:20px;background:' + (s.completed ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)') + ';color:' + (s.completed ? '#22c55e' : '#f59e0b') + '">' + (s.completed ? '✅ PASS' : '⏳ Pending') + '</span>' +
      '</div>';
  }).join('');
}

// Load weekly streak count — called once on dashboard navigate (not in polling)
async function loadWeeklyStreakCount() {
  const streakEl = document.getElementById('stat-streak');
  if (!streakEl) return;
  var streakCard = document.querySelector('[data-card="streak"]');
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) { streakEl.textContent = '0'; if (streakCard) streakCard.classList.add('is-zero'); updateStreakPips(0); updateWeeklyChallenge(0, 0); return; }

  var cached = ckCacheGet('/api/weekly-streak-all');
  if (cached !== null) {
    var count = cached.filter(function(s) { return s.completed; }).length;
    streakEl.textContent = String(count);
    streakEl.dataset.loaded = 'true';
    if (streakCard) { if (count === 0) streakCard.classList.add('is-zero'); else streakCard.classList.remove('is-zero'); }
    updateStreakPips(count);
    updateWeeklyChallenge(count, cached.length);
  }

  try {
    var allStreaks = await _fetchAllStreakData(token);
    ckCacheSet('/api/weekly-streak-all', allStreaks);
    var totalCompleted = allStreaks.filter(function(s) { return s.completed; }).length;
    streakEl.textContent = String(totalCompleted);
    streakEl.dataset.loaded = 'true';
    if (streakCard) { if (totalCompleted === 0) streakCard.classList.add('is-zero'); else streakCard.classList.remove('is-zero'); }
    updateStreakPips(totalCompleted);
    updateWeeklyChallenge(totalCompleted, allStreaks.length);
  } catch {
    if (!cached) { streakEl.textContent = '0'; if (streakCard) streakCard.classList.add('is-zero'); updateStreakPips(0); updateWeeklyChallenge(0, 0); }
  }
}

function updateStreakPips(count) {
  var pipsContainer = document.getElementById('streak-pips');
  if (!pipsContainer) return;
  var pips = pipsContainer.querySelectorAll('.streak-pip');
  var goal = 7;
  var filled = Math.min(count, goal);
  for (var i = 0; i < pips.length; i++) {
    if (i < filled) {
      pips[i].style.background = '#f43f5e';
      pips[i].style.border = 'none';
      pips[i].style.boxShadow = '0 0 8px rgba(244,63,94,0.8)';
      pips[i].style.animation = 'none';
    } else if (i === filled && filled < goal) {
      pips[i].style.background = 'rgba(244,63,94,0.4)';
      pips[i].style.border = '1px solid rgba(244,63,94,0.8)';
      pips[i].style.boxShadow = 'none';
      pips[i].style.animation = 'pipPulse 2s infinite';
    } else {
      pips[i].style.background = 'rgba(255,255,255,0.1)';
      pips[i].style.border = '1px solid rgba(255,255,255,0.15)';
      pips[i].style.boxShadow = 'none';
      pips[i].style.animation = 'none';
    }
  }
  var footerText = document.getElementById('streak-footer-text');
  if (footerText) {
    var remaining = goal - filled;
    if (filled === 0) footerText.textContent = "Let's begin! \uD83D\uDD25";
    else if (remaining <= 0) footerText.textContent = 'Goal reached! \uD83C\uDF89';
    else footerText.textContent = remaining + ' days to goal';
  }
}

// ─── Weekly Challenge Card (driven by streak data) ────────────────────────────
function updateWeeklyChallenge(completed, total) {
  var progressText = document.getElementById('wc-progress-text');
  var progressBar = document.getElementById('wc-progress-bar');
  var description = document.getElementById('wc-description');
  var reward = document.getElementById('wc-reward');
  if (!progressText) return;

  var t = total || 0;
  var c = completed || 0;
  var percent = t > 0 ? Math.round((c / t) * 100) : 0;

  progressText.textContent = c + ' / ' + t;
  if (progressBar) progressBar.style.width = percent + '%';
  if (description) {
    if (t === 0) description.textContent = 'Enroll in a course to unlock coding challenges!';
    else if (c >= t) description.textContent = 'All challenges completed! You\'re a champ! \uD83C\uDF89';
    else description.textContent = 'Complete ' + t + ' coding challenges and earn 50 coins!';
  }
  if (reward) {
    if (c >= t && t > 0) reward.textContent = '\u2705 50 Coins earned!';
    else reward.textContent = '+50 Coins on completion';
  }
}

// ─── Parent Report ────────────────────────────────────────────────────────────

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
    // Use cached coins/achievements for instant render
    var cachedCoins = ckCacheGet('/api/coins');
    var cachedAch = ckCacheGet('/api/achievements');
    var instantCoins = (cachedCoins && cachedCoins.success) ? cachedCoins.totalCoins : (_userCoinsCache || 0);
    var instantAch = (cachedAch && cachedAch.success && cachedAch.achievements) ? cachedAch.achievements : [];
    _renderParentReport(dashData, instantAch, instantCoins);
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
  const superMasterCount = achievements.filter(function(a) { return a.badgeType === 'super-master'; }).length;
  const masterCount = achievements.filter(function(a) { return a.badgeType === 'master'; }).length;
  const proCount = achievements.filter(function(a) { return a.badgeType === 'pro'; }).length;
  const streakCount = parseInt(document.getElementById('stat-streak')?.textContent || '0') || 0;
  const studentName = document.getElementById('sidebar-user-name')?.textContent || 'Student';
  const att = _attendanceGetSummary();

  // Summary cards
  const summaryCards = [
    { icon: 'fa-book-open',     color: '#8B5CF6', label: 'Courses Enrolled',  value: totalEnrolled,           sub: 'total' },
    { icon: 'fa-check-circle',  color: '#22C55E', label: 'Lessons Completed', value: totalCompleted,          sub: 'all time' },
    { icon: 'fa-clock',         color: '#F59E0B', label: 'Today',             value: _fmtMins(att.todayMins), sub: 'learning time' },
    { icon: 'fa-calendar-week', color: '#EC4899', label: 'This Week',         value: _fmtMins(att.weekMins),  sub: att.activeDays + ' active days / 30' },
  ];
  document.getElementById('pr-summary-cards').innerHTML = summaryCards.map(function(c) {
    return '<div style="background:rgba(14,12,30,0.8);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(139,92,246,0.14);border-radius:20px;padding:22px;transition:all 0.22s ease;box-shadow:0 4px 16px rgba(0,0,0,0.25),0 0 20px rgba(139,92,246,0.035);position:relative;overflow:hidden;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.borderColor=\'' + c.color + '40\';this.style.boxShadow=\'0 8px 24px rgba(0,0,0,0.3),0 0 24px ' + c.color + '15\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.borderColor=\'rgba(139,92,246,0.14)\';this.style.boxShadow=\'0 4px 16px rgba(0,0,0,0.25),0 0 20px rgba(139,92,246,0.035)\'">' +
      '<div style="position:absolute;top:-20%;right:-10%;width:80px;height:80px;background:radial-gradient(circle,' + c.color + '08,transparent 70%);pointer-events:none;"></div>' +
      '<div style="width:40px;height:40px;border-radius:12px;background:' + c.color + '18;border:1px solid ' + c.color + '30;display:flex;align-items:center;justify-content:center;margin-bottom:14px;box-shadow:0 0 8px ' + c.color + '12;">' +
      '<i class="fas ' + c.icon + '" style="color:' + c.color + ';font-size:0.85rem;"></i></div>' +
      '<div style="font-size:2rem;font-weight:700;color:#F8FAFC;line-height:1;margin-bottom:6px;">' + c.value + '</div>' +
      '<div style="font-size:0.9rem;font-weight:600;color:rgba(255,255,255,0.78);margin-bottom:3px;">' + c.label + '</div>' +
      '<div style="font-size:0.75rem;color:rgba(255,255,255,0.38);">' + c.sub + '</div>' +
      '</div>';
  }).join('');

  // Attendance calendar
  var attMeta = document.getElementById('pr-attendance-meta');
  var attCal = document.getElementById('pr-attendance-calendar');
  if (attMeta) attMeta.textContent = '';
  if (attCal) {
    // 15 past days + today + 14 future days = 30 cells
    var calData = att.calendar.slice();
    var today = new Date();
    var past15 = calData.slice(-15);
    var future15 = [];
    for (var fi = 1; fi <= 15; fi++) {
      var fd = new Date(today); fd.setDate(today.getDate() + fi);
      future15.push({ day: fd.getDate(), date: fd.toLocaleDateString('en-IN'), mins: 0, active: false, _future: true });
    }
    var combined = past15.concat(future15);

    // Stats strip
    var statsHtml = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px;">' +
      '<div style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.1);border-radius:10px;padding:10px 14px;text-align:center;">' +
      '<div style="font-size:1rem;font-weight:800;color:#fff;">' + att.activeDays + ' <span style="font-size:0.7rem;font-weight:500;color:#64748b;">/ 30</span></div>' +
      '<div style="font-size:0.65rem;color:#64748b;margin-top:2px;">Active Days</div></div>' +
      '<div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.1);border-radius:10px;padding:10px 14px;text-align:center;">' +
      '<div style="font-size:1rem;font-weight:800;color:#fff;">' + _fmtMins(Math.min(att.todayMins, 1440)) + '</div>' +
      '<div style="font-size:0.65rem;color:#64748b;margin-top:2px;">Today\u2019s Focus</div></div>' +
      '<div style="background:rgba(236,72,153,0.05);border:1px solid rgba(236,72,153,0.1);border-radius:10px;padding:10px 14px;text-align:center;">' +
      '<div style="font-size:1rem;font-weight:800;color:#fff;">' + _fmtMins(att.weekMins) + '</div>' +
      '<div style="font-size:0.65rem;color:#64748b;margin-top:2px;">Weekly Total</div></div>' +
      '</div>';

    // Weekday header + alignment padding
    var firstDate = new Date(today); firstDate.setDate(today.getDate() - 14);
    var startDow = firstDate.getDay(); var startPad = startDow === 0 ? 6 : startDow - 1;
    var weekdayHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;text-align:center;">';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(d) { weekdayHtml += '<span style="font-size:0.6rem;font-weight:600;color:#64748b;">' + d + '</span>'; });
    weekdayHtml += '</div>';

    // Grid cells (compact 40x40 squares)
    var padHtml = '';
    for (var pi = 0; pi < startPad; pi++) { padHtml += '<div style="width:44px;height:44px;"></div>'; }
    var cellsHtml = padHtml + combined.map(function(day, idx) {
      var isToday = idx === past15.length - 1;
      var isFuture = day._future;
      if (isFuture) {
        return '<div title="' + day.date + ' \u00b7 Plan your coding!" style="width:44px;height:44px;border-radius:8px;background:rgba(15,15,30,0.6);border:1px dashed rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;font-size:0.68rem;color:rgba(100,116,139,0.5);font-weight:500;transition:all 0.18s;margin:0 auto;" onmouseover="this.style.borderColor=\'rgba(139,92,246,0.35)\';this.style.color=\'rgba(139,92,246,0.6)\'" onmouseout="this.style.borderColor=\'rgba(139,92,246,0.15)\';this.style.color=\'rgba(100,116,139,0.5)\'">' + day.day + '</div>';
      }
      var displayMins = Math.min(day.mins || 0, 1440);
      var intensity = day.mins === 0 ? 0 : day.mins < 15 ? 0.3 : day.mins < 30 ? 0.6 : 1;
      var bg, borderColor, textColor, shadow;
      if (!day.active) { bg = 'rgba(255,255,255,0.03)'; borderColor = 'rgba(255,255,255,0.07)'; textColor = '#94A3B8'; shadow = 'none'; }
      else if (intensity <= 0.3) { bg = 'rgba(124,58,237,0.25)'; borderColor = 'rgba(124,58,237,0.3)'; textColor = '#C4B5FD'; shadow = 'none'; }
      else if (intensity <= 0.6) { bg = 'linear-gradient(135deg,#7C3AED,#A855F7)'; borderColor = 'rgba(168,85,247,0.4)'; textColor = '#fff'; shadow = '0 0 8px rgba(168,85,247,0.2)'; }
      else { bg = 'linear-gradient(135deg,#A855F7,#EC4899)'; borderColor = 'rgba(236,72,153,0.4)'; textColor = '#fff'; shadow = '0 0 12px rgba(236,72,153,0.4)'; }
      if (isToday) { borderColor = '#A78BFA'; shadow = (shadow === 'none' ? '' : shadow + ',') + '0 0 0 2px rgba(167,139,250,0.4)'; if (!day.active) { bg = 'rgba(139,92,246,0.1)'; textColor = '#A78BFA'; } }
      return '<div title="' + day.date + (displayMins > 0 ? ' \u00b7 ' + _fmtMins(displayMins) : (isToday ? ' \u00b7 Today' : '')) + '" style="width:44px;height:44px;border-radius:8px;background:' + bg + ';border:1px solid ' + borderColor + ';display:flex;align-items:center;justify-content:center;font-size:0.68rem;color:' + textColor + ';font-weight:' + (isToday || day.active ? '700' : '500') + ';box-shadow:' + shadow + ';transition:all 0.18s ease;margin:0 auto;" onmouseover="this.style.transform=\'scale(1.1)\'" onmouseout="this.style.transform=\'scale(1)\'">' + day.day + '</div>';
    }).join('');

    // Legend (single, clean, centered)
    var legendHtml = '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px;font-size:0.62rem;color:#64748B;">' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:rgba(15,15,30,0.6);border:1px solid rgba(100,116,139,0.15);"></span> Inactive</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:rgba(88,28,135,0.5);"></span> Started</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#6D28D9,#7C3AED);"></span> Focused</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#A855F7,#EC4899);box-shadow:0 0 6px rgba(236,72,153,0.4);"></span> On Fire</span>' +
      '</div>';

    // Month label
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var monthLabel = '<div style="font-size:0.72rem;font-weight:600;color:#94A3B8;letter-spacing:0.5px;margin-bottom:10px;text-align:center;">' + monthNames[today.getMonth()] + ' ' + today.getFullYear() + '</div>';

    attCal.innerHTML = statsHtml +
      '<div style="background:rgba(19,21,40,0.5);padding:16px 18px;border-radius:14px;border:1px solid rgba(255,255,255,0.04);">' +
      monthLabel + weekdayHtml +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;place-items:center;">' + cellsHtml + '</div>' +
      legendHtml + '</div>';
  }

  // Active days badge + Motivational message + Next Mission
  var activeBadge = document.getElementById('pr-active-days-badge');
  if (activeBadge) activeBadge.innerHTML = '\uD83D\uDCC5 ' + att.activeDays + ' Active Days';

  var motivArea = document.getElementById('pr-motivation-area');
  if (motivArea) {
    // Calculate this week using actual calendar week boundaries (Mon-Sun)
    var today = new Date();
    var dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    var mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since last Monday
    var thisWeekDays = 0;
    var lastWeekDays = 0;
    var bestWeekDays = 0;

    // Group calendar by actual weeks (working backwards from today)
    var weeks = []; // array of week objects {activeDays: N}
    var currentWeek = [];
    att.calendar.forEach(function(day, idx) {
      currentWeek.push(day);
      if (currentWeek.length === 7 || idx === att.calendar.length - 1) {
        var weekActive = currentWeek.filter(function(d) { return d.active; }).length;
        weeks.push({ activeDays: weekActive });
        if (weekActive > bestWeekDays) bestWeekDays = weekActive;
        currentWeek = [];
      }
    });

    // This week = count active days from calendar entries within current Mon-Sun
    // Use the last (mondayOffset + 1) days as "this week so far"
    var thisWeekSlice = att.calendar.slice(-(mondayOffset + 1));
    thisWeekDays = thisWeekSlice.filter(function(d) { return d.active; }).length;

    // Last week = the 7 days before this week
    var lastWeekSlice = att.calendar.slice(-(mondayOffset + 8), -(mondayOffset + 1));
    lastWeekDays = lastWeekSlice.filter(function(d) { return d.active; }).length;

    // Dynamic motivational message — coding-focused, context-aware
    var motTitle = '', motText = '', motIcon = '';
    if (thisWeekDays === 0) { motIcon = '\uD83C\uDF31'; motTitle = 'Ready for this week\u2019s mission?'; motText = 'Start a coding session and keep your journey moving!'; }
    else if (thisWeekDays <= 2) { motIcon = '\uD83D\uDE80'; motTitle = 'You\u2019re getting started!'; motText = 'You\'ve coded ' + thisWeekDays + ' day' + (thisWeekDays > 1 ? 's' : '') + ' this week. Keep the momentum going!'; }
    else if (thisWeekDays <= 4) { motIcon = '\uD83D\uDD25'; motTitle = 'You\u2019re on a roll!'; motText = thisWeekDays + ' coding days this week! ' + (remaining > 0 ? remaining + ' more and you beat last week!' : 'You\'re crushing it!'); }
    else { motIcon = '\uD83C\uDFC6'; motTitle = 'Coding superstar!'; motText = thisWeekDays + ' days of coding this week \u2014 incredible consistency!'; }
    // NEW RECORD only if actually beating both best AND last week right now
    if (thisWeekDays > 0 && thisWeekDays > lastWeekDays && thisWeekDays >= bestWeekDays) { motIcon = '\uD83C\uDF89'; motTitle = 'NEW RECORD!'; motText = 'You just had your strongest learning week! ' + thisWeekDays + ' days of pure coding! \uD83D\uDE80'; }

    // Next mission: goal is to beat last week OR do one more day
    var nextGoal = Math.max(lastWeekDays + 1, thisWeekDays + 1);
    if (nextGoal > 7) nextGoal = 7;
    var remaining = nextGoal - thisWeekDays;
    if (remaining < 0) remaining = 0;
    var missionProgress = nextGoal > 0 ? Math.min(Math.round((thisWeekDays / nextGoal) * 100), 100) : 100;
    var missionText = '';
    if (remaining === 0) missionText = 'Goal reached! You\'re amazing! \uD83C\uDF89';
    else if (remaining === 1) missionText = 'One more coding session! \uD83D\uDE80';
    else missionText = remaining + ' more days to beat your best!';
    var missionSub = thisWeekDays >= nextGoal ? 'Keep your streak alive!' : 'Beat your best week!';

    motivArea.innerHTML =
      // Left: Motivational message + weekly progress
      '<div style="background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.1);border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;flex:1;">' +
      '<div style="display:flex;align-items:flex-start;gap:12px;">' +
      '<span style="font-size:1.5rem;flex-shrink:0;">' + motIcon + '</span>' +
      '<div>' +
      '<div style="font-size:0.9rem;font-weight:700;color:#fff;margin-bottom:3px;">' + motTitle + '</div>' +
      '<div style="font-size:0.78rem;color:rgba(255,255,255,0.55);line-height:1.5;">' + motText + '</div>' +
      '</div></div>' +
      '<div style="background:rgba(139,92,246,0.06);border-radius:10px;padding:10px 12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '<span style="font-size:0.65rem;color:#94a3b8;font-weight:600;">This Week</span>' +
      '<span style="font-size:0.65rem;color:#c4b5fd;font-weight:700;">' + thisWeekDays + ' / 7 days</span></div>' +
      '<div style="height:5px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">' +
      '<div style="width:' + Math.round((thisWeekDays / 7) * 100) + '%;height:100%;border-radius:10px;background:linear-gradient(90deg,#7C3AED,#A855F7);box-shadow:0 0 6px rgba(139,92,246,0.3);"></div></div>' +
      '</div></div>' +
      // Right: Next Mission
      '<div style="background:rgba(251,191,36,0.04);border:1px solid rgba(251,191,36,0.1);border-radius:14px;padding:16px 18px;min-width:200px;">' +
      '<div style="font-size:0.68rem;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:flex;align-items:center;gap:5px;">\uD83C\uDFAF Next Coding Mission</div>' +
      '<div style="font-size:0.72rem;color:rgba(255,255,255,0.45);margin-bottom:8px;">' + missionSub + '</div>' +
      '<div style="font-size:0.88rem;font-weight:700;color:rgba(255,255,255,0.85);margin-bottom:10px;">' + missionText + '</div>' +
      '<div style="height:7px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;margin-bottom:5px;">' +
      '<div style="width:' + missionProgress + '%;height:100%;border-radius:10px;background:linear-gradient(90deg,#fbbf24,#f59e0b);box-shadow:0 0 6px rgba(251,191,36,0.3);transition:width 0.5s ease;"></div></div>' +
      '<div style="font-size:0.7rem;color:rgba(255,255,255,0.35);">' + thisWeekDays + ' / ' + nextGoal + ' days this week</div>' +
      '</div>';
  }

  // Course progress
  document.getElementById('pr-course-progress').innerHTML = enrolledCourses.length > 0
    ? enrolledCourses.map(function(c) {
        var pct = c.progressPercent || 0;
        return '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(139,92,246,0.08);border-radius:12px;padding:14px 16px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<span style="font-size:0.88rem;color:#fff;font-weight:700;">' + sanitize(c.title) + '</span>' +
          '<span style="font-size:0.85rem;font-weight:800;color:' + (pct === 100 ? '#22c55e' : '#a78bfa') + ';">' + pct + '%</span>' +
          '</div>' +
          '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:50px;overflow:hidden;margin-bottom:6px;">' +
          '<div class="enrolled-progress-fill" style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#6c47ff,#a855f7,#ec4899);border-radius:50px;box-shadow:0 0 6px rgba(139,92,246,0.4);animation:progressFillIn 1s ease-out;position:relative;overflow:hidden;"></div>' +
          '</div>' +
          '<div style="font-size:0.7rem;color:#64748b;">' + (c.completedLessons || 0) + ' of ' + (c.totalLessons || 0) + ' lessons completed</div>' +
          '</div>';
      }).join('')
    : '<p style="color:#64748b;font-size:0.85rem;">No courses enrolled yet.</p>';

  // Stats row (3 cards — no Certificates)
  document.getElementById('pr-stats-row').innerHTML = [
    { icon: 'fa-fire',   color: '#ef4444', label: 'Weekly Streak', value: streakCount,         sub: 'Keep it going!' },
    { icon: 'fa-coins',  color: '#ec4899', label: 'Coins Earned',  value: totalCoins,          sub: 'Great progress!' },
    { icon: 'fa-medal',  color: '#a78bfa', label: 'Achievements',  value: achievements.length, sub: 'Keep collecting!' },
  ].map(function(c) {
    return '<div style="background:rgba(22,22,38,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid ' + c.color + '20;border-radius:16px;padding:20px;text-align:center;transition:all 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.borderColor=\'' + c.color + '40\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.borderColor=\'' + c.color + '20\'">' +
      '<div style="width:38px;height:38px;border-radius:12px;background:' + c.color + '15;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;">' +
      '<i class="fas ' + c.icon + '" style="color:' + c.color + ';font-size:0.9rem;"></i></div>' +
      '<div style="font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:2px;">' + c.value + '</div>' +
      '<div style="font-size:0.78rem;font-weight:600;color:#94a3b8;">' + c.label + '</div>' +
      '<div style="font-size:0.65rem;color:#475569;margin-top:3px;">' + c.sub + '</div>' +
      '</div>';
  }).join('');

  // Achievements badges — always show all 3 types (clickable to view list below)
  const badgeTypes = [
    { icon: '🏆', color: '#fbbf24', label: 'Super Master', type: 'super-master', count: superMasterCount },
    { icon: '🥈', color: '#a78bfa', label: 'Master',       type: 'master',       count: masterCount },
    { icon: '⭐', color: '#22c55e', label: 'Pro',          type: 'pro',          count: proCount },
  ];
  var achHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px;">';
  achHtml += badgeTypes.map(function(b) {
    var isActive = b.count > 0;
    return '<div onclick="_prShowBadgeList(\'' + b.type + '\')" style="cursor:pointer;background:' + (isActive ? b.color + '08' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (isActive ? b.color + '25' : 'rgba(255,255,255,0.06)') + ';border-radius:16px;padding:22px 16px;text-align:center;transition:all 0.25s;" onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 6px 20px rgba(0,0,0,0.3)\';this.style.borderColor=\'' + b.color + '40\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'none\';this.style.borderColor=\'' + (isActive ? b.color + '25' : 'rgba(255,255,255,0.06)') + '\'">' +
      '<div style="font-size:2rem;margin-bottom:10px;">' + b.icon + '</div>' +
      '<div style="font-size:0.82rem;font-weight:700;color:#fff;margin-bottom:6px;">' + b.label + '</div>' +
      '<div style="font-size:1.5rem;font-weight:800;color:' + b.color + ';">' + b.count + '</div>' +
      '<div style="font-size:0.65rem;color:#64748b;margin-top:4px;">' + (isActive ? 'earned · tap to view' : 'not yet earned') + '</div>' +
      '</div>';
  }).join('');
  achHtml += '</div>';
  achHtml += '<div id="pr-badge-detail-list"></div>';
  document.getElementById('pr-achievements').innerHTML = achHtml;

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
  window._prReportData = { studentName, totalEnrolled, totalCompleted, totalCoins, streakCount, superMasterCount, masterCount, proCount, enrolledCourses, achievements, att };
}

/**
 * Show filtered achievements list when a badge type card is clicked in Parent Report
 */
function _prShowBadgeList(badgeType) {
  var container = document.getElementById('pr-badge-detail-list');
  if (!container) return;

  var achievements = (window._prReportData && window._prReportData.achievements) || [];
  var filtered = achievements.filter(function(a) { return a.badgeType === badgeType; });

  var badgeLabels = { 'super-master': '🏆 Super Master', 'master': '🥈 Master', 'pro': '⭐ Pro' };
  var badgeColors = { 'super-master': '#fbbf24', 'master': '#a78bfa', 'pro': '#22c55e' };
  var label = badgeLabels[badgeType] || badgeType;
  var color = badgeColors[badgeType] || '#fff';

  if (filtered.length === 0) {
    container.innerHTML = '<div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;text-align:center;">' +
      '<div style="font-size:0.85rem;color:var(--muted);">No ' + label + ' badges earned yet.</div>' +
      '<div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">Score 90%+ and rank in top 3 to earn!</div></div>';
    return;
  }

  var html = '<div style="padding:14px;background:rgba(255,255,255,0.02);border:1px solid ' + color + '30;border-radius:12px;">';
  html += '<div style="font-size:0.85rem;font-weight:700;color:' + color + ';margin-bottom:10px;">' + label + ' Badges (' + filtered.length + ')</div>';
  filtered.forEach(function(a) {
    var date = new Date(a.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
    html += '  <div style="width:36px;height:36px;border-radius:10px;background:' + color + '20;border:1px solid ' + color + '40;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">' + (badgeType === 'super-master' ? '🏆' : badgeType === 'master' ? '🥈' : '⭐') + '</div>';
    html += '  <div style="flex:1;">';
    html += '    <div style="font-size:0.82rem;font-weight:600;color:#fff;">' + sanitize(a.title || a.lessonTitle || 'Achievement') + '</div>';
    html += '    <div style="font-size:0.7rem;color:var(--muted);">' + sanitize(a.courseTitle || '') + (a.score ? ' · Score: ' + a.score + '%' : '') + (a.rank ? ' · Rank #' + a.rank : '') + '</div>';
    html += '  </div>';
    html += '  <div style="font-size:0.68rem;color:var(--muted);">' + date + '</div>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
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

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  // Cache-first: show cached orders instantly
  var cached = ckCacheGet('/api/student/orders');
  if (cached && cached.success) {
    loading.style.display = 'none'; content.style.display = 'block';
    _renderOrdersPage(content, cached);
  } else {
    loading.style.display = 'block'; content.style.display = 'none';
  }

  // Background refresh
  try {
    var res = await fetch(BASE_URL + '/api/student/orders', { headers: { Authorization: 'Bearer ' + token } });
    var data = await res.json();
    if (data.success) {
      ckCacheSet('/api/student/orders', data);
      loading.style.display = 'none'; content.style.display = 'block';
      _renderOrdersPage(content, data);
    } else if (!cached) {
      throw new Error(data.message);
    }
  } catch (err) {
    if (!cached) loading.innerHTML = '<p style="color:var(--muted);">Failed to load orders.</p>';
  }
}

function _renderOrdersPage(content, data) {
  var orders = data.orders || [];
  if (orders.length === 0) {
    content.innerHTML = '<div style="text-align:center;padding:50px 20px;">' +
      '<div style="width:64px;height:64px;border-radius:18px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 16px;">\uD83D\uDECD\uFE0F</div>' +
      '<div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:6px;">No orders yet</div>' +
      '<div style="font-size:0.82rem;color:#64748b;max-width:280px;margin:0 auto;line-height:1.5;">Your purchased courses will appear here.</div>' +
      '<button onclick="navigate(\'courses\')" style="margin-top:16px;background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:10px;padding:10px 20px;color:#fff;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'translateY(0)\'">Explore Courses</button>' +
      '</div>';
    return;
  }
  // Summary stats
  var successCount = orders.filter(function(o){return o.status==='success';}).length;
  var pendingFailedCount = orders.filter(function(o){return o.status!=='success';}).length;
  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;">';
  html += '<div style="background:rgba(22,22,38,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(16,185,129,0.12);border-radius:16px;padding:18px;text-align:center;">' +
    '<div style="width:32px;height:32px;border-radius:9px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;"><i class="fas fa-check-circle" style="font-size:0.7rem;color:#6ee7b7;"></i></div>' +
    '<div style="font-size:1.5rem;font-weight:800;color:#fff;">' + successCount + '</div>' +
    '<div style="font-size:0.7rem;color:#64748b;margin-top:2px;">Purchased</div></div>';
  html += '<div style="background:rgba(22,22,38,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(236,72,153,0.12);border-radius:16px;padding:18px;text-align:center;">' +
    '<div style="width:32px;height:32px;border-radius:9px;background:rgba(236,72,153,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;"><i class="fas fa-wallet" style="font-size:0.7rem;color:#f472b6;"></i></div>' +
    '<div style="font-size:1.5rem;font-weight:800;color:#fff;">\u20B9' + data.totalSpent + '</div>' +
    '<div style="font-size:0.7rem;color:#64748b;margin-top:2px;">Total Spent</div></div>';
  html += '<div style="background:rgba(22,22,38,0.75);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(245,158,11,0.12);border-radius:16px;padding:18px;text-align:center;">' +
    '<div style="width:32px;height:32px;border-radius:9px;background:rgba(245,158,11,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;"><i class="fas fa-clock" style="font-size:0.7rem;color:#fbbf24;"></i></div>' +
    '<div style="font-size:1.5rem;font-weight:800;color:#fff;">' + pendingFailedCount + '</div>' +
    '<div style="font-size:0.7rem;color:#64748b;margin-top:2px;">Pending</div></div>';
  html += '</div>';
  // Order list
  html += '<div style="display:flex;flex-direction:column;gap:12px;">';
  orders.forEach(function(o) {
    var statusColor = o.status === 'success' ? '#22c55e' : o.status === 'failed' ? '#ef4444' : '#f59e0b';
    var statusBg = o.status === 'success' ? 'rgba(16,185,129,0.08)' : o.status === 'failed' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)';
    var statusBorder = o.status === 'success' ? 'rgba(16,185,129,0.15)' : o.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
    var statusLabel = o.status === 'success' ? '\u2713 Successful' : o.status === 'failed' ? '\u2717 Failed' : '\u25CF Pending';
    var date = new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    html += '<div style="background:rgba(22,22,38,0.6);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:16px 20px;display:flex;align-items:center;gap:14px;transition:all 0.2s;" onmouseover="this.style.borderColor=\'rgba(139,92,246,0.15)\';this.style.background=\'rgba(22,22,38,0.75)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,0.05)\';this.style.background=\'rgba(22,22,38,0.6)\'">' +
      '<div style="width:42px;height:42px;border-radius:12px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-book" style="font-size:0.8rem;color:#a78bfa;"></i></div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:0.88rem;font-weight:700;color:#fff;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + sanitize(o.courseTitle) + '</div>' +
      '<div style="font-size:0.72rem;color:#64748b;">' + date + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;">' +
      '<div style="font-size:1rem;font-weight:800;color:#fff;margin-bottom:3px;">\u20B9' + o.amount + '</div>' +
      '<span style="font-size:0.65rem;font-weight:600;color:' + statusColor + ';background:' + statusBg + ';border:1px solid ' + statusBorder + ';border-radius:8px;padding:2px 8px;">' + statusLabel + '</span>' +
      '</div>' +
      '</div>';
  });
  html += '</div>';
  content.innerHTML = html;
}

// ─── CK Mall ──────────────────────────────────────────────────────────────────

async function loadMallPage() {
  var loading = document.getElementById('mall-loading');
  var content = document.getElementById('mall-content');
  if (!loading || !content) return;

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  // Cache-first: show cached mall data instantly
  var cached = ckCacheGet('/api/mall');
  if (cached && cached.success) {
    loading.style.display = 'none'; content.style.display = 'block';
    _renderMallPage(content, cached);
  } else {
    loading.style.display = 'block'; content.style.display = 'none';
  }

  // Background refresh
  try {
    var res = await fetch(BASE_URL + '/api/mall', { headers: { Authorization: 'Bearer ' + token } });
    var data = await res.json();
    if (data.success) {
      ckCacheSet('/api/mall', data);
      loading.style.display = 'none'; content.style.display = 'block';
      _renderMallPage(content, data);
    } else if (!cached) {
      throw new Error(data.message);
    }
  } catch (err) {
    if (!cached) loading.innerHTML = '<p style="color:var(--muted);">Failed to load mall.</p>';
  }
}

function _renderMallPage(content, data) {
  var html = '<div style="background:rgba(22,22,38,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(251,191,36,0.12);border-radius:20px;padding:24px;text-align:center;margin-bottom:24px;">' +
    '<div style="font-size:2.5rem;font-weight:800;color:#fbbf24;margin-bottom:4px;">\uD83E\uDE99 ' + data.balance + '</div>' +
    '<div style="font-size:0.82rem;color:#64748b;">Your Coin Balance</div>' +
    '<div style="font-size:0.72rem;color:#475569;margin-top:6px;">Keep learning to earn more rewards!</div></div>';
  html += '<div style="background:rgba(22,22,38,0.6);border:1px solid rgba(139,92,246,0.1);border-radius:16px;padding:20px;margin-bottom:24px;">' +
    '<div style="font-weight:700;color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:0.9rem;"><i class="fas fa-tag" style="color:#a78bfa;font-size:0.75rem;"></i> Have a Coupon?</div>' +
    '<div style="display:flex;gap:10px;"><input id="mall-coupon-input" type="text" placeholder="Enter coupon code" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:11px 14px;color:#fff;font-size:0.85rem;outline:none;text-transform:uppercase;" />' +
    '<button onclick="applyCoupon()" style="background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:12px;padding:11px 20px;color:#fff;font-weight:700;font-size:0.82rem;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'translateY(0)\'">Apply</button></div>' +
    '<div id="mall-coupon-msg" style="display:none;margin-top:8px;font-size:0.82rem;"></div></div>';
  html += '<div style="font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;font-size:0.95rem;"><i class="fas fa-gift" style="color:#fbbf24;font-size:0.8rem;"></i> Redeem Rewards</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';
  (data.offers || []).forEach(function(offer) {
    var opacity = offer.available ? '1' : '0.5';
    html += '<div style="background:rgba(22,22,38,0.6);border:1px solid ' + (offer.available ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)') + ';border-radius:16px;padding:18px;opacity:' + opacity + ';transition:all 0.2s;" ' + (offer.available ? 'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.borderColor=\'rgba(251,191,36,0.25)\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.borderColor=\'rgba(251,191,36,0.12)\'"' : '') + '>' +
      '<div style="font-size:1.5rem;margin-bottom:8px;">' + offer.icon + '</div>' +
      '<div style="font-size:0.85rem;font-weight:700;color:#fff;margin-bottom:4px;">' + offer.title + '</div>' +
      '<div style="font-size:0.72rem;color:#64748b;margin-bottom:14px;line-height:1.4;">' + offer.description + '</div>' +
      '<button onclick="redeemOffer(\'' + offer.id + '\')" ' + (offer.available ? '' : 'disabled') + ' style="background:' + (offer.available ? 'linear-gradient(135deg,#f59e0b,#fbbf24)' : 'rgba(255,255,255,0.06)') + ';border:none;border-radius:10px;padding:9px 14px;color:' + (offer.available ? '#000' : '#64748b') + ';font-size:0.78rem;font-weight:700;cursor:' + (offer.available ? 'pointer' : 'not-allowed') + ';width:100%;transition:all 0.2s;">\uD83E\uDE99 ' + offer.coinsRequired + ' Coins</button>' +
      '</div>';
  });
  html += '</div>';
  content.innerHTML = html;
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
  var moodLabels = ['', '\uD83D\uDE15 Needs improvement', '\uD83D\uDE42 Could be better', '\uD83D\uDE0A It\u2019s good!', '\uD83D\uDE04 Really good!', '\uD83E\uDD29 I love it!'];
  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('span');
    star.textContent = '\u2606';
    star.dataset.value = i;
    star.style.cssText = 'font-size:2.8rem;cursor:pointer;transition:all 0.2s;color:rgba(255,255,255,0.2);user-select:none;';
    star.onmouseover = function() { this.style.transform = 'scale(1.15)'; };
    star.onmouseout = function() { this.style.transform = 'scale(1)'; };
    star.onclick = function() {
      _selectedRating = parseInt(this.dataset.value);
      container.querySelectorAll('span').forEach(function(s) {
        var val = parseInt(s.dataset.value);
        s.textContent = val <= _selectedRating ? '\u2605' : '\u2606';
        s.style.color = val <= _selectedRating ? '#fbbf24' : 'rgba(255,255,255,0.2)';
        s.style.textShadow = val <= _selectedRating ? '0 0 12px rgba(251,191,36,0.4)' : 'none';
      });
      var moodEl = document.getElementById('rate-mood-label');
      if (moodEl) { moodEl.textContent = moodLabels[_selectedRating] || ''; moodEl.style.color = _selectedRating >= 4 ? '#fbbf24' : _selectedRating >= 3 ? '#6ee7b7' : '#f472b6'; }
    };
    container.appendChild(star);
  }
  var msg = document.getElementById('rate-msg');
  if (msg) msg.style.display = 'none';
  var moodEl = document.getElementById('rate-mood-label');
  if (moodEl) moodEl.textContent = '';

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
    reviewsDiv.style.cssText = '';
    content.appendChild(reviewsDiv);
  }

  // Cache-first: show cached ratings instantly
  var cached = ckCacheGet('/api/feedback/app_rating');
  if (cached && cached.success) {
    _renderAppRatings(reviewsDiv, cached);
  } else {
    reviewsDiv.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:0.82rem;padding:12px;"><i class="fas fa-spinner fa-spin"></i> Loading reviews...</div>';
  }

  // Background refresh
  try {
    var res = await fetch(BASE_URL + '/api/feedback/lesson?lessonId=app_rating');
    var data = await res.json();
    if (data.success) {
      ckCacheSet('/api/feedback/app_rating', data);
      _renderAppRatings(reviewsDiv, data);
    } else if (!cached) {
      reviewsDiv.innerHTML = '<div class="card" style="text-align:center;padding:20px;color:var(--muted);font-size:0.85rem;">No reviews yet. Be the first to rate!</div>';
    }
  } catch { if (!cached) reviewsDiv.innerHTML = ''; }
}

function _renderAppRatings(reviewsDiv, data) {
  if (!data.success || data.totalReviews === 0) {
    reviewsDiv.innerHTML = '<div class="card" style="text-align:center;padding:20px;color:var(--muted);font-size:0.85rem;">No reviews yet. Be the first to rate!</div>';
    return;
  }
  var html = '<div style="background:rgba(17,19,34,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.04);border-radius:20px;padding:24px;">';
  html += '<div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.05);">';
  html += '<div style="text-align:center;"><div style="font-size:2.5rem;font-weight:900;color:#fff;">' + data.avgRating + '</div><div style="color:#fbbf24;font-size:0.8rem;margin-top:2px;">\u2605\u2605\u2605\u2605\u2605</div><div style="font-size:0.68rem;color:#64748b;margin-top:4px;">' + data.totalReviews + ' review' + (data.totalReviews > 1 ? 's' : '') + '</div></div>';
  html += '<div style="flex:1;">';
  for (var s = 5; s >= 1; s--) {
    var count = data.ratingCounts[s] || 0;
    var pct = data.totalReviews > 0 ? Math.round(count / data.totalReviews * 100) : 0;
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
    html += '<span style="font-size:0.7rem;color:#94a3b8;width:18px;font-family:monospace;">' + s + '\u2605</span>';
    html += '<div style="flex:1;height:6px;background:rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:linear-gradient(to right,#fbbf24,#f59e0b);border-radius:10px;"></div></div>';
    html += '<span style="font-size:0.68rem;color:#64748b;width:16px;text-align:right;font-family:monospace;">' + count + '</span>';
    html += '</div>';
  }
  html += '</div></div>';
  if (data.reviews && data.reviews.length > 0) {
    html += '<div style="border-top:1px solid rgba(255,255,255,0.05);margin-top:16px;padding-top:16px;">';
    html += '<div style="font-weight:700;font-size:0.85rem;color:#fff;margin-bottom:12px;display:flex;align-items:center;gap:6px;">\uD83D\uDCAC Recent Reviews</div>';
    data.reviews.slice(0, 8).forEach(function(r) {
      var stars = '';
      for (var i = 1; i <= 5; i++) stars += i <= r.rating ? '\u2605' : '\u2606';
      var date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      var initial = (r.studentName || '?').charAt(0).toUpperCase();
      var colors = ['#a78bfa','#f472b6','#67e8f9','#fbbf24','#6ee7b7'];
      var avatarColor = colors[initial.charCodeAt(0) % colors.length];
      html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;margin-bottom:8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:12px;transition:all 0.18s;" onmouseover="this.style.borderColor=\'rgba(139,92,246,0.15)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,0.04)\';this.style.transform=\'translateY(0)\'">';
      html += '<div style="width:32px;height:32px;min-width:32px;border-radius:50%;background:linear-gradient(135deg,' + avatarColor + '40,' + avatarColor + '20);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;color:' + avatarColor + ';">' + initial + '</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">';
      html += '<span style="font-size:0.78rem;font-weight:600;color:#fff;">' + sanitize(r.studentName) + '</span>';
      html += '<span style="font-size:0.65rem;color:#64748b;">' + date + '</span></div>';
      html += '<div style="font-size:0.7rem;color:#fbbf24;margin-bottom:3px;">' + stars + '</div>';
      if (r.feedback) html += '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.4;">\u201C' + sanitize(r.feedback) + '\u201D</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';
  reviewsDiv.innerHTML = html;
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
    return '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;transition:all 0.2s;" onmouseover="this.style.borderColor=\'rgba(251,191,36,0.15)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,0.06)\'">' +
      '<div onclick="helpToggleFaq(' + i + ')" style="padding:12px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);transition:background 0.2s;" id="help-faq-q-' + i + '" onmouseover="this.style.background=\'rgba(251,191,36,0.04)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.02)\'">' +
      '<span style="font-size:0.82rem;font-weight:600;color:#fff;">' + sanitize(f.q) + '</span>' +
      '<i class="fas fa-chevron-down" style="color:#64748b;font-size:0.7rem;transition:transform 0.2s;" id="help-faq-icon-' + i + '"></i>' +
      '</div>' +
      '<div id="help-faq-a-' + i + '" style="display:none;padding:10px 14px;font-size:0.78rem;color:#94a3b8;line-height:1.6;background:rgba(251,191,36,0.02);border-top:1px solid rgba(255,255,255,0.04);">' + sanitize(f.a) + '</div>' +
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

// ─── Achievements Page ───────────────────────────────────────────────────────

async function showAchievements() {
  navigate('achievements');
  const container = document.getElementById('achievements-list');
  if (!container) return;

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    container.innerHTML = '<p style="color:var(--muted)">Please log in to view achievements.</p>';
    return;
  }

  // Cache-first: show cached data instantly (no loading spinner)
  var cached = ckCacheGet('/api/achievements');
  if (cached && cached.success) {
    _renderAchievements(container, cached);
  } else {
    container.innerHTML = '<p style="color:var(--muted)">Loading achievements...</p>';
  }

  // Background refresh
  try {
    const res = await fetch(BASE_URL + '/api/achievements', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json();
    if (data.success) {
      ckCacheSet('/api/achievements', data);
      _renderAchievements(container, data);
      // Update dashboard achievement count
      var certEl = document.getElementById('stat-certificates');
      if (certEl) certEl.innerHTML = String((data.achievements || []).length);
      var topbarAchEl = document.getElementById('topbar-achievements-count');
      if (topbarAchEl) topbarAchEl.textContent = String((data.achievements || []).length);
    }
  } catch {
    if (!cached) container.innerHTML = '<p style="color:var(--danger)">Failed to load achievements.</p>';
  }
}

function _renderAchievements(container, data) {
  // Update header stats
  var statsEl = document.getElementById('achievements-stats');
  if (statsEl && data.achievements) {
    var count = data.achievements.length;
    statsEl.innerHTML = '<span style="font-size:0.82rem;font-weight:600;color:#fbbf24;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:5px 12px;display:flex;align-items:center;gap:5px;">\uD83C\uDFC6 ' + count + ' Badge' + (count !== 1 ? 's' : '') + ' Earned</span>';
  }

  if (data.achievements && data.achievements.length > 0) {
    container.innerHTML = data.achievements.map(function(a) {
      var badgeIcon = a.badgeType === 'super-master' ? '\uD83C\uDFC6' : a.badgeType === 'master' ? '\uD83E\uDD48' : '\u2B50';
      var badgeLabel = a.badgeType === 'super-master' ? 'SUPER MASTER' : a.badgeType === 'master' ? 'MASTER' : 'STAR';
      var badgeColor = a.badgeType === 'super-master' ? '#fbbf24' : a.badgeType === 'master' ? '#a78bfa' : '#22c55e';
      var badgeBg = a.badgeType === 'super-master' ? 'rgba(251,191,36,0.08)' : a.badgeType === 'master' ? 'rgba(168,85,247,0.08)' : 'rgba(34,197,94,0.08)';
      var badgeBorder = a.badgeType === 'super-master' ? 'rgba(251,191,36,0.2)' : a.badgeType === 'master' ? 'rgba(168,85,247,0.2)' : 'rgba(34,197,94,0.2)';
      var glowColor = a.badgeType === 'super-master' ? 'rgba(251,191,36,0.12)' : a.badgeType === 'master' ? 'rgba(168,85,247,0.12)' : 'rgba(34,197,94,0.12)';
      var date = new Date(a.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      return '<div style="position:relative;background:rgba(22,22,38,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid ' + badgeBorder + ';border-radius:22px;padding:28px 30px;transition:all 0.3s ease;overflow:hidden;" onmouseover="this.style.transform=\'translateY(-3px)\';this.style.borderColor=\'' + badgeColor + '50\';this.style.boxShadow=\'0 12px 30px ' + glowColor + '\'" onmouseout="this.style.transform=\'translateY(0)\';this.style.borderColor=\'' + badgeBorder + '\';this.style.boxShadow=\'none\'">' +
        '<!-- Ambient glow -->' +
        '<div style="position:absolute;top:-40%;right:-10%;width:180px;height:180px;background:radial-gradient(circle,' + glowColor + ',transparent 70%);pointer-events:none;"></div>' +
        '<!-- Sparkle particles -->' +
        '<div style="position:absolute;top:12%;right:15%;width:3px;height:3px;background:' + badgeColor + ';border-radius:50%;opacity:0.5;box-shadow:0 0 4px ' + badgeColor + ';"></div>' +
        '<div style="position:absolute;top:20%;right:25%;width:2px;height:2px;background:' + badgeColor + ';border-radius:50%;opacity:0.3;box-shadow:0 0 3px ' + badgeColor + ';"></div>' +
        '<div style="position:absolute;bottom:25%;right:8%;width:2px;height:2px;background:' + badgeColor + ';border-radius:50%;opacity:0.4;box-shadow:0 0 3px ' + badgeColor + ';"></div>' +
        '<!-- Main layout -->' +
        '<div style="display:flex;gap:24px;align-items:flex-start;">' +
        '<!-- Badge icon -->' +
        '<div style="width:72px;min-width:72px;height:72px;border-radius:20px;background:' + badgeBg + ';border:1px solid ' + badgeBorder + ';display:flex;align-items:center;justify-content:center;font-size:2rem;box-shadow:0 4px 16px rgba(0,0,0,0.2),0 0 12px ' + glowColor + ';">' + badgeIcon + '</div>' +
        '<!-- Details -->' +
        '<div style="flex:1;min-width:0;">' +
        '<!-- Badge type label -->' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="font-size:0.65rem;font-weight:800;color:' + badgeColor + ';background:' + badgeBg + ';border:1px solid ' + badgeBorder + ';border-radius:6px;padding:3px 8px;letter-spacing:1px;text-transform:uppercase;">' + badgeLabel + '</span>' +
        '<span style="font-size:0.65rem;color:#64748b;font-weight:500;">\u2713 EARNED</span>' +
        '</div>' +
        '<!-- Title -->' +
        '<h4 style="color:#fff;font-weight:800;font-size:1.1rem;margin:0 0 4px;">' + sanitize(a.title) + '</h4>' +
        '<!-- Course info -->' +
        '<div style="font-size:0.8rem;color:#94a3b8;margin-bottom:14px;">' + sanitize(a.lessonTitle) + ' \u00b7 ' + sanitize(a.courseTitle) + '</div>' +
        '<!-- Score + Rank blocks -->' +
        '<div style="display:flex;gap:12px;margin-bottom:14px;">' +
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 18px;text-align:center;min-width:80px;">' +
        '<div style="font-size:0.65rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Score</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:#4ade80;">' + a.score + '%</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 18px;text-align:center;min-width:80px;">' +
        '<div style="font-size:0.65rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Rank</div>' +
        '<div style="font-size:1.2rem;font-weight:800;color:' + badgeColor + ';">#' + a.rank + '</div>' +
        '</div>' +
        '</div>' +
        '<!-- Meta info -->' +
        '<div style="font-size:0.75rem;color:#64748b;line-height:1.8;">' +
        'Awarded to: <span style="color:#fff;font-weight:600;">' + sanitize(a.studentName) + '</span><br/>' +
        'Instructor: ' + sanitize(a.instructor) + ' \u00b7 ' + date +
        '</div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }).join('');
  } else {
    container.innerHTML = '<div style="text-align:center;padding:60px 20px;">' +
      '<div style="width:80px;height:80px;border-radius:22px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.15);display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin:0 auto 20px;box-shadow:0 4px 16px rgba(0,0,0,0.2);">\uD83C\uDFC6</div>' +
      '<h3 style="color:#fff;font-weight:700;font-size:1.1rem;margin:0 0 8px;">Your trophy shelf is empty</h3>' +
      '<p style="color:#94a3b8;font-size:0.85rem;margin:0 0 20px;max-width:320px;margin-left:auto;margin-right:auto;line-height:1.5;">Complete quizzes and climb the leaderboard to earn your first achievement!</p>' +
      '<button onclick="navigate(\'courses\')" style="background:linear-gradient(135deg,#a855f7,#6366f1);color:#fff;font-size:0.82rem;font-weight:700;padding:10px 20px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;box-shadow:0 4px 12px rgba(139,92,246,0.3);transition:all 0.2s;" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'">Start Learning \u2192</button>' +
      '</div>';
  }
}

// ─── Student Progress Feature ──────────────────────────────────────────────

async function loadStudentProgress() {
  var loading = document.getElementById('student-progress-loading');
  var content = document.getElementById('student-progress-content');
  if (!loading || !content) return;

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    loading.innerHTML = '<p style="color:var(--muted)">Please log in to view progress.</p>';
    loading.style.display = 'block'; content.style.display = 'none';
    return;
  }

  // Cache-first: show cached progress instantly
  var cached = ckCacheGet('/api/student/progress');
  if (cached && cached.success) {
    loading.style.display = 'none'; content.style.display = 'block';
    _renderStudentProgress(cached);
  } else {
    loading.style.display = 'block'; content.style.display = 'none';
  }

  // Background refresh
  try {
    var res = await fetch(BASE_URL + '/api/student/progress', {
      headers: { Authorization: 'Bearer ' + token },
    });
    var data = await res.json();
    if (data.success) {
      ckCacheSet('/api/student/progress', data);
      loading.style.display = 'none'; content.style.display = 'block';
      _renderStudentProgress(data);
    } else if (!cached) {
      throw new Error(data.message || 'Failed to load progress.');
    }
  } catch (err) {
    if (!cached) {
      loading.innerHTML = '<div style="text-align:center;padding:40px;">' +
        '<i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--danger);margin-bottom:12px;display:block;"></i>' +
        '<p style="color:var(--muted)">' + sanitize(err.message || 'Failed to load progress.') + '</p>' +
        '<button class="btn btn-outline btn-sm" onclick="loadStudentProgress()" style="margin-top:12px;">Retry</button></div>';
    }
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
  var overallHtml = '<div style="background:rgba(22,22,38,0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(139,92,246,0.15);border-radius:20px;padding:28px;margin-bottom:24px;position:relative;overflow:hidden;">' +
    '<div style="position:absolute;top:-30%;right:-5%;width:150px;height:150px;background:radial-gradient(circle,rgba(139,92,246,0.06),transparent 65%);pointer-events:none;"></div>' +
    '<div style="text-align:center;margin-bottom:20px;position:relative;z-index:1;">' +
    '<div style="font-size:0.72rem;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Overall Performance</div>' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">' + _renderStars(data.overallRating) + '</div>' +
    '<div style="font-size:2rem;font-weight:800;color:#fff;">' + data.overallRating + ' / 5</div>' +
    '<div style="font-size:0.78rem;color:#64748b;margin-top:4px;">Score: <span style="color:#a78bfa;font-weight:700;">' + data.overallScore + '%</span></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;position:relative;z-index:1;">' +
    '<div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.12);border-radius:14px;padding:14px;text-align:center;">' +
    '<div style="font-size:1.2rem;font-weight:800;color:#fff;">' + data.totalLessonsCompleted + ' / ' + data.totalLessons + '</div>' +
    '<div style="font-size:0.68rem;color:#64748b;margin-top:3px;">Lessons Completed</div></div>' +
    '<div style="background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.12);border-radius:14px;padding:14px;text-align:center;">' +
    '<div style="font-size:1.2rem;font-weight:800;color:#fff;">' + data.courses.length + '</div>' +
    '<div style="font-size:0.68rem;color:#64748b;margin-top:3px;">Courses</div></div>' +
    '</div>' +
    '<div style="text-align:center;position:relative;z-index:1;"><span onclick="document.getElementById(\'sp-rating-detail\').style.display=document.getElementById(\'sp-rating-detail\').style.display===\'none\'?\'block\':\'none\'" style="font-size:0.75rem;color:#a78bfa;cursor:pointer;font-weight:600;">▼ View Rating Breakdown</span></div>' +
    // Rating breakdown (expandable)
    '<div id="sp-rating-detail" style="display:none;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
    // Quiz rating
    '<div style="background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.1);border-radius:16px;padding:18px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><i class="fas fa-brain" style="color:#a78bfa;font-size:0.8rem;"></i><span style="font-weight:700;color:#fff;font-size:0.88rem;">Quiz Performance</span></div>' +
    '<div style="margin-bottom:8px;">' + _renderStars(data.ratingBreakdown.quiz.rating) + ' <span style="color:#fff;font-weight:700;margin-left:4px;">' + data.ratingBreakdown.quiz.rating + '/5</span></div>' +
    '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.8;">' +
    'Accuracy: <strong style="color:#4ade80;">' + data.ratingBreakdown.quiz.accuracy + '%</strong><br/>' +
    'Attempted: ' + data.ratingBreakdown.quiz.attempted + ' / ' + data.ratingBreakdown.quiz.totalQuizzes + '<br/>' +
    'Correct: ' + data.ratingBreakdown.quiz.correct +
    '</div></div>' +
    // Exercise rating
    '<div style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.1);border-radius:16px;padding:18px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><i class="fas fa-code" style="color:#6ee7b7;font-size:0.8rem;"></i><span style="font-weight:700;color:#fff;font-size:0.88rem;">Exercise Performance</span></div>' +
    '<div style="margin-bottom:8px;">' + _renderStars(data.ratingBreakdown.exercise.rating) + ' <span style="color:#fff;font-weight:700;margin-left:4px;">' + data.ratingBreakdown.exercise.rating + '/5</span></div>' +
    '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.8;">' +
    'Pass Rate: <strong style="color:#4ade80;">' + data.ratingBreakdown.exercise.passRate + '%</strong><br/>' +
    'Attempted: ' + data.ratingBreakdown.exercise.attempted + ' / ' + data.ratingBreakdown.exercise.totalExercises + '<br/>' +
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
    if (data.success) {
      // Show success state on button
      var btn = document.getElementById('vp-rate-submit-btn');
      if(btn) {
        btn.textContent = '✓ Submitted';
        btn.style.background = '#22c55e';
        btn.style.boxShadow = '0 0 12px rgba(34,197,94,0.3)';
        setTimeout(function() {
          btn.textContent = 'Submit';
          btn.style.background = 'linear-gradient(135deg,#6c47ff,#ec4899)';
          btn.style.boxShadow = 'none';
        }, 500);
      }
    }
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = data.success ? '#22c55e' : '#ef4444';
      msg.textContent = data.success ? '🎉 Thank you! Your rating has been submitted.' : '❌ ' + (data.message || 'Failed');
    }
  } catch { if (msg) { msg.style.display = 'block'; msg.style.color = '#ef4444'; msg.textContent = 'Network error'; } }
}
