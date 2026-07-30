/**
 * CodingKida Desktop — Video Player
 * HLS/direct video playback, lesson tab switching, video opening, streak tracking.
 */

// Lazy load state for lesson tabs
var _currentLessonForTabs = null;
var _tabDataLoaded = { quiz: false, exercise: false, streak: false, homework: false, rate: false };

// ─── HLS / Video Player ───────────────────────────────────────────────────────
var _hlsInstance = null; // not used anymore — kept for compatibility
var _currentVideoData = null;
let _currentLessonContext = null;
let _pendingLessonComplete = null;
let _lessonMarkedComplete = false;

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

// Mark lesson as complete when video is opened
async function markLessonComplete(lessonId) {
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
