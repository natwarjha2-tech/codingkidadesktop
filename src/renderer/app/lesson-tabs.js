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
  html += '<div class="tab-card-title"><i class="fas fa-file-alt"></i> Lesson Notes</div>';
  html += '<p class="notes-card-desc">Access detailed notes for this lesson.</p>';

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
