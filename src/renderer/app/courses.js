/**
 * CodingKida Desktop — Courses
 * Course listing, filtering, search, enrollment, course detail rendering.
 */

// Courses — Backend API with mockData fallback
// Backend: GET /api/courses → { success, courses: [...] }
// Backend: GET /api/courses/:id → { success, course: { ...modules: [...lessons] } }

let currentCourseId = null;
let _allCourseCategories = ['All', 'Programming', 'Web Dev', 'Data Science', 'DSA'];
let _searchTimeout = null;

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
  // Cache-first: return cached data instantly if no filters applied
  if (!category && !search) {
    var cached = ckCacheGet('/api/courses');
    if (cached && cached.success && cached.courses) {
      // Background refresh (stale-while-revalidate)
      CoursesAPI.getAll().then(function(data) {
        if (data && data.success && data.courses) {
          ckCacheSet('/api/courses', data);
          // Silently update UI if data changed
          renderCourseGrid(data.courses.map(mapCourse));
        }
      }).catch(function() {});
      return cached.courses.map(mapCourse);
    }
  }
  try {
    const data = await CoursesAPI.getAll(category, search);
    if (data.success && data.courses) {
      // Cache only unfiltered results
      if (!category && !search) ckCacheSet('/api/courses', data);
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
    var accent = '#6c47ff';
    if (gradient.includes('#ec4899') || gradient.includes('236,72,153')) accent = '#ec4899';
    else if (gradient.includes('#f97316') || gradient.includes('249,115,22')) accent = '#f97316';
    var diff = 'Beginner', diffColor = '#22c55e';
    if (c.title && (c.title.toLowerCase().includes('java') || c.title.toLowerCase().includes('mern') || c.title.toLowerCase().includes('dsa'))) { diff = 'Intermediate'; diffColor = '#f97316'; }
    var tl = (c.title || '').toLowerCase().trim();
    var bannerImg = '';
    if (tl === 'c' || tl.includes('c programming') || tl.startsWith('c ')) bannerImg = 'assets/C.png.jpeg';
    else if (tl.includes('java')) bannerImg = 'assets/Java.png.jpeg';
    else if (tl.includes('python')) bannerImg = 'assets/Python.png.jpeg';
    var headerContent = bannerImg
      ? '<img src="' + bannerImg + '" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center center;position:absolute;inset:0;z-index:1;" draggable="false"/>'
      : '<i class="' + c.icon + '" style="font-size:4rem;color:rgba(255,255,255,0.95);z-index:1;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));"></i>';
    return `
    <div class="course-card hover-glow" style="background:#161B22; border:1px solid rgba(255,255,255,0.06); border-radius:20px; overflow:hidden; cursor:default; box-shadow:0 8px 24px rgba(0,0,0,0.3); transition:transform 0.25s, box-shadow 0.25s;">
      <div style="aspect-ratio:16/9; background:${gradient}; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.4));z-index:2;"></div>
        ${headerContent}
      </div>
      <div style="padding:18px;">
        <h3 style="font-size:1.05rem; font-weight:800; color:#fff; margin-bottom:6px; line-height:1.3;">${sanitize(c.title)}</h3>
        <p style="font-size:0.8rem; color:var(--muted); margin-bottom:12px; line-height:1.5; min-height:36px;">${sanitize(c.subtitle)}</p>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
          <span style="display:flex;align-items:center;gap:4px;font-size:0.82rem;font-weight:700;color:#F59E0B;"><i class="fas fa-star"></i> ${c.rating || '4.8'}</span>
          <span style="font-size:0.72rem;color:#F59E0B;">★★★★★</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
          <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:0.7rem;font-weight:600;color:rgba(255,255,255,0.65);"><i class="fas fa-book-open" style="font-size:0.6rem;opacity:0.7;"></i> ${(c.modules||[]).reduce(function(n,m){return n+(m.lessons||[]).length;},0)} Lessons</span>
          <span data-card-duration="${c.id}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:0.7rem;font-weight:600;color:rgba(255,255,255,0.65);"><i class="fas fa-clock" style="font-size:0.6rem;opacity:0.7;"></i> --</span>
          <span style="display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:0.7rem;font-weight:600;color:rgba(255,255,255,0.65);"><i class="fas fa-user-graduate" style="font-size:0.6rem;opacity:0.7;"></i> ${c.students || '0'} Students</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button onclick="openCourseDetail('${c.id}')" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 22px ${accent}66'" onmouseleave="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 16px ${accent}44'" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:12px;border:none;background:linear-gradient(135deg,${accent},${accent}cc);color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;box-shadow:0 4px 16px ${accent}44;transition:transform 0.2s ease,box-shadow 0.2s ease;">Start Learning <i class="fas fa-arrow-right" style="font-size:0.65rem;"></i></button>
          <span style="padding:8px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);font-size:0.72rem;font-weight:700;color:rgba(255,255,255,0.7);">👑 Pro</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Async: detect real durations for each course card
  courses.forEach(function(c) {
    var lessons = [];
    (c.modules || []).forEach(function(m) {
      (m.lessons || []).forEach(function(l) {
        if(l.videoUrl) lessons.push(l);
      });
    });
    if(lessons.length > 0) {
      detectAllDurations(lessons).then(function(durationMap) {
        var totalSec = 0;
        Object.keys(durationMap).forEach(function(k) { totalSec += durationMap[k]; });
        var el = document.querySelector('[data-card-duration="' + c.id + '"]');
        if(el) el.innerHTML = '<i class="fas fa-clock" style="font-size:0.6rem;opacity:0.7;"></i> ' + formatCourseDuration(totalSec);
      });
    }
  });
}

async function openCourseDetail(courseId) {
  currentCourseId = courseId;

  // Cache-first: show cached course detail instantly
  var cacheKey = '/api/courses/' + courseId;
  var cached = ckCacheGet(cacheKey);

  if (cached && cached.success && cached.course) {
    renderCourseDetailFromBackend(cached.course);
    // If fresh, skip API call
    if (ckCacheIsFresh(cacheKey)) return;
  }

  // Try backend (always if stale or no cache)
  let course = null;
  try {
    const data = await CoursesAPI.getByIdSigned(courseId);
    if (data.success && data.course) {
      ckCacheSet(cacheKey, data);
      course = data.course;
      renderCourseDetailFromBackend(course);
      return;
    }
  } catch (err) {
    // If we showed cached data, that's fine — don't fallback to mock
    if (cached && cached.success) return;
  }

  // mockData fallback (id is number in mockData)
  course = MOCK_COURSES.find(c => c.id == courseId);
  if (!course) return;
  renderCourseDetailFromMock(course);
}

function renderCourseDetailFromBackend(course) {
  // --- Hero Section ---
  var heroTitle = document.getElementById('cd-hero-title');
  if(heroTitle) heroTitle.textContent = course.title || '';
  var heroInstructor = document.getElementById('cd-hero-instructor');
  if(heroInstructor) heroInstructor.textContent = course.instructor || '';
  var heroRating = document.getElementById('cd-hero-rating');
  if(heroRating) heroRating.textContent = '--';
  var heroStudents = document.getElementById('cd-hero-students');
  if(heroStudents) heroStudents.textContent = '0';

  // Hero logo (dynamic, works for any course)
  var heroLogo = document.getElementById('cd-hero-logo');
  if(heroLogo) {
    var tl = (course.title || '').toLowerCase().trim();
    var logoImg = '';
    if (tl === 'c' || tl.includes('c programming') || tl.startsWith('c ')) logoImg = 'assets/c-logo.png';
    else if (tl.includes('java')) logoImg = 'assets/java-logo.png';
    else if (tl.includes('python')) logoImg = 'assets/python-logo.png';
    heroLogo.innerHTML = logoImg
      ? '<img src="' + logoImg + '" alt="" draggable="false"/>'
      : '<i class="fas fa-code"></i>';
  }

  // CTA button
  var priceBtn = document.getElementById('cd-price-btn');
  if (course.isFree) {
    priceBtn.textContent = 'Free Course';
    priceBtn.className = 'cd-cta-btn cd-cta-free';
    priceBtn.onclick = null;
  } else if (course.isEnrolled) {
    priceBtn.innerHTML = '<i class="fas fa-check"></i> Enrolled';
    priceBtn.className = 'cd-cta-btn cd-cta-enrolled';
    priceBtn.onclick = null;
  } else {
    priceBtn.textContent = 'Unlock Course';
    priceBtn.className = 'cd-cta-btn cd-cta-unlock';
    priceBtn.onclick = function(){ openPaymentPage(course.id); };
  }

  // Collect all lessons
  var modules = course.modules || [];
  var allLessons = [];
  modules.forEach(function(m){ (m.lessons||[]).forEach(function(l){ allLessons.push(l); }); });
  var completedIds = course.completedLessons || [];
  var totalLessons = allLessons.length;
  var completedCount = 0;
  allLessons.forEach(function(l){ if(completedIds.indexOf(l.id) !== -1) completedCount++; });
  completedCount = Math.min(completedCount, totalLessons);
  var progressPct = totalLessons > 0 ? Math.min(Math.round((completedCount / totalLessons) * 100), 100) : 0;

  // Calculate total duration — will be updated async from video metadata
  var totalSeconds = 0;
  var durationText = '0 Mins';

  // Store for click handlers
  window._currentBackendCourse = course;

  // --- Sidebar: Course Info (updates when active module changes) ---
  function updateCourseInfoForModule(modIdx) {
    // Modules shows TOTAL count
    var infoLessons = document.getElementById('cd-info-lessons');
    if(infoLessons) infoLessons.textContent = modules.length;
    // Videos = TOTAL across all modules
    var totalVids = 0;
    modules.forEach(function(m){ totalVids += (m.lessons || []).length; });
    var infoVideos = document.getElementById('cd-videos');
    if(infoVideos) infoVideos.textContent = totalVids + ' videos';
    // Duration = TOTAL from all cached durations
    var totalSec = 0;
    var pending = 0;
    var resolved = 0;
    allLessons.forEach(function(l) {
      if(l.videoUrl && _videoDurationCache[l.videoUrl] !== undefined) {
        totalSec += _videoDurationCache[l.videoUrl];
      } else if(l.videoUrl) {
        pending++;
        detectVideoDuration(l.videoUrl).then(function(sec) {
          totalSec += sec;
          resolved++;
          if(resolved >= pending) {
            var infoDuration = document.getElementById('cd-hours');
            if(infoDuration) infoDuration.textContent = _formatHMS(totalSec);
          }
        });
      }
    });
    var infoDuration = document.getElementById('cd-hours');
    if(infoDuration) infoDuration.textContent = pending > 0 ? 'Loading...' : _formatHMS(totalSec);
  }
  // Helper: format seconds to HHh MMm SSs
  function _formatHMS(sec) {
    sec = Math.round(sec || 0);
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return (h < 10 ? '0' : '') + h + 'h ' + (m < 10 ? '0' : '') + m + 'm ' + (s < 10 ? '0' : '') + s + 's';
  }
  // Store globally for module click handlers
  window._updateCourseInfoForModule = updateCourseInfoForModule;

  // Initial update for first module
  updateCourseInfoForModule(0);

  // Level
  var infoLevel = document.getElementById('cd-info-level');
  if(infoLevel) {
    var level = 'Beginner';
    var levelColor = '#22c55e';
    var tl = (course.title || '').toLowerCase();
    if(tl.includes('java') || tl.includes('mern') || tl.includes('dsa') || tl.includes('advanced')) { level = 'Intermediate'; levelColor = '#f97316'; }
    infoLevel.textContent = level;
    infoLevel.style.color = levelColor;
  }

  // --- Sidebar: Progress ---
  var sidebarProgress = document.getElementById('cd-sidebar-progress');
  if(sidebarProgress) {
    sidebarProgress.style.display = (course.isEnrolled || completedCount > 0) ? 'block' : 'none';
    var ring = document.getElementById('cd-progress-ring');
    if(ring) ring.style.strokeDashoffset = 188.5 - (188.5 * progressPct / 100);
    var ringPct = document.getElementById('cd-progress-ring-pct');
    if(ringPct) ringPct.textContent = progressPct + '%';
    var progMsg = document.getElementById('cd-progress-msg');
    if(progMsg) progMsg.textContent = progressPct === 0 ? 'Start learning! 📚' : progressPct === 100 ? 'Completed! 🎉' : 'Keep going! 🚀';
    var progSub = document.getElementById('cd-progress-sub');
    if(progSub) progSub.textContent = "You've completed " + completedCount + " of " + totalLessons + " lessons";
    var barFill = document.getElementById('cd-progress-bar-fill');
    if(barFill) barFill.style.width = progressPct + '%';
    var barPct = document.getElementById('cd-progress-bar-pct');
    if(barPct) barPct.textContent = progressPct + '%';
    var progCount = document.getElementById('cd-progress-count');
    if(progCount) progCount.textContent = completedCount + '/' + totalLessons + ' Lessons Completed';
  }

  // --- Sidebar: Instructor ---
  var instrAvatar = document.getElementById('cd-instructor-avatar');
  if(instrAvatar) instrAvatar.textContent = course.instructor ? course.instructor.charAt(0).toUpperCase() : 'I';
  var instrName = document.getElementById('cd-instructor-name');
  if(instrName) instrName.textContent = course.instructor || '';
  var instrRating = document.getElementById('cd-instructor-rating');
  if(instrRating) instrRating.innerHTML = '<i class="fas fa-star" style="color:#fbbf24;font-size:0.65rem;"></i> ' + (course.rating || '4.8') + ' (' + (course.students || 0) + ' Reviews)';

  // --- Course Content ---
  var modulesContainer = document.getElementById('cd-modules');
  modulesContainer.innerHTML = '';
  var lessonIndex = 0;

  // Set total modules count in Course Info
  var infoModules = document.getElementById('cd-info-lessons');
  if(infoModules) infoModules.textContent = modules.length;

  // Determine course level
  var courseTL = (course.title || '').toLowerCase();
  var courseLevel = 'Beginner';
  var levelColor = '#22c55e';
  if(courseTL.includes('java') || courseTL.includes('mern') || courseTL.includes('dsa') || courseTL.includes('advanced')) {
    courseLevel = 'Intermediate'; levelColor = '#f97316';
  }

  // Remember last opened module (per course)
  var _modStateKey = 'ck_last_mod_' + course.id;
  var lastOpenedMod = parseInt(localStorage.getItem(_modStateKey) || '0');
  if(lastOpenedMod >= modules.length) lastOpenedMod = 0;

  // Render modules as sibling cards directly into container
  modules.forEach(function(mod, modIdx) {
    var modLessons = mod.lessons || [];
    var isOpen = (modIdx === lastOpenedMod);

    var modDiv = document.createElement('div');
    modDiv.className = 'cd-module' + (isOpen ? ' cd-mod-expanded' : '');

    // Module header with MODULE X label + title + lesson count + chevron
    var modHeader = document.createElement('div');
    modHeader.className = 'cd-module-header';
    modHeader.innerHTML =
      '<div class="cd-module-info">' +
        '<span class="cd-module-label">MODULE ' + (modIdx + 1) + '</span>' +
        '<span class="cd-module-title">' + sanitize(mod.title) + '</span>' +
      '</div>' +
      '<div class="cd-module-right">' +
        '<span class="cd-module-meta">' + modLessons.length + ' Lesson' + (modLessons.length > 1 ? 's' : '') + '</span>' +
        '<i class="fas fa-chevron-down cd-mod-arrow"></i>' +
      '</div>';
    modHeader.onclick = function() {
      // Collapse all sibling modules, expand only this one
      var siblings = modulesContainer.querySelectorAll('.cd-module');
      siblings.forEach(function(s) {
        if(s !== modDiv) s.classList.remove('cd-mod-expanded');
      });
      modDiv.classList.toggle('cd-mod-expanded');
      // Remember this module
      if(modDiv.classList.contains('cd-mod-expanded')) {
        localStorage.setItem(_modStateKey, String(modIdx));
      }
      // Update Course Info sidebar
      if(modDiv.classList.contains('cd-mod-expanded') && window._updateCourseInfoForModule) {
        window._updateCourseInfoForModule(modIdx);
      }
    };
    modDiv.appendChild(modHeader);

    // Lessons container
    var lessonsWrap = document.createElement('div');
    lessonsWrap.className = 'cd-lessons-wrap';

    modLessons.forEach(function(lesson) {
      lessonIndex++;
      var canAccess = course.isEnrolled || lesson.isFree;
      var isCompleted = completedIds.indexOf(lesson.id) !== -1;
      var isInProgress = !isCompleted && canAccess && lessonIndex === (completedCount + 1);

      var item = document.createElement('div');
      item.className = 'cd-lesson' + (isInProgress ? ' cd-lesson-active' : '') + (isCompleted ? ' cd-lesson-completed' : '') + (!canAccess ? ' cd-lesson-locked' : '');

      if (canAccess) {
        item.onclick = function(){ openVideoFromBackend(course.id, mod.id, lesson.id); };
      } else {
        item.onclick = function(){ openPaymentPage(course.id); };
      }

      var iconHtml = '';
      if (isCompleted) {
        iconHtml = '<div class="cd-lesson-icon cd-lesson-icon-completed"><i class="fas fa-play"></i></div>';
      } else if (isInProgress) {
        iconHtml = '<div class="cd-lesson-icon cd-lesson-icon-active"><i class="fas fa-play"></i><span class="cd-sparkle">✦</span></div>';
      } else if (canAccess) {
        iconHtml = '<div class="cd-lesson-icon cd-lesson-icon-default"><i class="fas fa-play"></i></div>';
      } else {
        iconHtml = '<div class="cd-lesson-icon cd-lesson-icon-locked"><i class="fas fa-lock"></i></div>';
      }

      var duration = '--';
      var rightHtml = '';
      if (isCompleted) {
        rightHtml = '<span class="cd-badge cd-badge-completed">Completed</span><i class="fas fa-check-circle cd-status-icon cd-status-completed"></i>';
      } else if (isInProgress) {
        rightHtml = '<span class="cd-badge cd-badge-active">In Progress</span><i class="fas fa-play-circle cd-status-icon cd-status-active"></i>';
      } else if (!canAccess) {
        rightHtml = '<span class="cd-badge cd-badge-locked">Locked</span><i class="fas fa-lock cd-status-icon cd-status-locked"></i>';
      } else {
        rightHtml = '<span class="cd-badge cd-badge-locked">Not Started</span>';
      }

      item.innerHTML = iconHtml +
        '<span class="cd-lesson-num">' + (lessonIndex < 10 ? '0' : '') + lessonIndex + '</span>' +
        '<span class="cd-lesson-title">' + sanitize(lesson.title) + '</span>' +
        '<span class="cd-lesson-duration" data-lesson-id="' + lesson.id + '">' + duration + '</span>' +
        rightHtml;

      lessonsWrap.appendChild(item);
    });

    modDiv.appendChild(lessonsWrap);
    modulesContainer.appendChild(modDiv);
  });

  // Trigger initial Course Info update for the remembered module
  if(window._updateCourseInfoForModule) window._updateCourseInfoForModule(lastOpenedMod);

  // View all button
  var viewAll = document.getElementById('cd-view-all');
  var viewAllCount = document.getElementById('cd-view-all-count');
  if (totalLessons > 5 && viewAll) {
    viewAll.style.display = 'flex';
    if(viewAllCount) viewAllCount.textContent = totalLessons;
  } else if(viewAll) {
    viewAll.style.display = 'none';
  }

  navigate('course-detail');

  // Async: detect real video durations from metadata and update UI
  var lessonsWithUrls = allLessons.filter(function(l){ return l.videoUrl && l.videoUrl !== ''; });
  if(lessonsWithUrls.length > 0) {
    detectAllDurations(lessonsWithUrls).then(function(durationMap) {
      var totalSec = 0;
      // Update each lesson duration in the DOM
      allLessons.forEach(function(l) {
        var sec = durationMap[l.id] || 0;
        totalSec += sec;
        var el = document.querySelector('[data-lesson-id="' + l.id + '"]');
        if(el) el.textContent = formatDuration(sec);
      });
    });
  }

  // Async: fetch lesson ratings and calculate course average + total students
  if(allLessons.length > 0) {
    var _token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    var ratingPromises = allLessons.map(function(l) {
      return fetch(BASE_URL + '/api/feedback/lesson?lessonId=' + l.id, {
        headers: _token ? { Authorization: 'Bearer ' + _token } : {}
      }).then(function(r){ return r.json(); }).then(function(d){
        if(d.success) return { avg: parseFloat(d.avgRating) || 0, students: parseInt(d.totalReviews) || 0 };
        return { avg: 0, students: 0 };
      }).catch(function(){ return { avg: 0, students: 0 }; });
    });
    Promise.all(ratingPromises).then(function(results) {
      var totalStudents = 0;
      var ratingSum = 0;
      var ratedCount = 0;
      results.forEach(function(r) {
        totalStudents += r.students;
        if(r.avg > 0) { ratingSum += r.avg; ratedCount++; }
      });
      var avgRating = ratedCount > 0 ? Math.min((ratingSum / ratedCount), 5.0) : 0;
      var heroRatingEl = document.getElementById('cd-hero-rating');
      if(heroRatingEl) heroRatingEl.textContent = avgRating > 0 ? avgRating.toFixed(1) : '--';
      var heroStudentsEl = document.getElementById('cd-hero-students');
      if(heroStudentsEl) heroStudentsEl.textContent = totalStudents;
    });
  }
}

function renderCourseDetailFromMock(course) {
  document.getElementById('cd-hours').textContent = course.hours + ' hours';
  document.getElementById('cd-videos').textContent = (course.totalVideos || 0) + ' videos';
  document.getElementById('cd-instructor-avatar').textContent = course.instructor ? course.instructor.charAt(0) : 'I';
  document.getElementById('cd-instructor-name').textContent = course.instructor || '';
  document.getElementById('cd-instructor-rating').innerHTML = '<i class="fas fa-star" style="color:#fbbf24;font-size:0.65rem;"></i> ' + (course.rating || '4.8') + ' (' + (course.students || 0) + ' Reviews)';
  var priceBtnMock = document.getElementById('cd-price-btn');
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
