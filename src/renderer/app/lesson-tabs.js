/**
 * CodingKida Desktop — Lesson Tab Renderers
 * Notes, Quiz, Exercise, Weekly Streak, and Homework tab rendering.
 */

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

  let html = '<div class="tab-card notes-card">';
  html += '<div class="notes-card-content">';
  html += '<div class="tab-card-title"><i class="fas fa-file-powerpoint"></i> Module PPT</div>';
  html += '<p class="notes-card-desc">Access the study material (PPT) for this module.</p>';

  if (notePoints && notePoints.length > 0) {
    html += '<ul class="notes-list">';
    notePoints.forEach(note => {
      html += '<li><span class="note-bullet"></span><span>' + sanitize(note) + '</span></li>';
    });
    html += '</ul>';
  }

  if (pdfUrl) {
    html += '<div style="margin-top:16px; display:flex; gap:10px;">';
    html += '<button class="btn btn-outline btn-sm" style="padding:10px 20px; border-radius:10px; display:flex; align-items:center; gap:8px;" onclick="openPdfInApp(\'' + pdfUrl + '\')">';
    html += '<i class="fas fa-file-powerpoint" style="color:#ef4444;"></i> View PPT</button>';
    html += '<button id="pdf-download-btn" class="btn btn-outline btn-sm" style="padding:10px 20px; border-radius:10px; display:flex; align-items:center; gap:8px; border-color:rgba(34,197,94,0.4); color:#22c55e;" onclick="downloadPdfOffline(\'' + pdfUrl + '\')">';
    html += '<i class="fas fa-download"></i> Download PPT</button>';
    html += '</div>';
  }

  if (!pdfUrl && (!notePoints || notePoints.length === 0)) {
    html += '<div style="text-align:center; padding:30px 20px;">';
    html += '<i class="fas fa-file-powerpoint" style="font-size:2.5rem; color:rgba(255,255,255,0.15); margin-bottom:12px; display:block;"></i>';
    html += '<p style="color:var(--muted); font-size:0.9rem;">No PPT available for this module yet.</p>';
    html += '</div>';
  }

  html += '</div>'; // close notes-card-content
  html += '<img src="assets/lesson-notes-book-pen.png" alt="" class="notes-card-illus" draggable="false"/>';
  html += '</div>'; // close notes-card
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
  html += '<p style="font-size:0.76rem;color:var(--muted);margin:-8px 0 16px 0;">Test what you\'ve learned</p>';

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

  // Check if user previously attempted this quiz (for re-attempt warning).
  // Source of truth = BACKEND (QuizAttempt table), so it survives app updates/
  // reinstalls. The local flag is only a fast fallback; we OR them together and
  // re-seed local from backend so both stay consistent.
  var lessonId = _currentLessonForTabs ? _currentLessonForTabs.lessonId : '';
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : '';
  var attemptKey = 'ck_quiz_attempted_' + userId + '_' + lessonId;
  var localAttempted = localStorage.getItem(attemptKey) === 'true';
  var backendAttempted = (typeof _vpQuizAttempted === 'boolean') ? _vpQuizAttempted : false;
  var previouslyAttempted = localAttempted || backendAttempted;
  // If backend confirms an attempt, persist locally so it shows instantly next time.
  if (backendAttempted && !localAttempted && lessonId && userId) {
    try { localStorage.setItem(attemptKey, 'true'); } catch (e) {}
  }

  if (previouslyAttempted) {
    html += '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px 14px;margin-bottom:14px;">';
    html += '<div style="font-size:0.82rem;font-weight:700;color:#fbbf24;">⚠️ You attempted this quiz before. Try again only for Practice.</div>';
    html += '<div style="font-size:0.72rem;color:var(--muted);margin-top:4px;">No coins or leaderboard changes on re-attempts.</div>';
    html += '</div>';
  }
  
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
    html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:18px;">';
    html += '<button class="quiz-submit-btn" style="margin-top:0;" onclick="submitQuiz(' + qIndex + ')">Check Answer</button>';
    // Codo mascot — hint first, then answer on next tap. Hidden until the
    // student submits a WRONG answer (revealed in submitQuiz). No help before
    // answering, and none when the answer is correct.
    html += '<span class="codo-help-wrap" style="display:none;">';
    html += _codoHelpButton('quiz', 'data-quizid="' + (quiz.id || '') + '"');
    html += '</span>';
    html += '</div>';
    html += '<div class="lesson-help-panel" id="lesson-help-quiz-' + (quiz.id || qIndex) + '" style="display:none;"></div>';
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
async function submitQuiz(qIndex) {
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
    // Only now (wrong answer) reveal Codo's help for THIS question. It stays
    // hidden before answering and when the answer is correct.
    const codoWrap = card.querySelector('.codo-help-wrap');
    if (codoWrap) codoWrap.style.display = '';
    // Warm the cache in the background so tapping Codo is instant. Cached items
    // return immediately; uncached ones generate once now instead of on tap.
    const _qid = card.dataset.quizid || '';
    if (_qid) { try { prefetchLessonHelp('quiz', _qid, ''); } catch (e) {} }
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

  // Track quiz completion — mark as attempted + show completion message
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : '';
  if (lessonId && userId) {
    localStorage.setItem('ck_quiz_attempted_' + userId + '_' + lessonId, 'true');
  }

  // Check if this was the last question — show completion summary
  var allCards = document.querySelectorAll('.quiz-question-card');
  var totalQuestions = allCards.length;
  var answeredCount = 0;
  var correctCount = 0;
  allCards.forEach(function(c) {
    var selectedOpt = c.querySelector('.quiz-option.selected');
    if (selectedOpt) {
      answeredCount++;
      if (selectedOpt.classList.contains('correct')) correctCount++;
    }
  });

  if (answeredCount === totalQuestions) {
    // All questions answered — show completion summary
    var completionEl = document.getElementById('quiz-completion-summary');
    if (!completionEl) {
      completionEl = document.createElement('div');
      completionEl.id = 'quiz-completion-summary';
      completionEl.style.cssText = 'background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:14px 18px;margin-top:16px;text-align:center;';
      var tabCard = document.querySelector('#vp-quiz .tab-card');
      if (tabCard) tabCard.appendChild(completionEl);
    }
    completionEl.innerHTML = '<div style="font-size:1rem;font-weight:800;color:#22c55e;margin-bottom:4px;">🎉 You completed this quiz with ' + correctCount + '/' + totalQuestions + ' Correct</div>';
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

  // Show the streak tab button (insert just before the Rate tab)
  const tabsContainer = document.querySelector('.vp-tabs');
  if (tabsContainer && !document.getElementById('streak-tab-btn')) {
    const anchorTab = tabsContainer.querySelector('[onclick*="vp-rate"]') || tabsContainer.lastElementChild;
    const streakTab = document.createElement('div');
    streakTab.id = 'streak-tab-btn';
    streakTab.className = 'vp-tab';
    streakTab.innerHTML = '🔥 Streak';
    streakTab.onclick = function() { switchVpTab(this, 'vp-streak'); };
    if (anchorTab) {
      tabsContainer.insertBefore(streakTab, anchorTab);
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
          updateStreakPips(current + 1);
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
    html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;">';
    html += '<button class="quiz-submit-btn" style="margin-top:0;" onclick="submitExerciseAnswer(' + exIndex + ')">Submit Solution</button>';
    // Codo mascot — waves and offers help; hint first, then answer on next tap.
    html += _codoHelpButton('exercise', 'data-exerciseid="' + (exercise.id || '') + '"');
    html += '</div>';
    html += '<div class="lesson-help-panel" id="lesson-help-exercise-' + (exercise.id || exIndex) + '" style="display:none;"></div>';
    html += '<div id="exercise-submit-result-' + exIndex + '" style="display:none; margin-top:10px; font-size:0.85rem;"></div>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

/**
 * Inject the Codo mascot CSS (wave animation, bubble) once per session.
 */
function _ensureCodoStyles() {
  if (document.getElementById('codo-help-styles')) return;
  const style = document.createElement('style');
  style.id = 'codo-help-styles';
  style.textContent =
    '@keyframes codoWave{0%{transform:rotate(0)}15%{transform:rotate(14deg)}30%{transform:rotate(-8deg)}45%{transform:rotate(14deg)}60%{transform:rotate(-4deg)}75%{transform:rotate(10deg)}100%{transform:rotate(0)}}' +
    '@keyframes codoBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
    // Matched to the .quiz-submit-btn so "Check Answer" and this button are the
    // SAME height and sit on one line. The submit button is padding 12px 28px
    // at 0.88rem (~43px tall). We fix this button to that exact height, center
    // its contents, and shrink the mascot so it fits inside without growing it.
    '.codo-help{display:inline-flex;align-items:center;gap:8px;box-sizing:border-box;height:43px;background:linear-gradient(135deg,rgba(96,165,250,0.12),rgba(167,139,250,0.12));border:1px solid rgba(96,165,250,0.35);border-radius:12px;padding:0 18px 0 6px;cursor:pointer;transition:all 0.2s;vertical-align:middle;}' +
    '.codo-help:hover{border-color:rgba(96,165,250,0.7);box-shadow:0 4px 16px rgba(96,165,250,0.25);transform:translateY(-1px);}' +
    '.codo-help img{width:31px;height:31px;border-radius:50%;object-fit:cover;background:#0b0e14;flex-shrink:0;transform-origin:70% 70%;animation:codoBob 3s ease-in-out infinite;}' +
    '.codo-help:hover img{animation:codoWave 1s ease-in-out;}' +
    '.codo-help.codo-greet img{animation:codoWave 1s ease-in-out 2;}' +
    '.codo-help .codo-say{font-size:0.88rem;font-weight:700;color:#93c5fd;white-space:nowrap;}';
  document.head.appendChild(style);
}

/**
 * Build the Codo mascot "Can I help?" button for a quiz/exercise.
 * `idAttr` is the data-quizid/data-exerciseid attribute string.
 */
function _codoHelpButton(kind, idAttr) {
  _ensureCodoStyles();
  // One-time greeting wave shortly after render.
  setTimeout(function () {
    const btns = document.querySelectorAll('.codo-help:not(.codo-greeted)');
    btns.forEach(function (b) {
      b.classList.add('codo-greet', 'codo-greeted');
      setTimeout(function () { b.classList.remove('codo-greet'); }, 2200);
    });
  }, 400);
  return (
    '<span class="codo-help lesson-help-btn" data-stage="hint" data-kind="' + kind + '" ' + idAttr +
    ' onclick="requestLessonHelp(this)" title="Ask Codo for help">' +
    '<img src="assets/codo.jpg" alt="Codo"/>' +
    '<span class="codo-say">Stuck? Can I help? \uD83D\uDC4B</span>' +
    '</span>'
  );
}

/**
 * "Help from Codo" for a quiz question or theory exercise.
 *
 * Two-stage, kid-friendly flow driven by the button's data-stage:
 *   1st tap  (stage="hint")   -> gentle hint, button becomes "Show the answer"
 *   2nd tap  (stage="answer") -> correct answer + simple reasons from material
 *
 * Calls POST /api/lesson-help on the Next.js backend, which uses the stored
 * correct answer as ground truth and the lesson's study material (RAG) for the
 * explanation. Shares the global BASE_URL / sanitize / token pattern used by
 * the rest of the renderer.
 */
/**
 * Warm the help cache in the BACKGROUND the moment a quiz answer is wrong, so
 * when the student actually taps Codo the text + audio are already fetched and
 * playback/rendering is instant. Fetches both the hint and the answer (text
 * only here — the server returns stored audio in the done frame, which we seed
 * into _codoTtsCache keyed by the exact _plainForSpeech() string the player
 * uses). Best-effort and silent: never shows UI, never throws.
 */
async function prefetchLessonHelp(kind, quizId, exerciseId) {
  const stages = ['hint', 'answer'];
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  for (let s = 0; s < stages.length; s++) {
    const stage = stages[s];
    try {
      const res = await fetch(BASE_URL + '/api/lesson-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ kind, quizId, exerciseId, stage, stream: true }),
      });
      if (!res.ok || !res.body) continue;
      // Drain the SSE stream silently; capture the final `done` frame to seed
      // the audio cache so the first real tap plays instantly with no /api/tts.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      let meta = null;
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.indexOf('data:') !== 0) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let frame;
          try { frame = JSON.parse(payload); } catch (e) { continue; }
          if (frame.type === 'text' && frame.chunk) { full += frame.chunk; }
          else if (frame.type === 'done') {
            meta = frame;
            if (typeof frame.help === 'string' && frame.help) full = frame.help;
          }
        }
      }
      if (meta && meta.audio && full) {
        const spokenText = _plainForSpeech(full);
        _codoTtsCache[spokenText] = meta.audio;
      }
    } catch (e) { /* best-effort prefetch — ignore */ }
  }
}

async function requestLessonHelp(btn) {
  if (!btn) return;
  const stage = btn.getAttribute('data-stage') || 'hint';
  const kind = btn.getAttribute('data-kind') || 'quiz';
  const quizId = btn.getAttribute('data-quizid') || '';
  const exerciseId = btn.getAttribute('data-exerciseid') || '';

  // Find this item's help panel (sibling after the button row).
  const panelId = kind === 'quiz'
    ? 'lesson-help-quiz-' + (quizId || '')
    : 'lesson-help-exercise-' + (exerciseId || '');
  let panel = document.getElementById(panelId);
  if (!panel) {
    // Fallback: nearest .lesson-help-panel in the same card.
    const card = btn.closest('.quiz-question-card, .exercise-card');
    panel = card ? card.querySelector('.lesson-help-panel') : null;
  }
  if (!panel) return;

  // Loading state. For the Codo mascot, keep the image and only change the
  // speech-bubble text; for a plain button, swap the whole label.
  const origHtml = btn.innerHTML;
  const sayEl = btn.querySelector ? btn.querySelector('.codo-say') : null;
  const origSay = sayEl ? sayEl.innerHTML : '';
  btn.style.opacity = '0.75';
  btn.style.pointerEvents = 'none';
  if (sayEl) {
    sayEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Codo is thinking...';
  } else {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Codo is thinking...';
  }
  panel.style.display = 'block';
  panel.innerHTML = '';

  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    const res = await fetch(BASE_URL + '/api/lesson-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      // Ask the server to stream the answer so words appear immediately
      // instead of after the whole reply is generated.
      body: JSON.stringify({ kind, quizId, exerciseId, stage, stream: true }),
    });

    // If the server streamed (text/event-stream), render progressively.
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (res.ok && res.body && ctype.indexOf('text/event-stream') !== -1) {
      await _streamLessonHelp(res, { btn, panel, stage, sayEl, origSay, origHtml });
      return;
    }

    // Fallback: non-streaming JSON (older server deploy or any other client).
    const data = await res.json();

    btn.disabled = false;
    btn.style.opacity = '1';

    if (data && data.success && data.help) {
      const isHint = stage === 'hint';
      const title = isHint ? '💡 Codo\u2019s hint' : '\u2705 The answer, explained';
      const accent = isHint ? '#fbbf24' : '#22c55e';
      const bg = isHint ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.08)';
      const border = isHint ? 'rgba(251,191,36,0.25)' : 'rgba(34,197,94,0.25)';

      // Light markdown: code fences, inline code, bold, newlines.
      const formatted = _formatHelpText(data.help);

      const block = document.createElement('div');
      block.style.cssText = 'margin-top:12px;padding:14px 16px;background:' + bg + ';border:1px solid ' + border + ';border-radius:12px;';

      // Plain text (markdown stripped) for Codo to read aloud.
      const spokenText = _plainForSpeech(data.help);
      const speakId = 'codo-speak-' + Date.now();

      let inner =
        '<div style="font-size:0.82rem;font-weight:800;color:' + accent + ';margin-bottom:8px;display:flex;align-items:center;gap:8px;">' +
        '<span style="font-size:1.1rem;">\uD83E\uDD9C</span> ' + title +
        '<button id="' + speakId + '" onclick="toggleCodoSpeak(this)" data-text="' + encodeURIComponent(spokenText) + '" title="Hear Codo read it" style="margin-left:auto;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:4px 10px;color:' + accent + ';font-size:0.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;"><i class="fas fa-volume-up"></i> Listen</button>' +
        '</div>' +
        '<div style="font-size:0.86rem;line-height:1.6;color:#e2e8f0;">' + formatted + '</div>';

      // Source attribution (answer stage only): where did this come from?
      if (!isHint) {
        const srcType = data.source; // study_material | teacher_note | ai
        const sources = Array.isArray(data.sources) ? data.sources : [];

        if (srcType === 'study_material' && sources.length > 0) {
          inner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);">';
          inner += '<div style="font-size:0.72rem;font-weight:700;color:#86efac;margin-bottom:6px;">\uD83D\uDCD8 From your course material:</div>';
          sources.forEach(function (s) {
            const name = sanitize(s.name || 'Document');
            inner += '<div style="margin:8px 0;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">';
            if (s.fileUrl) {
              // Clickable — opens the document to verify the explanation.
              inner += '<a href="#" onclick="openHelpSource(this); return false;" data-fileurl="' + encodeURIComponent(s.fileUrl) + '" style="color:#60a5fa;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-file-pdf" style="color:#f87171;"></i> ' + name + ' <i class="fas fa-external-link-alt" style="font-size:0.65rem;opacity:0.7;"></i></a>';
            } else {
              inner += '<div style="color:#cbd5e1;font-size:0.8rem;font-weight:600;"><i class="fas fa-file-alt"></i> ' + name + '</div>';
            }
            // "Search for this" snippet so kids can Ctrl+F in a big PDF.
            if (s.snippet) {
              inner += '<div style="margin-top:6px;font-size:0.74rem;color:#94a3b8;line-height:1.4;"><span style="color:#fbbf24;">\uD83D\uDD0D Find this in the doc:</span> \u201C' + sanitize(s.snippet) + '\u201D</div>';
            }
            inner += '</div>';
          });
          inner += '</div>';
        } else if (srcType === 'teacher_note') {
          inner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);font-size:0.72rem;color:#cbd5e1;">\uD83D\uDCDD Based on the lesson\u2019s teacher note.</div>';
        } else if (srcType === 'ai') {
          inner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);font-size:0.72rem;color:#cbd5e1;">\uD83E\uDD16 General explanation (not found in your course material).</div>';
        }
      }

      block.innerHTML = inner;
      panel.appendChild(block);

      // If the server shipped pre-computed audio, seed the client cache so
      // playback is instant with no second /api/tts call.
      if (data.audio) {
        _codoTtsCache[spokenText] = data.audio;
      }

      // Codo reads the hint/answer aloud automatically (same text as on screen).
      _codoSpeak(spokenText, document.getElementById(speakId));

      // After a HINT, flip the button to reveal the full answer on next tap.
      if (isHint) {
        // After a HINT, flip to reveal the full answer on next tap.
        btn.setAttribute('data-stage', 'answer');
        btn.style.pointerEvents = '';
        if (sayEl) {
          sayEl.innerHTML = 'Still stuck? Show the answer';
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-check-circle"></i> Still stuck? Show the answer';
        }
      } else {
        // Answer shown — nothing more to reveal; hide the button.
        btn.style.display = 'none';
      }
    } else {
      // Request succeeded but no help text — restore and show a gentle notice.
      btn.style.pointerEvents = '';
      if (sayEl) { sayEl.innerHTML = origSay; } else { btn.disabled = false; btn.innerHTML = origHtml; }
      panel.innerHTML = '<div style="margin-top:12px;padding:12px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;color:#f59e0b;font-size:0.82rem;">\u23f3 ' + sanitize((data && data.message) || 'Codo is a little busy. Please try again in a moment.') + '</div>';
    }
  } catch (e) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
    if (sayEl) { sayEl.innerHTML = origSay; } else { btn.disabled = false; btn.innerHTML = origHtml; }
    panel.innerHTML = '<div style="margin-top:12px;padding:12px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;color:#f59e0b;font-size:0.82rem;">\u23f3 Codo is a little busy. Please try again in a moment.</div>';
  }
}

/**
 * Read the SSE stream from /api/lesson-help and render Codo's answer as it
 * arrives, so the child sees words almost immediately. The server sends
 * `{type:"text", chunk}` frames while generating, then one `{type:"done", ...}`
 * frame with the full text + source attribution. We speak only once the full
 * text is in (TTS needs the whole sentence to sound natural).
 *
 * ctx: { btn, panel, stage, sayEl, origSay, origHtml }
 */
async function _streamLessonHelp(res, ctx) {
  const btn = ctx.btn, panel = ctx.panel, stage = ctx.stage;
  const sayEl = ctx.sayEl;
  const isHint = stage === 'hint';
  const title = isHint ? '💡 Codo\u2019s hint' : '\u2705 The answer, explained';
  const accent = isHint ? '#fbbf24' : '#22c55e';
  const bg = isHint ? 'rgba(251,191,36,0.08)' : 'rgba(34,197,94,0.08)';
  const border = isHint ? 'rgba(251,191,36,0.25)' : 'rgba(34,197,94,0.25)';
  const speakId = 'codo-speak-' + Date.now();

  btn.disabled = false;
  btn.style.opacity = '1';

  // Build the block shell up front; stream text into the body div.
  const block = document.createElement('div');
  block.style.cssText = 'margin-top:12px;padding:14px 16px;background:' + bg + ';border:1px solid ' + border + ';border-radius:12px;';
  block.innerHTML =
    '<div style="font-size:0.82rem;font-weight:800;color:' + accent + ';margin-bottom:8px;display:flex;align-items:center;gap:8px;">' +
    '<span style="font-size:1.1rem;">\uD83E\uDD9C</span> ' + title +
    '<button id="' + speakId + '" onclick="toggleCodoSpeak(this)" title="Hear Codo read it" style="margin-left:auto;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:4px 10px;color:' + accent + ';font-size:0.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;opacity:0.5;pointer-events:none;"><i class="fas fa-volume-up"></i> Listen</button>' +
    '</div>' +
    '<div class="codo-help-body" style="font-size:0.86rem;line-height:1.6;color:#e2e8f0;"><span style="opacity:0.6;"><i class="fas fa-spinner fa-spin"></i> Codo is writing\u2026</span></div>' +
    '<div class="codo-help-sources"></div>';
  panel.innerHTML = '';
  panel.appendChild(block);
  const bodyEl = block.querySelector('.codo-help-body');
  const sourcesEl = block.querySelector('.codo-help-sources');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let meta = null;
  let started = false;

  const flushText = function () {
    bodyEl.innerHTML = _formatHelpText(full);
  };

  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      buffer += decoder.decode(r.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.indexOf('data:') !== 0) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        let frame;
        try { frame = JSON.parse(payload); } catch (e) { continue; }
        if (frame.type === 'text' && frame.chunk) {
          if (!started) { started = true; bodyEl.innerHTML = ''; }
          full += frame.chunk;
          flushText();
        } else if (frame.type === 'done') {
          meta = frame;
          if (typeof frame.help === 'string' && frame.help) { full = frame.help; }
          flushText();
        }
      }
    }
  } catch (e) {
    // Stream broke mid-way — if we have partial text, keep it; else error out.
  }

  if (!full) {
    panel.innerHTML = '<div style="margin-top:12px;padding:12px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;color:#f59e0b;font-size:0.82rem;">\u23f3 Codo is a little busy. Please try again in a moment.</div>';
    btn.style.pointerEvents = '';
    if (sayEl) { sayEl.innerHTML = ctx.origSay; } else { btn.disabled = false; btn.innerHTML = ctx.origHtml; }
    return;
  }

  // Source attribution (answer stage only).
  if (!isHint && meta) {
    _renderHelpSources(sourcesEl, meta.source, Array.isArray(meta.sources) ? meta.sources : []);
  }

  // Enable the Listen button, then speak the full text (same as on screen).
  const spokenText = _plainForSpeech(full);
  const speakBtn = document.getElementById(speakId);
  if (speakBtn) {
    speakBtn.setAttribute('data-text', encodeURIComponent(spokenText));
    speakBtn.style.opacity = '1';
    speakBtn.style.pointerEvents = '';
  }
  // If the server already had the audio cached (pre-computed), it ships it in
  // the done frame — seed our client cache so playback is instant with NO
  // second /api/tts call. Otherwise _codoSpeak fetches it the normal way.
  if (meta && meta.audio) {
    _codoTtsCache[spokenText] = meta.audio;
  }
  _codoSpeak(spokenText, speakBtn);

  // Flip the button: after a hint, reveal the answer next; after an answer, hide.
  if (isHint) {
    btn.setAttribute('data-stage', 'answer');
    btn.style.pointerEvents = '';
    if (sayEl) { sayEl.innerHTML = 'Still stuck? Show the answer'; }
    else { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Still stuck? Show the answer'; }
  } else {
    btn.style.display = 'none';
  }
}

/**
 * Render the "where this came from" source block for a streamed answer.
 * Mirrors the attribution markup used in the non-streaming path.
 */
function _renderHelpSources(container, srcType, sources) {
  if (!container) return;
  let inner = '';
  if (srcType === 'study_material' && sources.length > 0) {
    inner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);">';
    inner += '<div style="font-size:0.72rem;font-weight:700;color:#86efac;margin-bottom:6px;">\uD83D\uDCD8 From your course material:</div>';
    sources.forEach(function (s) {
      const name = sanitize(s.name || 'Document');
      inner += '<div style="margin:8px 0;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">';
      if (s.fileUrl) {
        inner += '<a href="#" onclick="openHelpSource(this); return false;" data-fileurl="' + encodeURIComponent(s.fileUrl) + '" style="color:#60a5fa;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-file-pdf" style="color:#f87171;"></i> ' + name + ' <i class="fas fa-external-link-alt" style="font-size:0.65rem;opacity:0.7;"></i></a>';
      } else {
        inner += '<div style="color:#cbd5e1;font-size:0.8rem;font-weight:600;"><i class="fas fa-file-alt"></i> ' + name + '</div>';
      }
      if (s.snippet) {
        inner += '<div style="margin-top:6px;font-size:0.74rem;color:#94a3b8;line-height:1.4;"><span style="color:#fbbf24;">\uD83D\uDD0D Find this in the doc:</span> \u201C' + sanitize(s.snippet) + '\u201D</div>';
      }
      inner += '</div>';
    });
    inner += '</div>';
  } else if (srcType === 'teacher_note') {
    inner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);font-size:0.72rem;color:#cbd5e1;">\uD83D\uDCDD Based on the lesson\u2019s teacher note.</div>';
  } else if (srcType === 'ai') {
    inner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);font-size:0.72rem;color:#cbd5e1;">\uD83E\uDD16 General explanation (not found in your course material).</div>';
  }
  container.innerHTML = inner;
}

/**
 * Small, safe markdown-to-HTML formatter for help text (mirrors ai-chat.js).
 * Escapes code content; renders fences, inline code, bold, and line breaks.
 */
function _formatHelpText(text) {
  return String(text || '')
    .replace(/```(\w*)\n([\s\S]*?)```/g, function (m, lang, code) {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<pre style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:0.8rem;color:#a78bfa;">' + escaped + '</pre>';
    })
    .replace(/`([^`]+)`/g, function (m, code) {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return '<code style="background:rgba(108,71,255,0.15);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:#c4b5fd;">' + escaped + '</code>';
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff;">$1</strong>')
    .replace(/\n/g, '<br/>');
}

/**
 * Open a source document (PDF/notes) referenced by a Help answer.
 * Private S3 files need a short-lived signed URL, which we fetch from the
 * backend (/api/media/signed-url) before opening in the external browser.
 */
async function openHelpSource(linkEl) {
  if (!linkEl) return;
  const fileUrl = decodeURIComponent(linkEl.getAttribute('data-fileurl') || '');
  if (!fileUrl) return;

  const origText = linkEl.innerHTML;
  linkEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opening...';

  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    const res = await fetch(BASE_URL + '/api/media/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ url: fileUrl }),
    });
    const data = await res.json();
    const openUrl = (data && data.success && data.signedUrl) ? data.signedUrl : fileUrl;

    // Open INSIDE the app using the built-in PDF canvas viewer (same one course
    // content uses) instead of the external browser. _openPdfInCanvas is defined
    // in pdf-viewer.js and loaded globally in the renderer.
    if (typeof _openPdfInCanvas === 'function') {
      _openPdfInCanvas(openUrl);
    } else if (typeof openPdfInApp === 'function') {
      // Fallback to the higher-level opener (it signs S3 URLs itself).
      openPdfInApp(fileUrl);
    } else if (window.electron && typeof window.electron.openExternal === 'function') {
      // Last resort: external browser.
      window.electron.openExternal(openUrl);
    } else {
      window.open(openUrl, '_blank');
    }
  } catch (e) {
    // On failure, try the in-app opener, else the raw URL.
    try {
      if (typeof openPdfInApp === 'function') openPdfInApp(fileUrl);
      else window.open(fileUrl, '_blank');
    } catch (_) {}
  } finally {
    linkEl.innerHTML = origText;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Codo voice — reads hints/answers aloud using the browser's built-in
// Web Speech API (speechSynthesis). No external service, no cost, works
// offline inside Electron's Chromium.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Convert help text (which may contain markdown/code) into clean, natural
 * text for speech. Removes code fences, backticks, bold markers, emojis, and
 * collapses whitespace so Codo doesn't read "asterisk" or symbol noise.
 */
function _plainForSpeech(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' . Here is a code example on screen. ') // skip code blocks
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[_#>`]/g, '')
    // Strip emoji & pictographs so TTS never reads "star"/"rocket"/"चमकता सितारा".
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\uFE0F\u200D\u20E3]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
    // Speak MATH/LOGIC operators as words so "5+4" reads "5 plus 4", not "5 4".
    .replace(/\+/g, ' plus ')
    .replace(/(\w)\s*-\s*(\w)/g, '$1 minus $2') // minus only between terms
    .replace(/\*/g, ' times ')
    .replace(/÷/g, ' divided by ')
    .replace(/=/g, ' equals ')
    .replace(/%/g, ' percent ')
    .replace(/&&/g, ' and ')
    .replace(/\|\|/g, ' or ')
    .replace(/&/g, ' and ')
    .replace(/</g, ' less than ')
    .replace(/>/g, ' greater than ')
    // Remove only the noisy brackets/slashes TTS would read as "open bracket".
    // Keep sentence punctuation (. , ? !) so speech still sounds natural.
    .replace(/[()[\]{}|/\\~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pick a pleasant voice for Codo (prefers an English, slightly higher-pitched
 * voice for a friendly kid-buddy feel). Falls back to the default voice.
 */
function _codoPickVoice() {
  try {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (!voices || !voices.length) return null;
    // Prefer a natural English voice; many systems label good ones "Google"/"Natural".
    return (
      voices.find(function (v) { return /en(-|_)?(US|GB|IN)/i.test(v.lang) && /natural|google|zira|aria/i.test(v.name); }) ||
      voices.find(function (v) { return /^en/i.test(v.lang); }) ||
      voices[0]
    );
  } catch (e) { return null; }
}

/** Pick a Hindi voice for the browser fallback when Codo answered in Hindi. */
function _codoPickHindiVoice() {
  try {
    const voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (!voices || !voices.length) return null;
    return (
      voices.find(function (v) { return /hi(-|_)?IN/i.test(v.lang); }) ||
      voices.find(function (v) { return /^hi/i.test(v.lang); }) ||
      null
    );
  } catch (e) { return null; }
}

// Active premium-TTS audio element (so Stop / new speech can cancel it).
var _codoAudio = null;
// Simple client cache: text -> base64 mp3, so replaying is instant and free.
var _codoTtsCache = {};
// True while a TTS fetch is in flight. Blocks repeated Listen/Stop taps so a
// second request can't start (and voices can't overlap) until the current
// fetch finishes.
var _codoLoading = false;

/** Stop any Codo audio AND any browser speech currently playing. */
function _codoStopAll() {
  try {
    if (_codoAudio) {
      // Detach handlers BEFORE pausing/clearing. Clearing src fires the audio
      // element's 'error' event; if onerror were still attached it would wrongly
      // trigger the browser-voice fallback (causing a second, English voice to
      // start on a stop/quick-replay). Nulling them keeps a stop silent.
      _codoAudio.onended = null;
      _codoAudio.onerror = null;
      _codoAudio.pause();
      _codoAudio.src = '';
      _codoAudio = null;
    }
  } catch (e) {}
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
}

function _codoSetBtn(btn, state) {
  if (!btn) return;
  if (state === 'thinking') {
    // Fetching audio/text from the server. Disable so rapid Listen/Stop taps
    // can't fire a second request or start/stop overlap mid-fetch.
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Thinking...';
    btn.setAttribute('disabled', 'disabled');
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.6';
    return;
  }
  // Any non-thinking state re-enables the button.
  btn.removeAttribute('disabled');
  btn.style.pointerEvents = '';
  btn.style.opacity = '';
  btn.innerHTML = state === 'stop'
    ? '<i class="fas fa-stop"></i> Stop'
    : '<i class="fas fa-volume-up"></i> Listen';
}

/**
 * Speak text as Codo. Tries the premium backend voice (/api/tts — natural
 * Hindi or Indian-English male, matching the answer language) first; if that
 * is unavailable, offline, or errors, falls back to the browser's built-in
 * voice so "Listen" always works.
 */
async function _codoSpeak(text, btn) {
  if (!text) return;
  _codoStopAll(); // never overlap a previous play

  // 1) Try premium TTS (play MP3). Cache per-text so replays are instant/free.
  try {
    let b64 = _codoTtsCache[text];
    if (!b64) {
      // Fetch needed — show "Thinking..." and lock the button so repeated
      // Listen/Stop taps can't fire another request or overlap voices.
      _codoLoading = true;
      _codoSetBtn(btn, 'thinking');
      const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
      try {
        const res = await fetch(BASE_URL + '/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ text: text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.audio) {
            b64 = data.audio;
            _codoTtsCache[text] = b64;
          }
        }
      } finally {
        // Fetch finished (success or fail) — release the lock. The button
        // state is set below (stop while playing, or listen on fallback).
        _codoLoading = false;
      }
    }
    if (b64) {
      const audio = new Audio('data:audio/mp3;base64,' + b64);
      _codoAudio = audio;
      _codoSetBtn(btn, 'stop');
      audio.onended = function () { _codoSetBtn(btn, 'listen'); if (_codoAudio === audio) _codoAudio = null; };
      // IMPORTANT: do NOT fall back to the browser (English) voice here. We
      // already have the premium MP3 in hand; an 'error' at this point is
      // almost always a stop/quick-replay interruption, not a decode failure.
      // Falling back would start a second, different voice. Just reset the UI.
      audio.onerror = function () { _codoSetBtn(btn, 'listen'); if (_codoAudio === audio) _codoAudio = null; };
      try {
        await audio.play();
      } catch (e) {
        // play() rejects (e.g. AbortError) when a previous play was stopped and
        // replayed quickly. The MP3 is valid and cached — retry once on the same
        // premium audio rather than switching to the browser voice.
        try {
          audio.currentTime = 0;
          await audio.play();
        } catch (e2) {
          _codoSetBtn(btn, 'listen');
          if (_codoAudio === audio) _codoAudio = null;
        }
      }
      return; // premium voice is playing (or will retry) — never browser voice here
    }
  } catch (e) {
    // fall through to the browser voice only when we truly have no MP3
  } finally {
    // Safety: never leave the button stuck in the disabled "thinking" lock,
    // whatever path we took above.
    _codoLoading = false;
  }

  // 2) Fallback: browser voice — only reached when the premium MP3 could not be
  // obtained at all (TTS not configured / network error on first fetch).
  _codoSpeakBrowser(text, btn);
}

/** Browser (offline) voice fallback — the original speechSynthesis path. */
function _codoSpeakBrowser(text, btn) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    // Energetic, kid-friendly delivery to match the premium voice.
    utter.rate = 1.05;
    utter.pitch = 1.25;
    utter.volume = 1;
    // If Codo answered in Hindi (Devanagari), ask the browser for a Hindi
    // voice + locale so the fallback also speaks Hindi where available.
    const isHindi = /[\u0900-\u097F]/.test(text);
    const voice = isHindi ? _codoPickHindiVoice() : _codoPickVoice();
    if (isHindi) utter.lang = 'hi-IN';
    if (voice) utter.voice = voice;
    if (btn) {
      utter.onstart = function () { _codoSetBtn(btn, 'stop'); };
      utter.onend = function () { _codoSetBtn(btn, 'listen'); };
      utter.onerror = function () { _codoSetBtn(btn, 'listen'); };
    }
    if (!voice && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = function () {
        const v = _codoPickVoice();
        if (v) utter.voice = v;
        window.speechSynthesis.speak(utter);
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      window.speechSynthesis.speak(utter);
    }
  } catch (e) { /* best-effort */ }
}

/**
 * Listen button toggle: if Codo is speaking (premium audio OR browser), stop;
 * otherwise read the text.
 */
function toggleCodoSpeak(btn) {
  // Ignore taps while a TTS fetch is in flight. The button is already shown as
  // "Thinking..." and disabled; this is a belt-and-braces guard so a stray
  // programmatic call can't start a second request or overlap voices.
  if (_codoLoading) return;

  const speaking = (_codoAudio && !_codoAudio.paused) ||
    (('speechSynthesis' in window) && window.speechSynthesis.speaking);
  if (speaking) {
    _codoStopAll();
    _codoSetBtn(btn, 'listen');
    return;
  }
  const text = decodeURIComponent((btn && btn.getAttribute('data-text')) || '');
  _codoSpeak(text, btn);
}
