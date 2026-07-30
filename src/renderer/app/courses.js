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
    return `
    <div class="course-card hover-glow" onclick="openCourseDetail('${c.id}')" style="background:#161B22; border:1px solid rgba(255,255,255,0.06); border-radius:20px; overflow:hidden; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,0.3); transition:transform 0.25s, box-shadow 0.25s;">
      <div style="height:150px; background:${gradient}; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.4));"></div>
        <i class="${c.icon}" style="font-size:4rem; color:rgba(255,255,255,0.95); z-index:1; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4));"></i>
        <span style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);color:#fff;font-size:0.72rem;font-weight:700;padding:4px 10px;border-radius:50px;z-index:2;border:1px solid rgba(255,255,255,0.15);">${c.category}</span>
      </div>
      <div style="padding:16px;">
        <h3 style="font-size:1rem; font-weight:800; color:#fff; margin-bottom:6px; line-height:1.3;">${sanitize(c.title)}</h3>
        <p style="font-size:0.8rem; color:var(--muted); margin-bottom:14px; line-height:1.5; min-height:36px;">${sanitize(c.subtitle)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="display:flex;align-items:center;gap:5px;font-size:0.82rem;font-weight:700;color:#F59E0B;"><i class="fas fa-star"></i> ${c.rating || '4.5'}</span>
          <span style="font-size:0.82rem;font-weight:800;padding:3px 10px;border-radius:50px;background:${c.free ? 'rgba(34,197,94,0.15)' : 'rgba(108,71,255,0.15)'};color:${c.free ? '#22c55e' : '#a78bfa'};">${c.free ? 'Free' : 'Pro'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function openCourseDetail(courseId) {
  currentCourseId = courseId;

  // Try backend first, fallback to mockData
  let course = null;
  try {
    const data = await CoursesAPI.getById(courseId);
    if (data.success && data.course) {
      course = data.course;
      renderCourseDetailFromBackend(course);
      return;
    }
  } catch (err) {
    // fallback to mockData
  }

  // mockData fallback (id is number in mockData)
  course = MOCK_COURSES.find(c => c.id == courseId);
  if (!course) return;
  renderCourseDetailFromMock(course);
}

function renderCourseDetailFromBackend(course) {
  document.getElementById('cd-title').textContent = course.title || '';
  document.getElementById('cd-meta').textContent =
    (course.instructor || '') + (course.institute ? ' - ' + course.institute : '') +
    (course.students ? ' - ' + course.students + ' students' : '') +
    (course.rating ? ' - ' + course.rating + ' rating' : '');
  document.getElementById('cd-hours').textContent = (course.totalHours || 0) + ' hours';
  document.getElementById('cd-videos').textContent = (course.totalVideos || 0) + ' videos';
  document.getElementById('cd-instructor-avatar').textContent = course.instructor ? course.instructor.charAt(0) : 'I';
  document.getElementById('cd-instructor-name').textContent = course.instructor || '';
  document.getElementById('cd-instructor-meta').textContent = course.institute || '';
  document.getElementById('cd-instructor-rating').textContent = (course.rating || '') + (course.students ? ' - ' + course.students + ' students' : '');
  const priceBtn = document.getElementById('cd-price-btn');
  if (course.isFree) {
    priceBtn.textContent = 'Free Course';
    priceBtn.onclick = null;
  } else if (course.isEnrolled) {
    priceBtn.textContent = '✅ Enrolled';
    priceBtn.onclick = null;
    priceBtn.style.background = 'var(--success)';
  } else {
    priceBtn.textContent = 'Unlock Course';
    priceBtn.onclick = () => openPaymentPage(course.id);
  }

  const modulesContainer = document.getElementById('cd-modules');
  const modules = course.modules || [];

  // Store current course data for click handlers
  window._currentBackendCourse = course;

  modulesContainer.innerHTML = '';
  modules.forEach(mod => {
    const modDiv = document.createElement('div');
    modDiv.className = 'card';
    modDiv.style.marginBottom = '14px';

    const modTitle = document.createElement('div');
    modTitle.style.cssText = 'font-weight:700;margin-bottom:12px';
    modTitle.textContent = mod.title;
    modDiv.appendChild(modTitle);

    (mod.lessons || []).forEach(lesson => {
      const item = document.createElement('div');
      const canAccess = course.isEnrolled || lesson.isFree;
      item.className = 'playlist-item' + (canAccess ? '' : ' locked');
      if (canAccess) {
        item.onclick = () => openVideoFromBackend(course.id, mod.id, lesson.id);
      } else {
        item.onclick = () => openPaymentPage(course.id);
        item.style.cursor = 'pointer';
      }
      item.innerHTML =
        '<i class="fas ' + (canAccess ? 'fa-play-circle' : 'fa-lock') + '" style="color:' + (canAccess ? 'var(--success)' : '') + '"></i>' +
        '<span class="item-title">' + sanitize(lesson.title) + '</span>' +
        '<span class="item-duration">' + (lesson.duration || '') + '</span>' +
        '<span class="badge ' + (lesson.isFree ? 'badge-free' : (course.isEnrolled ? 'badge-free' : 'badge-paid')) + '">' + (lesson.isFree ? 'Free' : (course.isEnrolled ? 'Enrolled' : 'Pro')) + '</span>';
      modDiv.appendChild(item);
    });

    modulesContainer.appendChild(modDiv);
  });

  navigate('course-detail');
}

function renderCourseDetailFromMock(course) {
  document.getElementById('cd-title').textContent = course.title;
  document.getElementById('cd-meta').textContent = course.instructor + ' - ' + course.instructorMeta + ' - ' + course.students + ' students - ' + course.rating + ' rating';
  document.getElementById('cd-hours').textContent = course.hours + ' hours';
  document.getElementById('cd-videos').textContent = course.totalVideos + ' videos';
  document.getElementById('cd-instructor-avatar').textContent = course.instructor.charAt(0);
  document.getElementById('cd-instructor-name').textContent = course.instructor;
  document.getElementById('cd-instructor-meta').textContent = course.instructorMeta;
  document.getElementById('cd-instructor-rating').textContent = course.rating + ' - ' + course.students + ' students';
  const priceBtnMock = document.getElementById('cd-price-btn');
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
