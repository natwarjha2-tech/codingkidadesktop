/**
 * CodingKida Desktop — Frontend-only XP / Gamification service
 * ────────────────────────────────────────────────────────────
 * Pure frontend. No backend calls, no APIs. Persists per-user under
 * localStorage key `ck_xp_<userId>`. XP is awarded by hooking existing
 * frontend learning-action signals (lesson 80%/complete, quiz, exercise,
 * course complete, daily learning). Every award uses a unique action key
 * so the same action can never grant XP twice (anti-farming).
 *
 * Public API (all global, matching project conventions):
 *   awardXP(actionKey, amount)      → award once per actionKey, returns true if newly awarded
 *   hasActionBeenAwarded(actionKey) → bool
 *   getXPState()                    → { xp, awarded, badges, days }
 *   getCurrentLevel()               → level number
 *   getLevelInfo()                  → { level, title, xp, floor, next, toNext, progressPct }
 *   getBadges()                     → [{ id, title, desc, icon, unlocked }]
 *   getCurrentStreak()              → day streak (number)
 *   markDailyLearning()             → awards daily XP once/day
 *   renderProfileXP()               → repaint the Profile hero XP UI
 */

// ─── Centralized configuration (easy to modify later) ───────────────────────

var XP_REWARDS = {
  lessonWatch80: 10,     // reached ~80% of a lesson (once/lesson)
  lessonComplete: 25,    // lesson marked complete (once/lesson)
  quizCorrect: 5,        // per correct quiz answer
  quizComplete: 20,      // quiz successfully submitted (once/quiz)
  exerciseComplete: 30,  // exercise passed (once/exercise)
  homeworkComplete: 40,  // homework completed (once/homework) — no frontend signal yet
  courseComplete: 100,   // all lessons of a course complete (once/course)
  dailyLearning: 10,     // first meaningful learning action of the day (once/day)
};

// Level thresholds — cumulative XP required to REACH each level.
var XP_LEVELS = [
  { level: 1, title: 'Beginner', min: 0 },
  { level: 2, title: 'Learner', min: 200 },
  { level: 3, title: 'Explorer', min: 450 },
  { level: 4, title: 'Builder', min: 750 },
  { level: 5, title: 'Creator', min: 1100 },
  { level: 6, title: 'Pro', min: 1500 },
  { level: 7, title: 'Expert', min: 2000 },
  { level: 8, title: 'Master', min: 2600 },
];

// Badge definitions — unlocked purely from frontend XP state.
// `check(state)` receives the XP state and derived stats.
var XP_BADGES = [
  { id: 'first-step', title: 'First Step', desc: 'Complete your first lesson', icon: 'fa-shoe-prints',
    check: function(s){ return s.lessonsCompleted >= 1; } },
  { id: 'quick-learner', title: 'Quick Learner', desc: 'Complete 5 lessons', icon: 'fa-bolt',
    check: function(s){ return s.lessonsCompleted >= 5; } },
  { id: 'quiz-master', title: 'Quiz Master', desc: 'Complete 5 quizzes', icon: 'fa-brain',
    check: function(s){ return s.quizzesCompleted >= 5; } },
  { id: 'course-finisher', title: 'Course Finisher', desc: 'Complete your first course', icon: 'fa-graduation-cap',
    check: function(s){ return s.coursesCompleted >= 1; } },
  { id: 'consistent-learner', title: 'Consistent Learner', desc: 'Learn on 5 different days', icon: 'fa-calendar-check',
    check: function(s){ return s.daysLearned >= 5; } },
  { id: 'xp-hunter', title: 'XP Hunter', desc: 'Reach 500 XP', icon: 'fa-crosshairs',
    check: function(s){ return s.xp >= 500; } },
  { id: 'master', title: 'Master', desc: 'Reach the final level', icon: 'fa-crown',
    check: function(s){ return s.level >= XP_LEVELS[XP_LEVELS.length - 1].level; } },
];

// ─── Storage ─────────────────────────────────────────────────────────────────

function _xpStorageKey() {
  var uid = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : '';
  return uid ? 'ck_xp_' + uid : 'ck_xp';
}

function getXPState() {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(_xpStorageKey()) || 'null'); } catch (e) { raw = null; }
  if (!raw || typeof raw !== 'object') raw = {};
  return {
    xp: raw.xp || 0,
    awarded: raw.awarded || {},   // { actionKey: true }
    days: raw.days || [],         // ['2026-07-30', ...] distinct learning days
  };
}

function _saveXPState(state) {
  try { localStorage.setItem(_xpStorageKey(), JSON.stringify(state)); } catch (e) {}
}

// ─── Awarding (anti-farming: one XP grant per unique actionKey) ───────────────

function hasActionBeenAwarded(actionKey) {
  if (!actionKey) return false;
  return !!getXPState().awarded[actionKey];
}

/**
 * Award XP for a unique action. Returns true only if this is the first time.
 * Refreshes the Profile UI when XP changes.
 */
function awardXP(actionKey, amount) {
  if (!actionKey || !amount) return false;
  var state = getXPState();
  if (state.awarded[actionKey]) return false; // already awarded — never double
  state.awarded[actionKey] = true;
  state.xp += amount;
  _saveXPState(state);
  // First meaningful learning action of the day also earns the daily bonus
  markDailyLearning();
  renderProfileXP();
  return true;
}

// ─── Daily learning ────────────────────────────────────────────────────────

function _todayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Records today as a learning day and awards the daily bonus once per day.
 * Safe to call multiple times per day.
 */
function markDailyLearning() {
  var state = getXPState();
  var today = _todayKey();
  var dailyKey = 'daily:' + today;
  if (state.awarded[dailyKey]) return false; // already counted today
  state.awarded[dailyKey] = true;
  if (state.days.indexOf(today) === -1) state.days.push(today);
  state.xp += XP_REWARDS.dailyLearning;
  _saveXPState(state);
  renderProfileXP();
  return true;
}

/**
 * Current consecutive-day streak based on distinct learning days.
 * Counts back from today (or yesterday) through consecutive calendar days.
 */
function getCurrentStreak() {
  var state = getXPState();
  if (!state.days.length) return 0;
  var set = {};
  state.days.forEach(function(d){ set[d] = true; });
  function keyFor(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  var cursor = new Date();
  // Allow streak to be "alive" if last activity was today or yesterday
  if (!set[keyFor(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set[keyFor(cursor)]) return 0;
  }
  var streak = 0;
  while (set[keyFor(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ─── Levels ──────────────────────────────────────────────────────────────────

function getCurrentLevel() {
  return getLevelInfo().level;
}

function getLevelInfo() {
  var xp = getXPState().xp;
  var current = XP_LEVELS[0];
  var next = null;
  for (var i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i].min) {
      current = XP_LEVELS[i];
      next = XP_LEVELS[i + 1] || null;
    } else {
      break;
    }
  }
  var floor = current.min;
  var ceil = next ? next.min : current.min;
  var span = ceil - floor;
  var into = xp - floor;
  var progressPct = (next && span > 0) ? Math.min(100, Math.round((into / span) * 100)) : 100;
  return {
    level: current.level,
    title: current.title,
    xp: xp,
    floor: floor,
    next: next,               // null if at max level
    ceil: ceil,               // XP needed to reach next level (== xp at max)
    toNext: next ? Math.max(0, ceil - xp) : 0,
    progressPct: progressPct,
  };
}

// ─── Derived stats + badges ──────────────────────────────────────────────────

function _countAwarded(prefix) {
  var awarded = getXPState().awarded;
  var n = 0;
  for (var k in awarded) { if (awarded.hasOwnProperty(k) && k.indexOf(prefix) === 0) n++; }
  return n;
}

function _xpDerivedStats() {
  var info = getLevelInfo();
  return {
    xp: info.xp,
    level: info.level,
    lessonsCompleted: _countAwarded('lesson-complete:'),
    quizzesCompleted: _countAwarded('quiz-complete:'),
    exercisesCompleted: _countAwarded('exercise-complete:'),
    coursesCompleted: _countAwarded('course-complete:'),
    daysLearned: getXPState().days.length,
  };
}

function getBadges() {
  var stats = _xpDerivedStats();
  return XP_BADGES.map(function(b) {
    return { id: b.id, title: b.title, desc: b.desc, icon: b.icon, unlocked: !!b.check(stats) };
  });
}

// ─── UI rendering (Profile hero) ─────────────────────────────────────────────

function renderProfileXP() {
  var info = getLevelInfo();
  var badges = getBadges();
  var unlockedCount = badges.filter(function(b){ return b.unlocked; }).length;
  var nextBadge = badges.find(function(b){ return !b.unlocked; });
  var streak = getCurrentStreak();

  // Level badge (shield)
  var lvlNum = document.getElementById('xp-level-num');
  if (lvlNum) lvlNum.textContent = String(info.level).padStart(2, '0');
  var lvlTitle = document.getElementById('xp-level-title');
  if (lvlTitle) lvlTitle.textContent = info.title;
  var shield = document.getElementById('xp-level-shield');
  if (shield) {
    // Strengthen visual by level tier (1..8) via data attribute (CSS handles styling)
    shield.setAttribute('data-tier', String(info.level));
  }

  // Progress bar + XP text
  var fill = document.getElementById('xp-progress-fill');
  if (fill) fill.style.width = info.progressPct + '%';
  var xpText = document.getElementById('xp-progress-text');
  if (xpText) xpText.textContent = info.xp + ' / ' + (info.next ? info.ceil : info.xp) + ' XP';
  var toNext = document.getElementById('xp-to-next');
  if (toNext) toNext.textContent = info.next ? (info.toNext + ' XP') : 'MAX';
  var toNextLabel = document.getElementById('xp-to-next-label');
  if (toNextLabel) toNextLabel.textContent = info.next ? ('to Level ' + info.next.level) : 'Max level reached';

  // Badges card
  var badgeCount = document.getElementById('xp-badge-count');
  if (badgeCount) badgeCount.textContent = String(unlockedCount).padStart(2, '0');
  var badgeNext = document.getElementById('xp-badge-next');
  if (badgeNext) badgeNext.textContent = nextBadge ? ('Next: ' + nextBadge.title) : 'All badges unlocked';

  // Badge pips row (diamonds) — show unlocked vs locked for first 7 badges
  var pipsWrap = document.getElementById('xp-badge-pips');
  if (pipsWrap) {
    pipsWrap.innerHTML = badges.map(function(b) {
      return '<i class="fas ' + (b.unlocked ? b.icon : 'fa-gem') + ' xp-pip ' + (b.unlocked ? 'xp-pip-on' : 'xp-pip-off') + '" title="' + b.title + (b.unlocked ? '' : ' (locked)') + '"></i>';
    }).join('');
  }

  // Streak card
  var streakCount = document.getElementById('xp-streak-count');
  if (streakCount) streakCount.textContent = String(streak).padStart(2, '0');
  var streakSub = document.getElementById('xp-streak-sub');
  if (streakSub) streakSub.textContent = streak > 0 ? (streak + ' day streak') : 'Start your streak';

  // Streak pips (7-day view)
  var streakPips = document.getElementById('xp-streak-pips');
  if (streakPips) {
    var html = '';
    for (var i = 0; i < 7; i++) {
      var on = i < Math.min(streak, 7);
      html += '<span class="xp-spip ' + (on ? 'xp-spip-on' : '') + '"></span>';
    }
    streakPips.innerHTML = html;
  }
}

// ─── Course Achievement Score (frontend-only, homework excluded) ─────────────
//
// Uses ONLY the three measurable activities from the existing cached
// `/api/student/progress` payload (per-course `data.courses[]`):
//   Lessons   = 50%  (course.lessonsCompleted / course.totalLessons)
//   Quizzes   = 30%  (course.quiz.attempted   / course.quiz.total)
//   Exercises = 20%  (course.exercise.passed  / course.exercise.total)
//
// Homework is deliberately EXCLUDED — there is no reliable frontend
// homework-completion signal, so counting it would fabricate data.
// No API call is made here; we reuse the already-cached progress data.

var COURSE_SCORE_WEIGHTS = { lessons: 0.50, quizzes: 0.30, exercises: 0.20 };

/**
 * Read the cached student-progress payload (no network). Returns null if absent.
 * Populated by loadStudentProgress() in pages.js via ckCacheSet('/api/student/progress').
 */
function _xpGetCachedProgress() {
  if (typeof ckCacheGet !== 'function') return null;
  var data = ckCacheGet('/api/student/progress');
  return (data && data.success && Array.isArray(data.courses)) ? data : null;
}

// Ratio helper: an activity with zero total items counts as fully complete (1),
// so a course that legitimately has no quizzes isn't penalised.
function _xpRatio(done, total) {
  if (!total || total <= 0) return 1;
  var r = done / total;
  if (r < 0) r = 0;
  if (r > 1) r = 1;
  return r;
}

/**
 * Compute the Course Achievement Score for a single course object
 * (an entry from the cached progress `data.courses[]`).
 * Returns { courseId, title, lessonPct, quizPct, exercisePct, score, isMaster }.
 */
function getCourseAchievement(course) {
  if (!course) return null;
  var lessonRatio = _xpRatio(course.lessonsCompleted, course.totalLessons);
  var quizRatio = _xpRatio(course.quiz ? course.quiz.attempted : 0, course.quiz ? course.quiz.total : 0);
  var exerciseRatio = _xpRatio(course.exercise ? course.exercise.passed : 0, course.exercise ? course.exercise.total : 0);

  var score = (lessonRatio * COURSE_SCORE_WEIGHTS.lessons)
            + (quizRatio * COURSE_SCORE_WEIGHTS.quizzes)
            + (exerciseRatio * COURSE_SCORE_WEIGHTS.exercises);

  // Course Master requires 100% lessons, 100% quizzes, 100% exercises.
  var isMaster = (lessonRatio >= 1) && (quizRatio >= 1) && (exerciseRatio >= 1);

  return {
    courseId: course.id,
    title: course.title,
    lessonPct: Math.round(lessonRatio * 100),
    quizPct: Math.round(quizRatio * 100),
    exercisePct: Math.round(exerciseRatio * 100),
    score: Math.round(score * 100), // 0–100
    isMaster: isMaster,
  };
}

/**
 * Compute Course Achievement Score for every enrolled course using the
 * cached progress data. Returns an array (empty if no cached data yet).
 */
function getAllCourseAchievements() {
  var data = _xpGetCachedProgress();
  if (!data) return [];
  return data.courses.map(getCourseAchievement).filter(function(x){ return !!x; });
}

/**
 * Convenience: look up a single course's achievement by id (frontend cache).
 */
function getCourseAchievementById(courseId) {
  if (!courseId) return null;
  var data = _xpGetCachedProgress();
  if (!data) return null;
  var course = data.courses.find(function(c){ return String(c.id) === String(courseId); });
  return course ? getCourseAchievement(course) : null;
}
