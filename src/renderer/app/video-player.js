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

// ─── Custom Video Player ────────────────────────────────────────────────────
var _vpCurrentUrl = '';
var _vpCurrentQuality = 'Original';
var _vpQualityUrls = {};
var _vpQualityMenuOpen = false;
var _vpIdleTimer = null;

function _vpGetEl() { return document.getElementById('video-player'); }
function _vpFmt(s) { if(!s||isNaN(s))return'0:00'; var m=Math.floor(s/60),ss=Math.floor(s%60); return m+':'+(ss<10?'0':'')+ss; }

function _vpClickVideo(e) {
  if (e.target.closest('#vp-controls') || e.target.closest('button') || e.target.closest('input')) return;
  _vpTogglePlay(e);
}
function _vpTogglePlay(e) { if(e)e.stopPropagation(); var v=_vpGetEl();if(!v)return; if(v.paused)v.play().catch(function(){});else v.pause(); }
function _vpSkip(e,s) { if(e)e.stopPropagation(); var v=_vpGetEl();if(!v)return; v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+s)); }
function _vpMute(e) { if(e)e.stopPropagation(); var v=_vpGetEl();if(!v)return; v.muted=!v.muted; document.getElementById('vp-vol-range').value=v.muted?0:v.volume; _vpUpdVolIcon(); }
function _vpVolChange(val) { var v=_vpGetEl();if(!v)return; v.volume=parseFloat(val); v.muted=(val==0); _vpUpdVolIcon(); }
function _vpUpdVolIcon() { var v=_vpGetEl();if(!v)return; var i=document.getElementById('vp-vol-icon');if(!i)return; i.className='fas '+(v.muted||v.volume===0?'fa-volume-mute':v.volume<0.5?'fa-volume-down':'fa-volume-up'); }
function _vpPiP(e) { if(e)e.stopPropagation(); var v=_vpGetEl();if(!v)return; if(document.pictureInPictureElement)document.exitPictureInPicture().catch(function(){});else if(v.requestPictureInPicture)v.requestPictureInPicture().catch(function(){}); }
function _vpFS(e) { if(e)e.stopPropagation(); var w=document.getElementById('custom-video-player');if(!w)return; if(document.fullscreenElement)document.exitFullscreen();else w.requestFullscreen().catch(function(){}); }

function _vpSeek(e) {
  e.stopPropagation();
  var v=_vpGetEl(),bar=document.getElementById('vp-progress-bar-wrap');if(!v||!v.duration||!bar)return;
  var r=bar.getBoundingClientRect(),pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  v.currentTime=pct*v.duration;
}
function _vpHoverProgress(e) {
  var v=_vpGetEl(),bar=document.getElementById('vp-progress-bar-wrap'),tt=document.getElementById('vp-hover-time');
  if(!v||!v.duration||!bar||!tt)return;
  var r=bar.getBoundingClientRect(),pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  tt.style.display='block'; tt.style.left=(pct*100)+'%'; tt.textContent=_vpFmt(pct*v.duration);
}
function _vpLeaveProgress() { var tt=document.getElementById('vp-hover-time');if(tt)tt.style.display='none'; }

function _vpToggleQualityMenu(e) { if(e)e.stopPropagation(); var m=document.getElementById('vp-quality-menu');if(!m)return; _vpQualityMenuOpen=!_vpQualityMenuOpen; m.style.display=_vpQualityMenuOpen?'block':'none'; }
function _vpSetQuality(label,url) {
  var v=_vpGetEl();if(!v)return; var t=v.currentTime,p=!v.paused;
  _vpCurrentQuality=label; _vpCurrentUrl=url; v.src=url; v.currentTime=t; if(p)v.play().catch(function(){});
  document.getElementById('vp-quality-label').textContent=label;
  document.getElementById('vp-quality-menu').style.display='none'; _vpQualityMenuOpen=false; _vpBuildQualityMenu();
}
function _vpBuildQualityMenu() {
  var menu=document.getElementById('vp-quality-menu');if(!menu)return;
  menu.innerHTML='<div style="font-size:0.65rem;color:rgba(255,255,255,0.4);padding:3px 12px 6px;font-weight:700;text-transform:uppercase;">Quality</div>';
  var entries=[{label:'Original',url:window._vpOriginalUrl||_vpCurrentUrl}];
  Object.keys(_vpQualityUrls).forEach(function(q){entries.push({label:q,url:_vpQualityUrls[q]});});
  entries.forEach(function(en){
    var isA=en.label===_vpCurrentQuality,item=document.createElement('div');
    item.style.cssText='padding:8px 14px;font-size:0.82rem;cursor:pointer;color:'+(isA?'#4ade80':'#fff')+';font-weight:'+(isA?'700':'400')+';display:flex;align-items:center;justify-content:space-between;';
    item.innerHTML=en.label+(isA?' <i class="fas fa-check" style="color:#4ade80;font-size:0.7rem;"></i>':'');
    item.onmouseover=function(){item.style.background='rgba(255,255,255,0.08)';};
    item.onmouseout=function(){item.style.background='none';};
    item.onclick=function(e){e.stopPropagation();_vpSetQuality(en.label,en.url);};
    menu.appendChild(item);
  });
}

function _vpInitPlayer(videoEl) {
  if (videoEl._vpInit) return;
  videoEl._vpInit = true;
  videoEl.addEventListener('play', function(){ document.getElementById('vp-play-icon').className='fas fa-pause'; });
  videoEl.addEventListener('pause', function(){ document.getElementById('vp-play-icon').className='fas fa-play'; });
  videoEl.addEventListener('timeupdate', function(){
    if(!_lessonMarkedComplete&&_pendingLessonComplete&&videoEl.duration&&videoEl.currentTime/videoEl.duration>=0.9){_lessonMarkedComplete=true;markLessonComplete(_pendingLessonComplete);}
    var pct=videoEl.duration?(videoEl.currentTime/videoEl.duration)*100:0;
    var pb=document.getElementById('vp-prog-bar');if(pb)pb.style.width=pct+'%';
    var tm=document.getElementById('vp-time');if(tm)tm.textContent=_vpFmt(videoEl.currentTime)+' / '+_vpFmt(videoEl.duration);
  });
  videoEl.addEventListener('progress', function(){
    if(videoEl.buffered.length>0&&videoEl.duration){var bp=(videoEl.buffered.end(videoEl.buffered.length-1)/videoEl.duration)*100;var bb=document.getElementById('vp-buf-bar');if(bb)bb.style.width=bp+'%';}
  });
  document.addEventListener('fullscreenchange', function(){var i=document.getElementById('vp-fs-icon');if(i)i.className=document.fullscreenElement?'fas fa-compress':'fas fa-expand';});
  document.addEventListener('click', function(e){if(_vpQualityMenuOpen&&!e.target.closest('#vp-quality-wrap')){document.getElementById('vp-quality-menu').style.display='none';_vpQualityMenuOpen=false;}});
  // Auto-hide controls after 3s of no mouse movement
  var wrap=document.getElementById('custom-video-player');
  wrap.addEventListener('mousemove',function(){wrap.classList.remove('vp-idle');clearTimeout(_vpIdleTimer);_vpIdleTimer=setTimeout(function(){if(!videoEl.paused)wrap.classList.add('vp-idle');},3000);});
  wrap.addEventListener('mouseleave',function(){if(!videoEl.paused)wrap.classList.add('vp-idle');});
  // Keyboard
  document.addEventListener('keydown',function(e){
    var w=document.getElementById('custom-video-player');if(!w||w.style.display==='none')return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(e.code==='Space'){e.preventDefault();_vpTogglePlay();}
    else if(e.code==='ArrowRight')_vpSkip(null,10);
    else if(e.code==='ArrowLeft')_vpSkip(null,-10);
    else if(e.code==='KeyF')_vpFS();
    else if(e.code==='KeyM')_vpMute();
  });
}

// Backward compat no-op
function _renderQualityControls(qualityUrls, directUrl) {}

async function loadVideo(url, hlsMasterUrl, hlsQualities) {
  var iframe = document.getElementById('video-iframe');
  var customPlayer = document.getElementById('custom-video-player');
  var videoEl = document.getElementById('video-player');
  if (!iframe || !videoEl || !customPlayer) return;

  _setHlsStatus(null);

  if (!url) {
    iframe.src = ''; iframe.style.display = 'block';
    customPlayer.style.display = 'none';
    return;
  }

  // YouTube — iframe only
  if (url.includes('youtube') || url.includes('youtu.be')) {
    iframe.src = url.includes('?') ? url + '&rel=0' : url + '?rel=0';
    iframe.style.display = 'block';
    customPlayer.style.display = 'none';
    videoEl.src = '';
    return;
  }

  iframe.style.display = 'none';
  iframe.src = '';
  customPlayer.style.display = 'block';

  // Store URLs
  _vpCurrentUrl = url;
  window._vpOriginalUrl = url;
  _vpCurrentQuality = 'Original';
  _vpQualityUrls = (_currentVideoData && _currentVideoData.qualityUrls) ? _currentVideoData.qualityUrls : {};
  _lessonMarkedComplete = false;

  // Set source — let native engine handle buffering
  videoEl.src = url;
  videoEl.volume = 1;
  videoEl.muted = false;

  // Init custom player events (once)
  _vpInitPlayer(videoEl);

  // Reset UI
  var pi = document.getElementById('vp-play-icon'); if(pi) pi.className = 'fas fa-play';
  var pb = document.getElementById('vp-prog-bar'); if(pb) pb.style.width = '0%';
  var bb = document.getElementById('vp-buf-bar'); if(bb) bb.style.width = '0%';
  var tm = document.getElementById('vp-time'); if(tm) tm.textContent = '0:00 / 0:00';
  var vr = document.getElementById('vp-vol-range'); if(vr) vr.value = 1;

  // Build quality menu
  _vpBuildQualityMenu();
  var ql = document.getElementById('vp-quality-label');
  if (ql) ql.textContent = Object.keys(_vpQualityUrls).length > 0 ? 'Original' : 'Auto';
}

// ─── Engagement: Like/Dislike/Views ─────────────────────────────────────────
var _vpCurrentReaction = null; // 'like', 'dislike', or null

async function _vpLoadReactions(lessonId) {
  var bar = document.getElementById('vp-engagement-bar');
  if (bar) bar.style.display = 'flex';
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    var res = await fetch(BASE_URL + '/api/lessons/' + lessonId + '/reaction', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    });
    var data = await res.json();
    if (data.success) {
      document.getElementById('vp-like-count').textContent = data.likes || 0;
      document.getElementById('vp-dislike-count').textContent = data.dislikes || 0;
      document.getElementById('vp-view-count').textContent = data.views || 0;
      _vpCurrentReaction = data.userReaction;
      _vpUpdateReactionUI();
    }
  } catch {}
}

function _vpUpdateReactionUI() {
  var likeBtn = document.getElementById('vp-like-btn');
  var dislikeBtn = document.getElementById('vp-dislike-btn');
  if (likeBtn) {
    if (_vpCurrentReaction === 'like') {
      likeBtn.style.background = 'rgba(34,197,94,0.2)';
      likeBtn.style.borderColor = 'rgba(34,197,94,0.5)';
      likeBtn.style.color = '#4ade80';
      likeBtn.classList.add('active');
    } else {
      likeBtn.style.background = 'rgba(255,255,255,0.05)';
      likeBtn.style.borderColor = 'rgba(255,255,255,0.1)';
      likeBtn.style.color = '#fff';
      likeBtn.classList.remove('active');
    }
  }
  if (dislikeBtn) {
    if (_vpCurrentReaction === 'dislike') {
      dislikeBtn.style.background = 'rgba(239,68,68,0.2)';
      dislikeBtn.style.borderColor = 'rgba(239,68,68,0.5)';
      dislikeBtn.style.color = '#f87171';
      dislikeBtn.classList.add('active');
    } else {
      dislikeBtn.style.background = 'rgba(255,255,255,0.05)';
      dislikeBtn.style.borderColor = 'rgba(255,255,255,0.1)';
      dislikeBtn.style.color = '#fff';
      dislikeBtn.classList.remove('active');
    }
  }
}

async function _vpReact(type) {
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token || !_currentVideoData || !_currentVideoData.lessonId) return;
  try {
    var res = await fetch(BASE_URL + '/api/lessons/' + _currentVideoData.lessonId + '/reaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ type: type }),
    });
    var data = await res.json();
    if (data.success) {
      document.getElementById('vp-like-count').textContent = data.likes || 0;
      document.getElementById('vp-dislike-count').textContent = data.dislikes || 0;
      _vpCurrentReaction = data.userReaction;
      _vpUpdateReactionUI();
    }
  } catch {}
}

async function _vpRecordView(lessonId) {
  // Count view after 30 seconds of watch time (like YouTube)
  var videoEl = document.getElementById('video-player');
  if (!videoEl) return;
  var _viewRecorded = false;
  var _watchStart = 0;
  var _totalWatched = 0;
  var _checkInterval = setInterval(function() {
    if (_viewRecorded) { clearInterval(_checkInterval); return; }
    if (!videoEl.paused && videoEl.currentTime > 0) {
      _totalWatched++;
      if (_totalWatched >= 30) {
        _viewRecorded = true;
        clearInterval(_checkInterval);
        fetch(BASE_URL + '/api/lessons/' + lessonId + '/view', { method: 'POST' }).catch(function(){});
      }
    }
  }, 1000);
  // Cleanup if user navigates away
  videoEl._viewInterval = _checkInterval;
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
    // Record view + load reactions (non-blocking)
    _vpRecordView(lesson.id);
    _vpLoadReactions(lesson.id);
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
