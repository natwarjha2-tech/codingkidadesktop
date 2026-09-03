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

  // Time KPI values: show a dash for genuinely-zero activity instead of a
  // misleading "0 min" (real attendance data only — never fabricated).
  var _spFmtTime = function(mins) { return (!mins || mins <= 0) ? '\u2014' : _fmtMins(mins); };

  // Active days in the CURRENT calendar week (Mon–Sun) — unique active dates from
  // Monday through today, out of 7. Uses the same real attendance calendar records.
  var _wkToday = new Date();
  var _wkDow = _wkToday.getDay();                 // 0=Sun..6=Sat
  var _wkMondayOffset = _wkDow === 0 ? 6 : _wkDow - 1;  // days since Monday
  var _wkMonday = new Date(_wkToday); _wkMonday.setDate(_wkToday.getDate() - _wkMondayOffset); _wkMonday.setHours(0,0,0,0);
  var _weekActiveDays = 0;
  (att.calendar || []).forEach(function(rec) {
    if (!rec || !rec.active || !rec.date) return;
    var p = String(rec.date).split('-');
    if (p.length !== 3) return;
    var rd = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    rd.setHours(0,0,0,0);
    if (rd >= _wkMonday && rd <= _wkToday) _weekActiveDays++;
  });

  // Summary cards
  const summaryCards = [
    { icon: 'fa-book-open',     color: '#8B5CF6', label: 'Courses Enrolled',  value: totalEnrolled,             sub: 'total' },
    { icon: 'fa-check-circle',  color: '#22C55E', label: 'Lessons Completed', value: totalCompleted,            sub: 'all time' },
    { icon: 'fa-clock',         color: '#F59E0B', label: 'Today',             value: _spFmtTime(att.todayMins), sub: (att.todayMins > 0 ? 'learning time' : 'no activity yet') },
    { icon: 'fa-calendar-week', color: '#EC4899', label: 'This Week',         value: _spFmtTime(att.weekMins),  sub: _weekActiveDays + ' active days / 7' },
  ];
  document.getElementById('pr-summary-cards').innerHTML = summaryCards.map(function(c) {
    return '<div class="pr-kpi" style="--kpi:' + c.color + ';" onmouseover="this.style.borderColor=\'' + c.color + '45\'" onmouseout="this.style.borderColor=\'\'">' +
      '<div class="pr-kpi-glow" style="background:radial-gradient(circle,' + c.color + '12,transparent 70%);"></div>' +
      '<div class="pr-kpi-ic" style="background:' + c.color + '18;border-color:' + c.color + '30;box-shadow:0 0 10px ' + c.color + '14;">' +
      '<i class="fas ' + c.icon + '" style="color:' + c.color + ';"></i></div>' +
      '<div class="pr-kpi-body">' +
      '<div class="pr-kpi-value">' + c.value + '</div>' +
      '<div class="pr-kpi-label">' + c.label + '</div>' +
      '<div class="pr-kpi-sub">' + c.sub + '</div>' +
      '</div>' +
      '</div>';
  }).join('');

  // Attendance calendar
  var attMeta = document.getElementById('pr-attendance-meta');
  var attCal = document.getElementById('pr-attendance-calendar');
  if (attMeta) attMeta.textContent = '';
  if (attCal) {
    var today = new Date();
    var curYear = today.getFullYear();
    var curMonth = today.getMonth(); // 0-based
    var todayDate = today.getDate();
    var monthNamesShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Map real attendance records by their exact calendar date.
    // rec.date is a 'YYYY-MM-DD' string produced by _attendanceGetSummary(); we
    // parse its own year/month/day so matching is timezone-consistent with the
    // data source (no fabrication, no re-calculation, no activity moved).
    var attByYmd = {};
    (att.calendar || []).forEach(function(rec) {
      if (rec && rec.date) {
        var p = String(rec.date).split('-'); // [YYYY, MM, DD]
        if (p.length === 3) attByYmd[Number(p[0]) + ':' + Number(p[1]) + ':' + Number(p[2])] = rec;
      }
    });

    // Active Days for the DISPLAYED calendar month only. Denominator = real number
    // of days in that month (not a fixed 30). Counts unique active dates within the
    // month, excluding future dates, from the same real attendance records.
    var daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
    var monthActiveDays = 0;
    for (var mad = 1; mad <= daysInMonth; mad++) {
      if (mad > todayDate) break; // future dates never active (current month)
      var madRec = attByYmd[curYear + ':' + (curMonth + 1) + ':' + mad];
      if (madRec && madRec.active) monthActiveDays++;
    }

    // Stats strip — Active Days for the displayed month (X / days-in-month), centered
    var statsHtml = '<div style="display:flex;justify-content:center;margin-bottom:18px;">' +
      '<div style="background:rgba(139,92,246,0.05);border:1px solid rgba(139,92,246,0.1);border-radius:10px;padding:10px 24px;text-align:center;min-width:150px;">' +
      '<div style="font-size:1rem;font-weight:800;color:#fff;">' + monthActiveDays + ' <span style="font-size:0.7rem;font-weight:500;color:#64748b;">/ ' + daysInMonth + '</span></div>' +
      '<div style="font-size:0.65rem;color:#64748b;margin-top:2px;">Active Days</div></div>' +
      '</div>';

    // Weekday header (Mon-first)
    var weekdayHtml = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;text-align:center;">';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(d) { weekdayHtml += '<span style="font-size:0.6rem;font-weight:600;color:#64748b;">' + d + '</span>'; });
    weekdayHtml += '</div>';

    // Real month grid: leading pad (Mon-first) + day 1..lastDay of current month only.
    var firstDow = new Date(curYear, curMonth, 1).getDay(); // 0=Sun
    var startPad = firstDow === 0 ? 6 : firstDow - 1;        // Mon-first offset
    var lastDay = new Date(curYear, curMonth + 1, 0).getDate();

    var cellsHtml = '';
    for (var pi = 0; pi < startPad; pi++) { cellsHtml += '<div style="width:44px;height:44px;"></div>'; }

    for (var dnum = 1; dnum <= lastDay; dnum++) {
      var key = curYear + ':' + (curMonth + 1) + ':' + dnum;
      var rec = attByYmd[key];
      var mins = rec ? (rec.mins || 0) : 0;
      var active = rec ? !!rec.active : false;
      var isToday = dnum === todayDate;
      var isFuture = dnum > todayDate;

      if (isFuture) {
        cellsHtml += '<div title="Plan your coding!" style="width:44px;height:44px;border-radius:8px;background:rgba(15,15,30,0.6);border:1px dashed rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;font-size:0.68rem;color:rgba(100,116,139,0.5);font-weight:500;transition:all 0.18s;margin:0 auto;" onmouseover="this.style.borderColor=\'rgba(139,92,246,0.35)\';this.style.color=\'rgba(139,92,246,0.6)\'" onmouseout="this.style.borderColor=\'rgba(139,92,246,0.15)\';this.style.color=\'rgba(100,116,139,0.5)\'">' + dnum + '</div>';
        continue;
      }

      var displayMins = Math.min(mins, 1440);
      var intensity = mins === 0 ? 0 : mins < 15 ? 0.3 : mins < 30 ? 0.6 : 1;
      var bg, borderColor, textColor, shadow;
      if (!active) { bg = 'rgba(255,255,255,0.03)'; borderColor = 'rgba(255,255,255,0.07)'; textColor = '#94A3B8'; shadow = 'none'; }
      else if (intensity <= 0.3) { bg = 'rgba(124,58,237,0.25)'; borderColor = 'rgba(124,58,237,0.3)'; textColor = '#C4B5FD'; shadow = 'none'; }
      else if (intensity <= 0.6) { bg = 'linear-gradient(135deg,#7C3AED,#A855F7)'; borderColor = 'rgba(168,85,247,0.4)'; textColor = '#fff'; shadow = '0 0 8px rgba(168,85,247,0.2)'; }
      else { bg = 'linear-gradient(135deg,#A855F7,#EC4899)'; borderColor = 'rgba(236,72,153,0.4)'; textColor = '#fff'; shadow = '0 0 12px rgba(236,72,153,0.4)'; }
      if (isToday) { borderColor = '#A78BFA'; shadow = (shadow === 'none' ? '' : shadow + ',') + '0 0 0 2px rgba(167,139,250,0.4)'; if (!active) { bg = 'rgba(139,92,246,0.1)'; textColor = '#A78BFA'; } }

      var titleTxt = monthNamesShort[curMonth] + ' ' + dnum + ', ' + curYear + (displayMins > 0 ? ' \u00b7 ' + _fmtMins(displayMins) : (isToday ? ' \u00b7 Today' : ''));
      cellsHtml += '<div title="' + titleTxt + '" style="width:44px;height:44px;border-radius:8px;background:' + bg + ';border:1px solid ' + borderColor + ';display:flex;align-items:center;justify-content:center;font-size:0.68rem;color:' + textColor + ';font-weight:' + (isToday || active ? '700' : '500') + ';box-shadow:' + shadow + ';transition:all 0.18s ease;margin:0 auto;" onmouseover="this.style.transform=\'scale(1.1)\'" onmouseout="this.style.transform=\'scale(1)\'">' + dnum + '</div>';
    }

    // Legend (single, clean, centered)
    var legendHtml = '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:14px;font-size:0.62rem;color:#64748B;">' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:rgba(15,15,30,0.6);border:1px solid rgba(100,116,139,0.15);"></span> Inactive</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:rgba(88,28,135,0.5);"></span> Started</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#6D28D9,#7C3AED);"></span> Focused</span>' +
      '<span style="display:flex;align-items:center;gap:4px;"><span style="width:9px;height:9px;border-radius:3px;background:linear-gradient(135deg,#A855F7,#EC4899);box-shadow:0 0 6px rgba(236,72,153,0.4);"></span> On Fire</span>' +
      '</div>';

    // Month label — matches the month being rendered
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var monthLabel = '<div style="font-size:0.72rem;font-weight:600;color:#94A3B8;letter-spacing:0.5px;margin-bottom:10px;text-align:center;">' + monthNames[curMonth] + ' ' + curYear + '</div>';

    attCal.innerHTML = statsHtml +
      '<div style="background:rgba(19,21,40,0.5);padding:16px 18px;border-radius:14px;border:1px solid rgba(255,255,255,0.04);">' +
      monthLabel + weekdayHtml +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;place-items:center;">' + cellsHtml + '</div>' +
      legendHtml + '</div>';
  }

  // Motivational message + Next Mission
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

  // Quick stats (compact horizontal rows in the side panel)
  document.getElementById('pr-stats-row').innerHTML = [
    { icon: 'fa-fire',   color: '#ef4444', label: 'Weekly Streak', value: streakCount,         sub: 'Keep it going!' },
    { icon: 'fa-coins',  color: '#ec4899', label: 'Coins Earned',  value: totalCoins,          sub: 'Great progress!' },
    { icon: 'fa-medal',  color: '#a78bfa', label: 'Achievements',  value: achievements.length, sub: 'Keep collecting!' },
  ].map(function(c) {
    return '<div class="pr-stat-item" style="border-color:' + c.color + '1f;" onmouseover="this.style.borderColor=\'' + c.color + '45\';this.style.transform=\'translateX(2px)\'" onmouseout="this.style.borderColor=\'' + c.color + '1f\';this.style.transform=\'translateX(0)\'">' +
      '<div class="pr-stat-ic" style="background:' + c.color + '18;"><i class="fas ' + c.icon + '" style="color:' + c.color + ';"></i></div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div class="pr-stat-label">' + c.label + '</div>' +
      '<div class="pr-stat-sub">' + c.sub + '</div>' +
      '</div>' +
      '<div class="pr-stat-value" style="color:' + c.color + ';">' + c.value + '</div>' +
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

// Orders view state (frontend-only: filter/sort/pagination over already-loaded data)
var _ordState = { data: null, page: 1, perPage: 6, search: '', filter: 'all', sort: 'latest' };

// Course logo/identity for an order (reuse existing real assets; fallback to themed icon)
function _ordCourseLogo(title) {
  var ct = (title || '').toLowerCase().trim();
  var img = function(src, bg, bd){ return { html: '<img src="' + src + '" alt="" style="width:30px;height:30px;object-fit:contain;" onerror="this.style.display=\'none\'"/>', bg: bg, border: bd }; };
  if (ct.includes('java') && !ct.includes('javascript')) return img('assets/java-logo.png', 'rgba(249,115,22,0.12)', 'rgba(249,115,22,0.25)');
  if (ct.includes('python')) return img('assets/python-logo.png', 'rgba(16,185,129,0.12)', 'rgba(16,185,129,0.25)');
  if (ct === 'c' || ct.indexOf('c ') === 0 || ct.includes('c programming') || ct.includes('c lang')) return img('assets/c-logo.png', 'rgba(34,211,238,0.12)', 'rgba(34,211,238,0.25)');
  var fa = 'fas fa-book';
  if (ct.includes('javascript') || ct.includes(' js')) fa = 'fab fa-js';
  else if (ct.includes('html') || ct.includes('web')) fa = 'fab fa-html5';
  else if (ct.includes('react')) fa = 'fab fa-react';
  else if (ct.includes('node')) fa = 'fab fa-node-js';
  return { html: '<i class="' + fa + '" style="font-size:1.1rem;color:#a78bfa;"></i>', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.2)' };
}

function _renderOrdersPage(content, data) {
  _ordState.data = data;
  _ordState.page = 1;
  // Keep the user's active search/filter if the header controls still hold them
  // (this runs on both cache + fresh render); otherwise defaults apply.
  var s = document.getElementById('ord-search-input');
  var f = document.getElementById('ord-filter-select');
  _ordState.search = s ? s.value.toLowerCase().trim() : '';
  _ordState.filter = f ? f.value : 'all';
  _ordRenderView(content);
}

// Filter/sort/paginate handler wired to header controls + pagination
function _ordApplyFilters() {
  var content = document.getElementById('orders-content');
  if (!content || !_ordState.data) return;
  var s = document.getElementById('ord-search-input');
  var f = document.getElementById('ord-filter-select');
  var sort = document.getElementById('ord-sort-select');
  if (s) _ordState.search = s.value.toLowerCase().trim();
  if (f) _ordState.filter = f.value;
  if (sort) _ordState.sort = sort.value;
  _ordState.page = 1;
  _ordRenderView(content);
}
function _ordGoToPage(p) {
  _ordState.page = p;
  var content = document.getElementById('orders-content');
  if (content) _ordRenderView(content);
}

function _ordRenderView(content) {
  var data = _ordState.data || {};
  var allOrders = data.orders || [];

  if (allOrders.length === 0) {
    content.innerHTML = '<div style="text-align:center;padding:50px 20px;">' +
      '<div style="width:64px;height:64px;border-radius:18px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 16px;">\uD83D\uDECD\uFE0F</div>' +
      '<div style="font-size:1rem;font-weight:700;color:#fff;margin-bottom:6px;">No orders yet</div>' +
      '<div style="font-size:0.82rem;color:#64748b;max-width:280px;margin:0 auto;line-height:1.5;">Your purchased courses will appear here.</div>' +
      '<button onclick="navigate(\'courses\')" style="margin-top:16px;background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:10px;padding:10px 20px;color:#fff;font-size:0.8rem;font-weight:600;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.transform=\'translateY(0)\'">Explore Courses</button>' +
      '</div>';
    return;
  }

  // Stable order-number map (oldest order = #0001) — deterministic label over real orders
  var byOldest = allOrders.slice().sort(function(a, b){ return new Date(a.createdAt) - new Date(b.createdAt); });
  var orderNumMap = {};
  byOldest.forEach(function(o, i){ orderNumMap[o.id] = i + 1; });

  // Summary stats (unchanged real values)
  var successCount = allOrders.filter(function(o){ return o.status === 'success'; }).length;
  var pendingCount = allOrders.filter(function(o){ return o.status !== 'success'; }).length;

  // Apply search + filter
  var filtered = allOrders.filter(function(o) {
    if (_ordState.filter !== 'all' && o.status !== _ordState.filter) return false;
    if (_ordState.search) {
      var q = _ordState.search; // already lowercased + trimmed
      var title = (o.courseTitle || '').toLowerCase();
      var orderNum = String(orderNumMap[o.id] || 0);
      var fullId = ('ckd-ord-' + orderNum.padStart(4, '0'));
      // Match course title always. Match the order ID only when the query looks
      // like an ID query (contains a digit, '#', or 'ord'/'ckd') — otherwise a
      // plain letter like "c" would match every order via the "ckd-ord" prefix.
      var isIdQuery = /[0-9#]/.test(q) || q.indexOf('ord') !== -1 || q.indexOf('ckd') !== -1;
      var matchTitle = title.indexOf(q) !== -1;
      var matchId = isIdQuery && ('#' + fullId).indexOf(q.replace(/\s+/g, '')) !== -1;
      if (!matchTitle && !matchId) return false;
    }
    return true;
  });
  // Sort
  filtered.sort(function(a, b) {
    return _ordState.sort === 'oldest'
      ? new Date(a.createdAt) - new Date(b.createdAt)
      : new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Pagination
  var total = filtered.length;
  var perPage = _ordState.perPage;
  var totalPages = Math.max(1, Math.ceil(total / perPage));
  if (_ordState.page > totalPages) _ordState.page = totalPages;
  var startIdx = (_ordState.page - 1) * perPage;
  var pageOrders = filtered.slice(startIdx, startIdx + perPage);

  // ── KPI cards ──
  var kpi = function(icon, accent, value, label, sub) {
    return '<div class="ord-kpi" style="--ac:' + accent + ';" onmouseover="this.style.borderColor=\'' + accent + '45\'" onmouseout="this.style.borderColor=\'\'">' +
      '<div class="ord-kpi-ic" style="background:' + accent + '18;border-color:' + accent + '30;"><i class="fas ' + icon + '" style="color:' + accent + ';"></i></div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div class="ord-kpi-value">' + value + '</div>' +
      '<div class="ord-kpi-label">' + label + '</div>' +
      '<div class="ord-kpi-sub">' + sub + '</div>' +
      '</div></div>';
  };
  var html = '<div class="ord-kpi-grid">' +
    kpi('fa-shopping-bag', '#22c55e', successCount, 'Purchased', 'Total orders') +
    kpi('fa-wallet', '#ec4899', '\u20B9' + (data.totalSpent || 0), 'Total Spent', 'Across all orders') +
    kpi('fa-clock', '#f59e0b', pendingCount, 'Pending', 'Awaiting completion') +
    '</div>';

  // ── Order History header + sort ──
  html += '<div class="ord-history-head">' +
    '<span style="font-size:1.05rem;font-weight:700;color:#fff;">Order History</span>' +
    '<div class="ord-sort"><span style="font-size:0.72rem;color:#64748b;">Sort by:</span>' +
    '<select id="ord-sort-select" onchange="_ordApplyFilters()">' +
    '<option value="latest"' + (_ordState.sort === 'latest' ? ' selected' : '') + '>Latest First</option>' +
    '<option value="oldest"' + (_ordState.sort === 'oldest' ? ' selected' : '') + '>Oldest First</option>' +
    '</select></div></div>';

  // ── Order cards ──
  if (pageOrders.length === 0) {
    html += '<div style="text-align:center;padding:44px 20px;">' +
      '<div style="width:56px;height:56px;border-radius:16px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.18);display:flex;align-items:center;justify-content:center;font-size:1.3rem;color:#a78bfa;margin:0 auto 14px;"><i class="fas fa-search"></i></div>' +
      '<div style="font-size:0.95rem;font-weight:700;color:#fff;margin-bottom:6px;">No orders found</div>' +
      '<div style="font-size:0.8rem;color:#64748b;max-width:300px;margin:0 auto;line-height:1.5;">Try a different search term or change the filter.</div>' +
      '</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:12px;">';
    pageOrders.forEach(function(o) {
      var isSuccess = o.status === 'success';
      var isFailed = o.status === 'failed';
      var accent = isSuccess ? '#22c55e' : isFailed ? '#ef4444' : '#f59e0b';
      var statusBg = isSuccess ? 'rgba(16,185,129,0.1)' : isFailed ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';
      var statusBorder = isSuccess ? 'rgba(16,185,129,0.25)' : isFailed ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)';
      var statusLabel = isSuccess ? '\u2713 Successful' : isFailed ? '\u2717 Failed' : '\u25CF Pending';
      var d = new Date(o.createdAt);
      var dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      var timeStr = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
      var orderId = '#CKD-ORD-' + String(orderNumMap[o.id] || 0).padStart(4, '0');
      var logo = _ordCourseLogo(o.courseTitle);

      html += '<div class="ord-card" style="border-left:3px solid ' + accent + ';">' +
        '<div class="ord-card-logo" style="background:' + logo.bg + ';border-color:' + logo.border + ';">' + logo.html + '</div>' +
        '<div class="ord-card-mid">' +
        '<div class="ord-card-title">' + sanitize(o.courseTitle) + '</div>' +
        '<div class="ord-card-oid">Order ID: ' + orderId + '</div>' +
        '<div class="ord-card-date"><i class="far fa-calendar" style="font-size:0.66rem;"></i> ' + dateStr + ' \u2022 ' + timeStr + '</div>' +
        '</div>' +
        '<div class="ord-card-right">' +
        '<div class="ord-card-price">\u20B9' + o.amount + '</div>' +
        '<span class="ord-status" style="color:' + accent + ';background:' + statusBg + ';border-color:' + statusBorder + ';">' + statusLabel + '</span>' +
        '</div>' +
        '<button class="ord-details-btn" onclick="' + (o.courseId ? 'openCourseDetail(\'' + o.courseId + '\')' : 'navigate(\'courses\')') + '">View Details <i class="fas fa-chevron-right" style="font-size:0.62rem;"></i></button>' +
        '</div>';
    });
    html += '</div>';
  }

  // ── Footer: count + pagination ──
  var showFrom = total === 0 ? 0 : startIdx + 1;
  var showTo = Math.min(startIdx + perPage, total);
  html += '<div class="ord-footer">' +
    '<span style="font-size:0.75rem;color:#64748b;">Showing ' + showFrom + ' to ' + showTo + ' of ' + total + ' orders</span>';
  if (totalPages > 1) {
    html += '<div class="ord-pagination">';
    html += '<button class="ord-page-btn" ' + (_ordState.page <= 1 ? 'disabled' : 'onclick="_ordGoToPage(' + (_ordState.page - 1) + ')"') + '><i class="fas fa-chevron-left"></i></button>';
    for (var p = 1; p <= totalPages; p++) {
      html += '<button class="ord-page-btn ' + (p === _ordState.page ? 'ord-page-active' : '') + '" onclick="_ordGoToPage(' + p + ')">' + p + '</button>';
    }
    html += '<button class="ord-page-btn" ' + (_ordState.page >= totalPages ? 'disabled' : 'onclick="_ordGoToPage(' + (_ordState.page + 1) + ')"') + '><i class="fas fa-chevron-right"></i></button>';
    html += '</div>';
  }
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

// Accent theme per reward type (visual only — derived from existing offer data)
function _rwAccent(offer) {
  var t = ((offer.title || '') + ' ' + (offer.description || '')).toLowerCase();
  var faIcon = 'fa-gift';
  var color = '#a78bfa';
  if (t.includes('10%')) { color = '#a78bfa'; faIcon = 'fa-ticket-alt'; }
  else if (t.includes('25%') || t.includes('discount')) { color = '#ec4899'; faIcon = 'fa-tag'; }
  else if (t.includes('free') || t.includes('access')) { color = '#22c55e'; faIcon = 'fa-gift'; }
  else if (t.includes('certificate') || t.includes('frame')) { color = '#3b82f6'; faIcon = 'fa-award'; }
  else if (t.includes('doubt') || t.includes('1-on-1') || t.includes('instructor') || t.includes('session')) { color = '#f59e0b'; faIcon = 'fa-user-graduate'; }
  return { color: color, faIcon: faIcon };
}

function _renderMallPage(content, data) {
  var balance = (typeof data.balance !== 'undefined' && data.balance !== null) ? data.balance : 0;

  // ── 1. Coin balance hero ──
  var html = '<div class="rw-hero">' +
    '<div class="rw-hero-glow"></div>' +
    '<div class="rw-hero-left">' +
    '<div class="rw-hero-coin"><i class="fas fa-coins"></i></div>' +
    '<div>' +
    '<div class="rw-hero-label">Your Coins</div>' +
    '<div class="rw-hero-balance">' + balance + ' <span>Coins</span></div>' +
    '<div class="rw-hero-sub">Earn more coins by learning and completing activities.</div>' +
    '</div></div>' +
    '<div class="rw-hero-decor"><i class="fas fa-gem"></i><i class="fas fa-star"></i><i class="fas fa-treasure-chest"></i></div>' +
    '<button class="rw-history-btn" onclick="' + (typeof openCoinsPopup === 'function' ? 'openCoinsPopup()' : 'navigate(\'profile\')') + '"><i class="fas fa-history"></i> View History</button>' +
    '</div>';

  // ── 2. Coupon card ──
  html += '<div class="rw-coupon">' +
    '<div class="rw-coupon-left">' +
    '<div class="rw-coupon-ic"><i class="fas fa-ticket-alt"></i></div>' +
    '<div><div class="rw-coupon-title">Have a coupon?</div>' +
    '<div class="rw-coupon-sub">Enter your coupon code to get exciting rewards.</div></div>' +
    '</div>' +
    '<div class="rw-coupon-form">' +
    '<input id="mall-coupon-input" type="text" placeholder="Enter coupon code" class="rw-coupon-input" onkeydown="if(event.key===\'Enter\')applyCoupon()" />' +
    '<button onclick="applyCoupon()" class="rw-coupon-apply">Apply</button>' +
    '</div>' +
    '<div id="mall-coupon-msg" style="display:none;flex-basis:100%;margin-top:6px;font-size:0.82rem;"></div>' +
    '</div>';

  // ── 3. Redeem Rewards header ──
  html += '<div class="rw-section-head">' +
    '<div class="rw-section-title"><span class="rw-section-emoji">\uD83C\uDF81</span> Redeem Rewards' +
    '<span class="rw-spark rw-spark-1"><i class="fas fa-star"></i></span><span class="rw-spark rw-spark-2"><i class="fas fa-star"></i></span></div>' +
    '<div class="rw-section-sub">Turn your coins into useful learning rewards.</div>' +
    '</div>';

  // ── 4. Reward cards grid ──
  html += '<div class="rw-grid">';
  (data.offers || []).forEach(function(offer) {
    var a = _rwAccent(offer);
    var avail = !!offer.available;
    html += '<div class="rw-card' + (avail ? '' : ' rw-card-locked') + '" style="--ac:' + a.color + ';">' +
      '<div class="rw-card-top">' +
      '<div class="rw-card-ic"><i class="fas ' + a.faIcon + '"></i></div>' +
      '<div class="rw-card-info">' +
      '<div class="rw-card-title">' + sanitize(offer.title || '') + '</div>' +
      '<div class="rw-card-desc">' + sanitize(offer.description || '') + '</div>' +
      '</div></div>' +
      '<div class="rw-card-divider"></div>' +
      '<div class="rw-card-bottom">' +
      '<div class="rw-card-cost"><span class="rw-coin"><i class="fas fa-coins"></i></span> ' + offer.coinsRequired + ' <span class="rw-coin-lbl">Coins</span></div>' +
      '<button class="rw-redeem-btn" onclick="redeemOffer(\'' + offer.id + '\')" ' + (avail ? '' : 'disabled') + '>' + (avail ? 'Redeem <i class="fas fa-arrow-right"></i>' : 'Locked') + '</button>' +
      '</div>' +
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

// 1–5 rating identity (label + accent color) — reused for selector, labels, badges, reviews
var _RATING_META = {
  1: { label: 'Very Poor',        emoji: '\uD83D\uDE1E', color: '#ef4444' },
  2: { label: 'Needs Improvement', emoji: '\uD83D\uDE15', color: '#f97316' },
  3: { label: 'Average',          emoji: '\uD83D\uDE42', color: '#f59e0b' },
  4: { label: 'Good',             emoji: '\uD83D\uDE0A', color: '#a78bfa' },
  5: { label: 'Excellent',        emoji: '\uD83E\uDD29', color: '#22c55e' },
};
function _rateColor(r) { return (_RATING_META[r] && _RATING_META[r].color) || '#94a3b8'; }

// Current user's display name as the reviews API derives it (email local-part), for
// current-user review detection. Falls back to profile name. No fabrication.
function _rateCurrentUserName() {
  try {
    var u = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    if (u.email && u.email.indexOf('@') !== -1) return u.email.split('@')[0].toLowerCase();
    var pe = document.getElementById('profile-email');
    if (pe && pe.textContent && pe.textContent.indexOf('@') !== -1) return pe.textContent.split('@')[0].toLowerCase();
  } catch (e) {}
  return '';
}

function _rateUpdateCount() {
  var ta = document.getElementById('rate-feedback');
  var c = document.getElementById('rate-char-count');
  if (ta && c) c.textContent = String((ta.value || '').length);
}

// Paint the star selector to reflect _selectedRating (shared by click + pre-fill)
function _ratePaintStars() {
  var container = document.getElementById('rate-stars');
  if (!container) return;
  container.querySelectorAll('span').forEach(function(s) {
    var val = parseInt(s.dataset.value);
    var on = val <= _selectedRating;
    s.textContent = on ? '\u2605' : '\u2606';
    s.style.color = on ? _rateColor(_selectedRating) : 'rgba(255,255,255,0.18)';
    s.style.textShadow = on ? '0 0 12px ' + _rateColor(_selectedRating) + '66' : 'none';
  });
  var moodEl = document.getElementById('rate-mood-label');
  if (moodEl) {
    var meta = _RATING_META[_selectedRating];
    if (meta) {
      moodEl.style.display = 'inline-flex';
      moodEl.textContent = meta.label + ' ' + meta.emoji;
      moodEl.style.color = meta.color;
      moodEl.style.background = meta.color + '1f';
      moodEl.style.borderColor = meta.color + '40';
    } else { moodEl.style.display = 'none'; }
  }
}

function loadRateUsPage() {
  var container = document.getElementById('rate-stars');
  if (!container) return;
  _selectedRating = 0;
  container.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('span');
    star.className = 'rating-star';
    star.textContent = '\u2606';
    star.dataset.value = i;
    star.setAttribute('role', 'button');
    star.setAttribute('tabindex', '0');
    star.setAttribute('aria-label', i + ' star' + (i > 1 ? 's' : ''));
    star.onmouseover = function() { this.style.transform = 'scale(1.15)'; };
    star.onmouseout = function() { this.style.transform = 'scale(1)'; };
    star.onclick = function() { _selectedRating = parseInt(this.dataset.value); _ratePaintStars(); };
    star.onkeydown = function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _selectedRating = parseInt(this.dataset.value); _ratePaintStars(); } };
    container.appendChild(star);
  }
  var msg = document.getElementById('rate-msg');
  if (msg) msg.style.display = 'none';
  var moodEl = document.getElementById('rate-mood-label');
  if (moodEl) moodEl.style.display = 'none';
  var ta = document.getElementById('rate-feedback');
  if (ta) ta.value = '';
  _rateUpdateCount();
  // Reset to "Submit" mode; _renderAppRatings switches to "Update" if a review exists
  var lbl = document.getElementById('rate-submit-label');
  if (lbl) lbl.textContent = 'Submit Rating';
  var already = document.getElementById('rate-already');
  if (already) already.style.display = 'none';

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

// Star row helper (filled/empty) with a color
function _rateStarRow(rating, color) {
  var out = '';
  for (var i = 1; i <= 5; i++) {
    out += '<i class="fas fa-star" style="font-size:0.72rem;color:' + (i <= rating ? color : 'rgba(255,255,255,0.16)') + ';"></i>';
  }
  return out;
}

function _renderAppRatings(reviewsDiv, data) {
  if (!data.success || data.totalReviews === 0) {
    reviewsDiv.innerHTML = '<div class="rating-summary" style="text-align:center;padding:36px 24px;">' +
      '<div class="rating-empty-ic"><i class="fas fa-star"></i></div>' +
      '<div class="rating-empty-title">Be the first to rate CodingKida</div>' +
      '<div class="rating-empty-sub">Your feedback helps other students and helps us improve.</div>' +
      '</div>';
    // No existing review → keep Submit mode
    return;
  }

  // ── Overall Rating card ──
  var html = '<div class="rating-summary">' +
    '<div class="rating-summary-head">' +
    '<span class="rating-summary-title">Overall Rating</span>' +
    '<i class="fas fa-info-circle" style="font-size:0.72rem;color:#64748b;" title="Average of all student ratings"></i>' +
    '</div>' +
    '<div class="rating-summary-body">' +
    '<div class="rating-summary-score">' +
    '<div class="rating-avg">' + data.avgRating + '</div>' +
    '<div class="rating-avg-stars">' + _rateStarRow(Math.round(data.avgRating), '#fbbf24') + '</div>' +
    '<div class="rating-avg-count">Based on ' + data.totalReviews + ' review' + (data.totalReviews > 1 ? 's' : '') + '</div>' +
    '</div>' +
    '<div class="rating-distribution">';
  for (var s = 5; s >= 1; s--) {
    var count = data.ratingCounts[s] || 0;
    var pct = data.totalReviews > 0 ? Math.round(count / data.totalReviews * 100) : 0;
    var barColor = _rateColor(s);
    html += '<div class="rating-dist-row">' +
      '<span class="rating-dist-label">' + s + ' <i class="fas fa-star" style="font-size:0.6rem;color:' + barColor + ';"></i></span>' +
      '<div class="rating-dist-track"><div class="rating-dist-fill" style="--sp-target:' + pct + '%;background:' + barColor + ';"></div></div>' +
      '<span class="rating-dist-count">' + count + '</span>' +
      '</div>';
  }
  html += '</div></div></div>';

  // ── Recent Reviews (dedup by student, keep latest) ──
  var reviews = (data.reviews || []).slice();
  // Backend already upserts one record per user; this is a safe display-dedup by
  // studentName keeping the newest createdAt (no stable userId is exposed here).
  var latestByUser = {};
  reviews.forEach(function(r) {
    var key = (r.studentName || '').toLowerCase();
    if (!latestByUser[key] || new Date(r.createdAt) > new Date(latestByUser[key].createdAt)) {
      latestByUser[key] = r;
    }
  });
  var deduped = Object.keys(latestByUser).map(function(k) { return latestByUser[k]; });
  deduped.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

  html += '<div class="rating-review-list-wrap">' +
    '<div class="rating-review-head"><span class="rating-summary-title">Recent Reviews</span></div>' +
    '<div class="rating-review-list">';
  deduped.slice(0, 8).forEach(function(r) {
    var meta = _RATING_META[r.rating] || { label: '', color: '#94a3b8' };
    var date = new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    var initial = (r.studentName || '?').charAt(0).toUpperCase();
    html += '<div class="rating-review-card" style="--rc:' + meta.color + ';">' +
      '<div class="rating-review-avatar" style="background:' + meta.color + '22;border-color:' + meta.color + '40;color:' + meta.color + ';">' + initial + '</div>' +
      '<div class="rating-review-body">' +
      '<div class="rating-review-top">' +
      '<span class="rating-review-name">' + sanitize(r.studentName) + '</span>' +
      '<span class="rating-review-date">' + date + '</span>' +
      '</div>' +
      '<div class="rating-review-stars-row">' + _rateStarRow(r.rating, meta.color) +
      (meta.label ? '<span class="rating-badge" style="color:' + meta.color + ';background:' + meta.color + '1f;border-color:' + meta.color + '3a;">' + meta.label + '</span>' : '') +
      '</div>' +
      (r.feedback ? '<div class="rating-review-text">' + sanitize(r.feedback) + '</div>' : '') +
      '</div></div>';
  });
  html += '</div></div>';

  reviewsDiv.innerHTML = html;

  // ── Current-user review detection → pre-fill + Update mode ──
  // Backend upserts by user, so the current user's latest review (if any) can be
  // matched by their derived studentName. This drives NEW vs UPDATE form state.
  var myName = _rateCurrentUserName();
  if (myName && latestByUser[myName]) {
    var mine = latestByUser[myName];
    _selectedRating = mine.rating || 0;
    _ratePaintStars();
    var ta = document.getElementById('rate-feedback');
    if (ta && !ta.value) { ta.value = mine.feedback || ''; _rateUpdateCount(); }
    var lbl = document.getElementById('rate-submit-label');
    if (lbl) lbl.textContent = 'Update Rating';
    var already = document.getElementById('rate-already');
    if (already) already.style.display = 'flex';
  }
}

var _rateSubmitting = false;
async function submitRating() {
  if (_rateSubmitting) return; // guard against rapid double-clicks
  if (_selectedRating === 0) { alert('Please select a rating'); return; }
  var feedback = (document.getElementById('rate-feedback') || {}).value || '';
  var msg = document.getElementById('rate-msg');
  var btn = document.getElementById('rate-submit-btn');
  var lbl = document.getElementById('rate-submit-label');
  var prevLbl = lbl ? lbl.textContent : 'Submit Rating';
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  _rateSubmitting = true;
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
  if (lbl) lbl.textContent = 'Saving...';

  try {
    var res = await fetch(BASE_URL + '/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ rating: _selectedRating, feedback: feedback, lessonId: 'app_rating', lessonTitle: 'App Rating' }),
    });
    var data = await res.json();
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = data.success ? '#22c55e' : '#ef4444';
      msg.textContent = data.success ? '\uD83C\uDF89 Thank you for your feedback!' : '\u274C ' + data.message;
    }
    if (data.success) { _loadAppRatings(); }
    else if (lbl) { lbl.textContent = prevLbl; }
  } catch {
    if (msg) { msg.style.display = 'block'; msg.style.color = '#ef4444'; msg.textContent = 'Network error'; }
    if (lbl) lbl.textContent = prevLbl;
  } finally {
    _rateSubmitting = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

// ─── About Page (dynamic stats from existing frontend data — no new API) ──────

// Parse a course "students" value into an actual number. Handles plain numbers
// and shorthand strings like "45K", "1.2K", "2M" (the format used in course data).
function _aboutParseStudents(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).trim().toLowerCase().replace(/[, ]/g, '');
  var m = s.match(/^([\d.]+)\s*([km])?/);
  if (!m) return 0;
  var num = parseFloat(m[1]) || 0;
  if (m[2] === 'k') num *= 1000;
  else if (m[2] === 'm') num *= 1000000;
  return Math.round(num);
}

// Compact large-number format: 1000→1K+, 12500→12.5K+, 50000→50K+
function _aboutFmtCount(n) {
  n = Number(n) || 0;
  if (n <= 0) return '\u2014';
  if (n < 1000) return n + '+';
  var k = n / 1000;
  var s = (k >= 10 || k % 1 === 0) ? Math.round(k) : (Math.round(k * 10) / 10);
  return s + 'K+';
}

function _aboutSetStat(id, value) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('abt-skeleton');
  el.textContent = value;
}

function loadAboutPage() {
  // Students + Courses come from the existing courses cache (or MOCK_COURSES fallback).
  // Each course carries a real `students` (enrollment) count; sum for a real total.
  var courses = null;
  try {
    var cc = (typeof ckCacheGet === 'function') ? ckCacheGet('/api/courses') : null;
    if (cc && cc.success && Array.isArray(cc.courses)) courses = cc.courses;
  } catch (e) {}
  if (!courses && typeof MOCK_COURSES !== 'undefined' && Array.isArray(MOCK_COURSES)) courses = MOCK_COURSES;

  if (courses && courses.length) {
    _aboutSetStat('about-stat-courses', courses.length + '+');
    var totalStudents = courses.reduce(function(sum, c) { return sum + _aboutParseStudents(c.students); }, 0);
    _aboutSetStat('about-stat-students', _aboutFmtCount(totalStudents));
  } else {
    // No data available — graceful fallback, never fabricate
    _aboutSetStat('about-stat-courses', '\u2014');
    _aboutSetStat('about-stat-students', '\u2014');
    // Try a background courses load to fill in once available
    if (typeof loadCourses === 'function') {
      loadCourses().then(function(list) {
        if (list && list.length) {
          _aboutSetStat('about-stat-courses', list.length + '+');
          var ts = list.reduce(function(sum, c) { return sum + _aboutParseStudents(c.students); }, 0);
          _aboutSetStat('about-stat-students', _aboutFmtCount(ts));
        }
      }).catch(function(){});
    }
  }

  // Rating reuses the existing app-rating feedback data (same source as Rate Us).
  var rating = null, reviews = 0;
  try {
    var rc = (typeof ckCacheGet === 'function') ? ckCacheGet('/api/feedback/app_rating') : null;
    if (rc && rc.success) { rating = rc.avgRating; reviews = rc.totalReviews || 0; }
  } catch (e) {}
  if (rating && Number(rating) > 0) {
    _aboutSetStat('about-stat-rating', Number(rating).toFixed(1));
    var rsub = document.getElementById('about-stat-rating-sub');
    if (rsub) rsub.textContent = 'Based on ' + reviews + ' review' + (reviews === 1 ? '' : 's');
  } else {
    _aboutSetStat('about-stat-rating', '\u2014');
    var rsub2 = document.getElementById('about-stat-rating-sub');
    if (rsub2) rsub2.textContent = 'No ratings yet';
  }
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

/* Student Progress visual helpers (presentation only — reuse existing data) */
function _spCourseLogo(title) {
  var ct = (title || '').toLowerCase();
  var img = function(src, bg, bd){ return { html: '<img src="' + src + '" alt="" class="sp-course-logo" style="width:34px;height:34px;object-fit:contain;" onerror="this.style.display=\'none\'"/>', bg: bg, border: bd }; };
  if (ct.includes('java') && !ct.includes('javascript')) return img('assets/java-logo.png', 'rgba(249,115,22,0.12)', 'rgba(249,115,22,0.28)');
  if (ct.includes('python')) return img('assets/python-logo.png', 'rgba(16,185,129,0.12)', 'rgba(16,185,129,0.28)');
  if (ct === 'c' || ct.includes('c programming') || ct.includes('c lang')) return img('assets/c-logo.png', 'rgba(34,211,238,0.12)', 'rgba(34,211,238,0.28)');
  var faIcon = 'fas fa-book';
  if (ct.includes('javascript') || ct.includes(' js')) faIcon = 'fab fa-js';
  else if (ct.includes('html') || ct.includes('web')) faIcon = 'fab fa-html5';
  else if (ct.includes('react')) faIcon = 'fab fa-react';
  else if (ct.includes('node')) faIcon = 'fab fa-node-js';
  return { html: '<i class="' + faIcon + ' sp-course-logo" style="font-size:1.4rem;color:#c4b5fd;"></i>', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.28)' };
}
// Derive a visual learning state ONLY from existing completion data (+ existing achievement helper).
function _spCourseState(course) {
  var p = course.progressPercent || 0;
  var mastered = false;
  if (typeof getCourseAchievement === 'function') {
    var ach = getCourseAchievement(course);
    mastered = !!(ach && ach.isMaster);
  }
  if (mastered) return { label: 'Mastered', color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.35)' };
  if (p >= 100) return { label: 'Completed', color: '#4ade80', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.3)' };
  if (p >= 75) return { label: 'Almost Complete', color: '#67e8f9', bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.28)' };
  if (p > 0) return { label: 'In Progress', color: '#a78bfa', bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.3)' };
  return { label: 'Not Started', color: '#94a3b8', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' };
}
// Performance label derived from existing overallScore only.
function _spPerfLabel(score) {
  if (score >= 90) return 'Outstanding';
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Doing Well';
  if (score >= 25) return 'Getting Started';
  return 'Just Beginning';
}
// Animated star row (reuses rating value; adds subtle staggered pop).
function _spStars(rating) {
  var html = '';
  for (var i = 1; i <= 5; i++) {
    var on = i <= rating;
    html += '<i class="fas fa-star sp-star" style="font-size:1.15rem;color:' + (on ? '#fbbf24' : 'rgba(255,255,255,0.15)') + ';' + (on ? 'text-shadow:0 0 10px rgba(251,191,36,0.4);' : '') + 'animation-delay:' + (i * 0.06) + 's;"></i>';
  }
  return html;
}
// Compact metric block with mini progress bar (Lessons / Quiz / Exercises).
function _spMetric(icon, color, label, pct, valueText, fillGradient) {
  return '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);border-radius:12px;padding:12px 14px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
    '<span style="display:flex;align-items:center;gap:7px;font-size:0.72rem;color:#cbd5e1;font-weight:600;"><i class="fas ' + icon + '" style="color:' + color + ';font-size:0.72rem;"></i> ' + label + '</span>' +
    '<span style="font-size:0.74rem;font-weight:800;color:#fff;">' + valueText + '</span>' +
    '</div>' +
    '<div class="sp-mini-track"><div class="sp-mini-fill" style="--sp-target:' + (pct || 0) + '%;background:' + fillGradient + ';"></div></div>' +
    '</div>';
}

function _renderStudentProgress(data) {
  var content = document.getElementById('student-progress-content');
  if (!content) return;

  var score = data.overallScore || 0;
  // Total XP — reuse existing XP system (no recalculation). Falls back gracefully.
  var totalXp = null;
  if (typeof getXPState === 'function') { try { totalXp = (getXPState() || {}).xp; } catch (e) { totalXp = null; } }
  var lessonPctAll = data.totalLessons > 0 ? Math.round((data.totalLessonsCompleted / data.totalLessons) * 100) : 0;

  // ── Overall Performance focal card (two-column: rating + learning score) ──
  var overallHtml = '<div style="background:linear-gradient(135deg,rgba(46,26,74,0.55),rgba(22,22,38,0.75));backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(139,92,246,0.22);border-radius:22px;padding:26px 28px;margin-bottom:24px;position:relative;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.3),0 0 24px rgba(139,92,246,0.06);">' +
    '<div style="position:absolute;top:-35%;right:-2%;width:220px;height:220px;background:radial-gradient(circle,rgba(139,92,246,0.14),transparent 65%);pointer-events:none;"></div>' +
    '<div style="position:absolute;bottom:-40%;left:20%;width:180px;height:180px;background:radial-gradient(circle,rgba(236,72,153,0.06),transparent 65%);pointer-events:none;"></div>' +
    '<i class="fas fa-trophy sp-trophy" style="pointer-events:none;"></i>' +
    '<div style="display:grid;grid-template-columns:1fr 1px 1.2fr;gap:26px;align-items:center;position:relative;z-index:1;">' +
    // Left: rating
    '<div>' +
    '<div style="font-size:0.68rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Overall Performance</div>' +
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">' + _spStars(data.overallRating) + '</div>' +
    '<div style="font-size:2.1rem;font-weight:800;color:#fff;line-height:1;">' + data.overallRating + ' <span style="font-size:1.1rem;color:#64748b;font-weight:700;">/ 5</span></div>' +
    '<span style="display:inline-block;margin-top:10px;font-size:0.68rem;font-weight:700;color:#c4b5fd;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:20px;padding:3px 12px;">' + _spPerfLabel(score) + '</span>' +
    '</div>' +
    // Divider
    '<div style="width:1px;height:80px;background:linear-gradient(180deg,transparent,rgba(255,255,255,0.1),transparent);"></div>' +
    // Right: learning score
    '<div>' +
    '<div style="font-size:0.68rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Learning Score</div>' +
    '<div style="font-size:2.6rem;font-weight:800;background:linear-gradient(90deg,#a78bfa,#ec4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;line-height:1;margin-bottom:12px;">' + score + '%</div>' +
    '<div class="sp-progress-track" style="max-width:340px;"><div class="sp-progress-fill" style="--sp-target:' + score + '%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);box-shadow:0 0 10px rgba(139,92,246,0.5);"></div></div>' +
    '<div style="font-size:0.76rem;color:#94a3b8;margin-top:10px;">Keep going! You\u2019re doing great.</div>' +
    '</div>' +
    '</div>' +
    // Stat cards row
    '<div style="display:grid;grid-template-columns:repeat(' + (totalXp !== null ? '3' : '2') + ',1fr);gap:14px;margin-top:22px;position:relative;z-index:1;">' +
    '<div style="background:rgba(139,92,246,0.06);border:1px solid rgba(139,92,246,0.15);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;">' +
    '<div style="width:44px;height:44px;border-radius:13px;background:rgba(139,92,246,0.14);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-book-open" style="color:#a78bfa;font-size:0.95rem;"></i></div>' +
    '<div><div style="font-size:1.35rem;font-weight:800;color:#fff;line-height:1;">' + data.totalLessonsCompleted + ' / ' + data.totalLessons + '</div><div style="font-size:0.7rem;color:#94a3b8;margin-top:3px;">Lessons Completed</div><div style="font-size:0.66rem;color:#6ee7b7;font-weight:600;margin-top:1px;">' + lessonPctAll + '% Completed</div></div>' +
    '</div>' +
    '<div style="background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.15);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;">' +
    '<div style="width:44px;height:44px;border-radius:13px;background:rgba(34,211,238,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-graduation-cap" style="color:#67e8f9;font-size:0.95rem;"></i></div>' +
    '<div><div style="font-size:1.35rem;font-weight:800;color:#fff;line-height:1;">' + data.courses.length + '</div><div style="font-size:0.7rem;color:#94a3b8;margin-top:3px;">Courses Enrolled</div><div style="font-size:0.66rem;color:#67e8f9;font-weight:600;margin-top:1px;">Keep learning</div></div>' +
    '</div>' +
    (totalXp !== null ?
    '<div style="background:rgba(236,72,153,0.05);border:1px solid rgba(236,72,153,0.15);border-radius:16px;padding:16px 18px;display:flex;align-items:center;gap:14px;">' +
    '<div style="width:44px;height:44px;border-radius:13px;background:rgba(236,72,153,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span style="font-size:0.72rem;font-weight:800;color:#f472b6;">XP</span></div>' +
    '<div><div style="font-size:1.35rem;font-weight:800;color:#fff;line-height:1;">' + totalXp + ' XP</div><div style="font-size:0.7rem;color:#94a3b8;margin-top:3px;">Total XP Earned</div><div style="font-size:0.66rem;color:#f472b6;font-weight:600;margin-top:1px;">Level up!</div></div>' +
    '</div>' : '') +
    '</div>' +
    // Rating breakdown toggle
    '<div style="text-align:center;margin-top:18px;position:relative;z-index:1;"><span onclick="document.getElementById(\'sp-rating-detail\').style.display=document.getElementById(\'sp-rating-detail\').style.display===\'none\'?\'block\':\'none\'" style="font-size:0.75rem;color:#a78bfa;cursor:pointer;font-weight:600;">\u25BC View Rating Breakdown</span></div>' +
    // Rating breakdown (expandable)
    '<div id="sp-rating-detail" style="display:none;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);position:relative;z-index:1;">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
    // Quiz rating
    '<div style="background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.12);border-radius:16px;padding:18px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><i class="fas fa-brain" style="color:#a78bfa;font-size:0.8rem;"></i><span style="font-weight:700;color:#fff;font-size:0.88rem;">Quiz Performance</span></div>' +
    '<div style="margin-bottom:8px;">' + _renderStars(data.ratingBreakdown.quiz.rating) + ' <span style="color:#fff;font-weight:700;margin-left:4px;">' + data.ratingBreakdown.quiz.rating + '/5</span></div>' +
    '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.8;">' +
    'Accuracy: <strong style="color:#4ade80;">' + data.ratingBreakdown.quiz.accuracy + '%</strong><br/>' +
    'Attempted: ' + data.ratingBreakdown.quiz.attempted + ' / ' + data.ratingBreakdown.quiz.totalQuizzes + '<br/>' +
    'Correct: ' + data.ratingBreakdown.quiz.correct +
    '</div></div>' +
    // Exercise rating
    '<div style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.12);border-radius:16px;padding:18px;">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><i class="fas fa-code" style="color:#6ee7b7;font-size:0.8rem;"></i><span style="font-weight:700;color:#fff;font-size:0.88rem;">Exercise Performance</span></div>' +
    '<div style="margin-bottom:8px;">' + _renderStars(data.ratingBreakdown.exercise.rating) + ' <span style="color:#fff;font-weight:700;margin-left:4px;">' + data.ratingBreakdown.exercise.rating + '/5</span></div>' +
    '<div style="font-size:0.75rem;color:#94a3b8;line-height:1.8;">' +
    'Pass Rate: <strong style="color:#4ade80;">' + data.ratingBreakdown.exercise.passRate + '%</strong><br/>' +
    'Attempted: ' + data.ratingBreakdown.exercise.attempted + ' / ' + data.ratingBreakdown.exercise.totalExercises + '<br/>' +
    'Passed: ' + data.ratingBreakdown.exercise.passed +
    '</div></div>' +
    '</div></div>' +
    '</div>';

  // Per-course progress (premium dynamic cards)
  var coursesHtml = '';
  data.courses.forEach(function(course) {
    var logo = _spCourseLogo(course.title);
    var st = _spCourseState(course);
    var p = course.progressPercent || 0;
    var lessonPct = course.totalLessons > 0 ? Math.round((course.lessonsCompleted / course.totalLessons) * 100) : 0;
    var quizPct = (course.quiz && course.quiz.accuracy !== null && course.quiz.accuracy !== undefined) ? course.quiz.accuracy : 0;
    var exPct = (course.exercise && course.exercise.total > 0) ? Math.round((course.exercise.passed / course.exercise.total) * 100) : 0;
    var progColor = p >= 100 ? 'linear-gradient(90deg,#10b981,#22c55e)' : 'linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899)';

    coursesHtml += '<div class="sp-course-card" style="background:linear-gradient(135deg,rgba(28,28,46,0.7),rgba(22,22,38,0.6));border:1px solid ' + (st.label === 'Mastered' ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)') + ';border-radius:18px;margin-bottom:16px;overflow:hidden;' + (st.label === 'Mastered' ? 'box-shadow:0 0 20px rgba(251,191,36,0.08);' : '') + '">' +
      // Header (clickable toggle — detail div is after the always-visible metrics row)
      '<div onclick="var d=this.nextElementSibling.nextElementSibling;var open=d.style.display===\'none\';d.style.display=open?\'block\':\'none\';this.querySelector(\'.sp-chevron\').style.transform=open?\'rotate(180deg)\':\'rotate(0deg)\'" style="padding:18px 20px;cursor:pointer;display:flex;align-items:center;gap:16px;">' +
      '<div style="width:52px;height:52px;min-width:52px;border-radius:14px;background:' + logo.bg + ';border:1px solid ' + logo.border + ';display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 12px ' + logo.bg + ';">' + logo.html + '</div>' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">' +
      '<span style="font-size:1.02rem;font-weight:800;color:#fff;">' + sanitize(course.title) + '</span>' +
      '<span style="font-size:0.6rem;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:' + st.color + ';background:' + st.bg + ';border:1px solid ' + st.border + ';border-radius:20px;padding:2px 10px;">' + st.label + '</span>' +
      '</div>' +
      '<div style="font-size:0.72rem;color:#94a3b8;margin-bottom:8px;">' + course.lessonsCompleted + ' / ' + course.totalLessons + ' lessons completed</div>' +
      '<div class="sp-progress-track"><div class="sp-progress-fill" style="--sp-target:' + p + '%;background:' + progColor + ';box-shadow:0 0 8px rgba(139,92,246,0.4);"></div></div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:1.15rem;font-weight:800;color:' + (p >= 100 ? '#4ade80' : '#a78bfa') + ';">' + p + '%</span>' +
      (p >= 100 ? '<i class="fas fa-check-circle" style="color:#22c55e;font-size:1.1rem;"></i>' : '') +
      '<i class="fas fa-chevron-down sp-chevron" style="color:#64748b;font-size:0.8rem;transition:transform 0.25s ease;"></i>' +
      '</div>' +
      '</div>' +
      // Metrics row (Lessons / Quiz / Exercises mini-bars)
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:0 20px 16px;">' +
      _spMetric('fa-book', '#a78bfa', 'Lessons', lessonPct, course.lessonsCompleted + ' / ' + course.totalLessons, 'linear-gradient(90deg,#6366f1,#8b5cf6)') +
      _spMetric('fa-question', '#c4b5fd', 'Quiz', quizPct, quizPct + '%', 'linear-gradient(90deg,#8b5cf6,#a855f7)') +
      _spMetric('fa-code', '#67e8f9', 'Exercises', exPct, exPct + '%', 'linear-gradient(90deg,#38bdf8,#22d3ee)') +
      '</div>' +
      // Expandable detail (modules + lessons) — collapsed by default, preserved behavior
      '<div style="display:none;padding:0 20px 20px;border-top:1px solid rgba(255,255,255,0.05);margin-top:2px;padding-top:16px;">';

    // Course quiz/exercise summary (kept)
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
