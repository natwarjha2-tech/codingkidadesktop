// Auth Helpers

function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showAuthError(formId, message) {
  const el = document.getElementById(formId + '-error');
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function hideAuthError(formId) {
  const el = document.getElementById(formId + '-error');
  if (el) el.style.display = 'none';
}

function setButtonLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : defaultText;
}

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
    await loadStudentData();
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
    await loadStudentData();
    navigate('dashboard');
  } catch (err) {
    showAuthError('signup', err.message || 'Signup failed. Try again.');
  } finally {
    setButtonLoading('signup-btn', false, 'Create Free Account');
  }
}

async function loadStudentData() {
  try {
    const data = await StudentAPI.getProfile();
    const student = data.student || data.user || data;
    const name = sanitize(student.name || student.fullName || 'Learner');
    const email = sanitize(student.email || '');
    const initial = sanitize(name.charAt(0).toUpperCase());

    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;

    const dashWelcome = document.getElementById('dashboard-welcome-name');
    if (dashWelcome) dashWelcome.textContent = name;

    const dashGreeting = document.getElementById('dashboard-greeting');
    if (dashGreeting) {
      const hour = new Date().getHours();
      let greeting = 'Good Evening';
      if (hour < 12) greeting = 'Good Morning';
      else if (hour < 18) greeting = 'Good Afternoon';
      dashGreeting.textContent = greeting;
    }

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileNameInput = document.getElementById('profile-name-input');
    const profileEmailInput = document.getElementById('profile-email-input');
    if (profileName) profileName.textContent = name;
    if (profileEmail) profileEmail.textContent = email;
    if (profileAvatar) {
      const avatarText = document.getElementById('profile-avatar-text');
      if (avatarText) avatarText.textContent = initial;
    }
    if (profileNameInput) profileNameInput.value = name;
    if (profileEmailInput) profileEmailInput.value = email;

    // Restore saved avatar photo — user-specific
    const userId = getCurrentUserId();
    const savedAvatar = localStorage.getItem('ck_avatar_' + userId);
    if (savedAvatar) {
      const img = document.getElementById('profile-avatar-img');
      const text = document.getElementById('profile-avatar-text');
      if (img) { img.src = savedAvatar; img.style.display = 'block'; }
      if (text) text.style.display = 'none';
    } else {
      const text = document.getElementById('profile-avatar-text');
      if (text) text.textContent = initial;
    }
  } catch (err) {
    const cached = JSON.parse(localStorage.getItem('ck_user') || '{}');
    if (cached.name) {
      const name = cached.name;
      const initial = name.charAt(0).toUpperCase();
      const sidebarName = document.getElementById('sidebar-user-name');
      const sidebarAvatar = document.getElementById('sidebar-user-avatar');
      const dashWelcome = document.getElementById('dashboard-welcome-name');
      const profileName = document.getElementById('profile-name');
      const profileEmail = document.getElementById('profile-email');
      const profileAvatar = document.getElementById('profile-avatar');
      const profileNameInput = document.getElementById('profile-name-input');
      const profileEmailInput = document.getElementById('profile-email-input');
      if (sidebarName) sidebarName.textContent = name;
      if (sidebarAvatar) sidebarAvatar.textContent = initial;
      if (dashWelcome) dashWelcome.textContent = name;
      if (profileName) profileName.textContent = name;
      if (profileEmail) profileEmail.textContent = cached.email || '';
      if (profileAvatar) profileAvatar.textContent = initial;
      if (profileNameInput) profileNameInput.value = name;
      if (profileEmailInput) profileEmailInput.value = cached.email || '';
    }
  }

  // Load dashboard data in background — outside loadStudentData so splash is not blocked
}

function _applyDashboardData(data) {
    if (!data.success) return;

    // Dashboard stats
    const enrolledEl = document.getElementById('stat-enrolled');
    const completedEl = document.getElementById('stat-completed');
    const certEl = document.getElementById('stat-certificates');
    const streakEl = document.getElementById('stat-streak');
    if (enrolledEl) enrolledEl.textContent = data.enrolledCount || 0;
    if (completedEl) completedEl.textContent = data.completedVideos || 0;

    // Certificates = courses where progressPercent is 100
    const certCount = (data.enrolledCourses || []).filter(c => c.progressPercent === 100).length;
    if (certEl) certEl.textContent = certCount;

    // Daily streak from localStorage
    const streak = updateDailyStreak();
    if (streakEl) streakEl.textContent = streak;

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
      if (cFill) cFill.style.width = progress + '%';
      if (cText) cText.textContent = progress + '% Complete';
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
    } else {
      if (continueSection) continueSection.style.display = 'none';
    }

    // Profile enrolled courses — always update regardless of which page is active
    const profileCoursesContainer = document.querySelector('.profile-courses-list');
    if (profileCoursesContainer) {
      if (data.enrolledCourses && data.enrolledCourses.length > 0) {
        profileCoursesContainer.innerHTML = data.enrolledCourses.map(c =>
          '<div class="hover-glow" style="margin-bottom:16px; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.05)">' +
          '<div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:8px">' +
          '<span style="font-weight:700; color:#fff">' + sanitize(c.title) + '</span>' +
          '<span style="color:var(--primary); font-weight:800">' + (c.progressPercent || 0) + '%</span>' +
          '</div>' +
          '<div class="progress-bar" style="height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden">' +
          '<div class="progress-fill" style="width:' + (c.progressPercent || 0) + '%; height:100%; background:linear-gradient(to right, #6c47ff, #ec4899); border-radius:10px"></div>' +
          '</div>' +
          '</div>'
        ).join('');
      } else {
        profileCoursesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--muted); font-size:0.85rem">No courses enrolled yet.</div>';
      }
    }
}

function logout() {
  localStorage.removeItem('ck_token');
  localStorage.removeItem('ck_user');
  window.location.href = 'login.html';
}

function toggleSidebarMenu() {
  const menu = document.getElementById('sidebar-user-menu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function saveProfile() {
  const name = document.getElementById('profile-name-input')?.value.trim();
  if (!name) return;

  const msgEl = document.getElementById('profile-save-msg');
  if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = 'var(--muted)'; msgEl.textContent = 'Saving...'; }

  try {
    const data = await StudentAPI.updateProfile({ name });
    if (!data.success) throw new Error(data.message);

    // Update localStorage
    const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    cached.name = name;
    if (localStorage.getItem('ck_user')) localStorage.setItem('ck_user', JSON.stringify(cached));
    else sessionStorage.setItem('ck_user', JSON.stringify(cached));

    const initial = name.charAt(0).toUpperCase();
    const profileName = document.getElementById('profile-name');
    const profileAvatarText = document.getElementById('profile-avatar-text');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarAvatar = document.getElementById('sidebar-user-avatar');
    const dashWelcome = document.getElementById('dashboard-welcome-name');
    if (profileName) profileName.textContent = name;
    if (profileAvatarText) profileAvatarText.textContent = initial;
    if (sidebarName) sidebarName.textContent = name;
    if (sidebarAvatar) sidebarAvatar.textContent = initial;
    if (dashWelcome) dashWelcome.textContent = name;

    if (msgEl) { msgEl.style.color = 'var(--success)'; msgEl.textContent = '✅ Profile saved successfully!'; }
    setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3000);
  } catch (err) {
    if (msgEl) { msgEl.style.color = 'var(--danger)'; msgEl.textContent = '❌ ' + (err.message || 'Failed to save.'); }
  }
}

function handleProfilePhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const userId = getCurrentUserId();
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('profile-avatar-img');
    const text = document.getElementById('profile-avatar-text');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    if (text) text.style.display = 'none';
    localStorage.setItem('ck_avatar_' + userId, e.target.result);
  };
  reader.readAsDataURL(file);
}

function openEditProfile() {
  navigate('profile');
  document.getElementById('profile-name-input')?.focus();
}

// Navigation

const appPages = ['dashboard','courses','course-detail','video','chat','ai','live','downloads','offline-downloads','profile'];
const authPages = ['login','signup'];
const sidebarMap = { dashboard:'nav-dashboard', courses:'nav-courses', 'course-detail':'nav-courses', video:'nav-courses', chat:'nav-chat', ai:'nav-ai', live:'nav-live', downloads:'nav-downloads', 'offline-downloads':'nav-offline-downloads', profile:'nav-profile' };

function navigate(page) {
  authPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });

  const app = document.getElementById('app');

  if (authPages.includes(page)) {
    app.style.display = 'none';
    const el = document.getElementById('page-' + page);
    if (el) el.style.display = 'flex';
    return;
  }

  app.style.display = 'flex';

  appPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  if (page === 'downloads') renderDownloads();
  if (page === 'offline-downloads') renderOfflineDownloads();

  // Refresh dashboard data when navigating to profile
  if (page === 'profile' || page === 'dashboard') {
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) StudentAPI.getDashboard().then(data => _applyDashboardData(data)).catch(() => {});
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = sidebarMap[page];
  if (navId) {
    const navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add('active');
  }
}

function switchTab(el, tabId) {
  // Update panel tab classes
  const tabs = el.parentElement.querySelectorAll('.panel-tab');
  if (tabs.length > 0) {
    tabs.forEach(t => t.classList.remove('active'));
    el.classList.add('active');
  }

  ['tab-notes','tab-quiz','tab-exercise','tab-chat'].forEach(id => {
    const t = document.getElementById(id);
    if (t) t.style.display = 'none';
  });
  const tab = document.getElementById(tabId);
  if (tab) tab.style.display = 'block';
}

function selectOption(el) {
  el.closest('.video-tab-content').querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
}

function sendVideoChat() {
  const input = document.getElementById('video-chat-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.querySelector('#tab-chat .video-chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'chat-msg own';
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
  avatar.textContent = cached.name ? cached.name.charAt(0).toUpperCase() : 'Y';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const p = document.createElement('p');
  p.textContent = msg;
  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = 'Just now';
  bubble.appendChild(p);
  bubble.appendChild(time);
  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  input.value = '';
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg own';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  const p = document.createElement('p');
  p.textContent = msg;
  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = 'Just now';
  bubble.appendChild(p);
  bubble.appendChild(time);
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = 'Y';
  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  input.value = '';
}

async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('aiMessages');

  const userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.innerHTML = '<div class="ai-icon" style="background:var(--primary)">Y</div><div class="ai-bubble">' + sanitize(msg) + '</div>';
  container.appendChild(userDiv);
  input.value = '';

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-msg';
  loadingDiv.id = 'ai-loading';
  loadingDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:var(--muted)">Thinking...</div>';
  container.appendChild(loadingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + CONFIG.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'You are a helpful coding tutor for CodingKeda platform. Answer this student question clearly and concisely: ' + msg }] }]
        })
      }
    );
    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, could not get a response.';
    document.getElementById('ai-loading')?.remove();
    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-msg';
    aiDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble">' + answer.replace(/\n/g, '<br/>') + '</div>';
    container.appendChild(aiDiv);
  } catch (err) {
    document.getElementById('ai-loading')?.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'ai-msg';
    errDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:var(--danger)">Error connecting to AI.</div>';
    container.appendChild(errDiv);
  }

  container.scrollTop = container.scrollHeight;
}

// Courses — Backend API with mockData fallback
// Backend: GET /api/courses → { success, courses: [...] }
// Backend: GET /api/courses/:id → { success, course: { ...modules: [...lessons] } }

let currentCourseId = null;

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
  try {
    const data = await CoursesAPI.getAll(category, search);
    if (data.success && data.courses && data.courses.length > 0) {
      return data.courses.map(mapCourse);
    }
    return MOCK_COURSES;
  } catch (err) {
    return MOCK_COURSES;
  }
}

function renderCourseGrid(courses) {
  const grid = document.getElementById('courses-grid');
  if (!grid) return;
  if (!courses || courses.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:60px 20px; background:rgba(255,255,255,0.02); border-radius:24px; border:1px solid rgba(255,255,255,0.05)">' +
      '<i class="fas fa-search" style="font-size:3rem; color:var(--muted); margin-bottom:16px; display:block"></i>' +
      '<p style="color:var(--muted); font-size:1.1rem; font-weight:600">No courses found</p>' +
      '<p style="color:var(--muted); font-size:0.9rem; margin-top:8px">Try adjusting your filters or search terms</p>' +
      '</div>';
    return;
  }
  grid.innerHTML = courses.map(c => `
    <div class="course-card hover-glow" onclick="openCourseDetail('${c.id}')" style="background:#161B22; border:1px solid rgba(255,255,255,0.05); border-radius:24px; overflow:hidden; cursor:pointer; position:relative; box-shadow:0 12px 30px rgba(0,0,0,0.2);">
      <div class="course-thumb" style="height:160px; background:${c.gradient}; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
        <div style="position:absolute; width:100%; height:100%; background:radial-gradient(circle, rgba(255,255,255,0.2), transparent 70%);"></div>
        <i class="${c.icon}" style="font-size:4.5rem; color:rgba(255,255,255,0.9); z-index:1; filter: drop-shadow(0 0 15px rgba(255,255,255,0.3));"></i>
      </div>
      <div class="course-body" style="padding:20px;">
        <h3 style="font-size:1.1rem; font-weight:800; color:#fff; margin-bottom:8px;">${sanitize(c.title)}</h3>
        <p style="font-size:0.85rem; color:var(--muted); margin-bottom:16px; min-height:40px;">${sanitize(c.subtitle)}</p>
        <div class="course-meta" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="course-rating" style="display:flex; align-items:center; gap:6px; font-size:0.9rem; font-weight:700; color:#F59E0B;">
            <i class="fas fa-star"></i> ${c.rating}
          </span>
          <span class="badge ${c.free ? 'badge-free' : 'badge-paid'}" style="font-size:0.85rem; font-weight:800; color:${c.free ? '#10B981' : 'rgba(255,255,255,0.9)'}">${c.free ? 'Free' : 'Paid'}</span>
        </div>
      </div>
    </div>`).join('');
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

// Open video from backend data
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
    await loadVideo(lesson.videoUrl || '');

    _currentVideoData = { lessonId: lesson.id, title: lesson.title, courseTitle: course.title || '', moduleTitle: mod.title, videoUrl: lesson.videoUrl, notesUrl: lesson.notes || '' };
    // Mark lesson as complete
    markLessonComplete(lesson.id);
    // Track last opened lesson for continue learning
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    if (token) {
      const lastLesson = { courseId: course.id, courseTitle: course.title, moduleId: mod.id, moduleTitle: mod.title, lessonId: lesson.id, lessonTitle: lesson.title, videoUrl: lesson.videoUrl };
      localStorage.setItem('ck_last_lesson', JSON.stringify(lastLesson));
    }
    const saveBtn = document.getElementById('save-download-btn');
    if (saveBtn) {
      const saved = JSON.parse(localStorage.getItem('ck_downloads') || '[]').find(d => d.lessonId === lesson.id);
      saveBtn.innerHTML = saved ? '<i class="fas fa-check"></i> Saved!' : '<i class="fas fa-bookmark"></i> Save to Watchlist';
      saveBtn.disabled = !!saved;
    }

    const notesUrl = lesson.notes || '';
    document.getElementById('tab-notes').innerHTML =
      '<h4 style="margin-bottom:12px">Notes</h4>' +
      '<p style="color:var(--muted);font-size:0.88rem;line-height:1.8">' + (notesUrl ? 'PDF notes available for this lesson.' : 'No notes available.') + '</p>' +
      (notesUrl ? '<button class="btn btn-outline btn-sm" style="margin-top:14px" onclick="openPdfInApp(\'' + notesUrl + '\')"><i class="fas fa-file-pdf"></i> View PDF</button>' : '');

    document.getElementById('tab-quiz').innerHTML =
      '<h4 style="margin-bottom:14px">Quiz</h4>' +
      '<p style="color:var(--muted);font-size:0.88rem">Quiz coming soon for this lesson.</p>';

    document.getElementById('tab-exercise').innerHTML =
      '<h4 style="margin-bottom:12px">Exercise</h4>' +
      '<p style="color:var(--muted);font-size:0.88rem">Exercise coming soon for this lesson.</p>';

    const playlist = document.getElementById('video-playlist');
    playlist.innerHTML = '';
    (mod.lessons || []).forEach(l => {
      const item = document.createElement('div');
      item.className = 'playlist-item' + (l.id === lessonId ? ' active' : '') + (l.isFree ? '' : ' locked');
      if (l.isFree) item.onclick = () => openVideoFromBackend(courseId, moduleId, l.id);
      item.innerHTML =
        '<i class="fas ' + (l.isFree ? 'fa-play-circle' : 'fa-lock') + '"></i>' +
        '<span class="item-title">' + sanitize(l.title) + '</span>' +
        '<span class="item-duration">' + (l.duration || '') + '</span>';
      playlist.appendChild(item);
    });

    const chatContainer = document.querySelector('#tab-chat .video-chat-messages');
    if (chatContainer) chatContainer.innerHTML = '';

    document.getElementById('tab-quiz').style.display = 'none';
    document.getElementById('tab-exercise').style.display = 'none';
    document.getElementById('tab-chat').style.display = 'none';
    document.getElementById('tab-notes').style.display = 'block';
    document.querySelectorAll('.video-tab').forEach((t, i) => t.classList.toggle('active', i === 0));

    navigate('video');
  } catch {}
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
function markLessonComplete(lessonId) {
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token || !lessonId) return;
  apiRequest('/api/lessons/' + lessonId + '/progress', {
    method: 'POST',
    body: JSON.stringify({ completed: true }),
  }).catch(() => {});
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
  const saveBtn = document.getElementById('save-download-btn');
  if (saveBtn) {
    const saved = JSON.parse(localStorage.getItem('ck_downloads') || '[]').find(d => d.lessonId === String(video.id));
    saveBtn.innerHTML = saved ? '<i class="fas fa-check"></i> Saved!' : '<i class="fas fa-bookmark"></i> Save to Watchlist';
    saveBtn.disabled = !!saved;
  }

  document.getElementById('tab-notes').innerHTML =
    '<h4 style="margin-bottom:12px">Notes</h4>' +
    '<ul style="color:var(--muted);font-size:0.88rem;line-height:2;padding-left:20px">' +
    video.notes.map(n => '<li>' + sanitize(n) + '</li>').join('') +
    '</ul>' +
    '<button class="btn btn-outline btn-sm" style="margin-top:14px" onclick="alert(\'No PDF attached to this lesson.\')"><i class="fas fa-download"></i> Download PDF</button>';

  const q = video.quiz;
  document.getElementById('tab-quiz').innerHTML =
    '<h4 style="margin-bottom:14px">Quiz</h4>' +
    '<p style="font-weight:600;margin-bottom:14px" id="quiz-question">Q1. ' + sanitize(q.question) + '</p>' +
    q.options.map((opt, i) => '<div class="quiz-option" id="quiz-opt-' + i + '" onclick="selectOption(this)" data-index="' + i + '"><span>' + String.fromCharCode(65 + i) + '. ' + sanitize(opt) + '</span></div>').join('') +
    '<button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="submitQuiz(' + JSON.stringify(q.answer) + ')">Submit</button>' +
    '<div id="quiz-result" style="margin-top:12px;font-size:0.88rem"></div>';

  document.getElementById('tab-exercise').innerHTML =
    '<h4 style="margin-bottom:12px">Exercise</h4>' +
    '<p style="font-size:0.88rem;color:var(--muted);margin-bottom:14px">' + sanitize(video.exercise) + '</p>' +
    '<textarea id="exercise-code" style="width:100%;height:130px;background:#0d1117;border:1px solid var(--border);border-radius:8px;padding:12px;color:#e6edf3;font-family:monospace;font-size:0.83rem;resize:none" placeholder="// Write your code here..."></textarea>' +
    '<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="submitExercise()"><i class="fas fa-paper-plane"></i> Submit</button>' +
    '<div id="exercise-result" style="margin-top:10px;font-size:0.85rem"></div>';

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

let _searchTimeout = null;

function submitQuiz(correctIndex) {
  const selected = document.querySelector('.quiz-option.selected');
  const result = document.getElementById('quiz-result');
  if (!selected) {
    if (result) result.innerHTML = '<span style="color:#f59e0b">Please select an answer first.</span>';
    return;
  }
  const selectedIndex = parseInt(selected.getAttribute('data-index'));
  document.querySelectorAll('.quiz-option').forEach(o => o.style.pointerEvents = 'none');
  if (selectedIndex === correctIndex) {
    selected.classList.add('correct');
    if (result) result.innerHTML = '<span style="color:var(--success)">✅ Correct! Well done.</span>';
  } else {
    selected.classList.add('wrong');
    const correctEl = document.querySelector('.quiz-option[data-index="' + correctIndex + '"]');
    if (correctEl) correctEl.classList.add('correct');
    if (result) result.innerHTML = '<span style="color:var(--danger)">❌ Incorrect. The correct answer is highlighted.</span>';
  }
}

function submitExercise() {
  const code = document.getElementById('exercise-code')?.value.trim();
  const result = document.getElementById('exercise-result');
  if (!code) {
    if (result) result.innerHTML = '<span style="color:#f59e0b">Please write your code before submitting.</span>';
    return;
  }
  if (result) result.innerHTML = '<span style="color:var(--success)">✅ Exercise submitted! Keep it up.</span>';
}

async function loadVideo(url) {
  const iframe = document.getElementById('video-iframe');
  const videoEl = document.getElementById('video-player');
  if (!iframe || !videoEl) return;

  if (!url) {
    iframe.src = ''; iframe.style.display = 'block';
    videoEl.src = ''; videoEl.style.display = 'none';
    return;
  }

  if (url.includes('youtube') || url.includes('youtu.be')) {
    // YouTube — use iframe
    iframe.src = url.includes('?') ? url + '&rel=0' : url + '?rel=0';
    iframe.style.display = 'block';
    videoEl.style.display = 'none';
    videoEl.src = '';
  } else {
    // S3 video — URL is already signed from ?signed=true, play directly
    iframe.style.display = 'none';
    iframe.src = '';
    videoEl.style.display = 'block';
    videoEl.src = url;
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
      StudentAPI.getDashboard().then(d => _applyDashboardData(d)).catch(() => {});
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

// ─── Downloads ───────────────────────────────────────────────────────────────

let _currentVideoData = null;

function saveToDownloads() {
  if (!_currentVideoData) return;
  const { lessonId, title, courseTitle, moduleTitle, videoUrl } = _currentVideoData;
  if (!videoUrl) {
    alert('No video available for this lesson.');
    return;
  }
  const downloads = JSON.parse(localStorage.getItem('ck_downloads') || '[]');
  const exists = downloads.find(d => d.lessonId === lessonId);
  if (exists) {
    alert('Already saved to Watchlist!');
    return;
  }
  downloads.push({ lessonId, title, courseTitle, moduleTitle, videoUrl, savedAt: new Date().toISOString() });
  localStorage.setItem('ck_downloads', JSON.stringify(downloads));
  const btn = document.getElementById('save-download-btn');
  if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Saved!'; btn.disabled = true; }
}

function renderDownloads() {
  const container = document.getElementById('downloads-list');
  if (!container) return;
  const downloads = JSON.parse(localStorage.getItem('ck_downloads') || '[]');
  if (downloads.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:60px 20px">' +
      '<i class="fas fa-bookmark" style="font-size:2.5rem;color:var(--muted);margin-bottom:16px;display:block"></i>' +
      '<p style="color:var(--muted);font-size:0.95rem;font-weight:600">No saved lessons yet</p>' +
      '<p style="color:var(--muted);font-size:0.82rem;margin-top:6px">Open a lesson and click "Save to Watchlist"</p>' +
      '</div>';
    return;
  }
  container.innerHTML = downloads.map((d, i) =>
    '<div class="download-item">' +
    '<div class="download-icon" style="color:var(--primary)"><i class="fas fa-file-video"></i></div>' +
    '<div class="download-info">' +
    '<h4>' + sanitize(d.title) + '</h4>' +
    '<p style="font-size:0.78rem;color:var(--muted);margin-top:4px">' + sanitize(d.courseTitle || '') + (d.moduleTitle ? ' · ' + sanitize(d.moduleTitle) : '') + '</p>' +
    '</div>' +
    '<div style="display:flex;gap:8px">' +
    '<button class="btn btn-primary btn-sm" onclick="playDownloadedVideo(' + i + ')"><i class="fas fa-play"></i> Watch</button>' +
    '<button class="btn btn-outline btn-sm" onclick="removeDownload(' + i + ')"><i class="fas fa-trash"></i></button>' +
    '</div>' +
    '</div>'
  ).join('');
}

async function playDownloadedVideo(index) {
  const downloads = JSON.parse(localStorage.getItem('ck_downloads') || '[]');
  const d = downloads[index];
  if (!d) return;
  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    const res = await fetch(BASE_URL + '/api/media/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify({ url: d.videoUrl }),
    });
    let playUrl = d.videoUrl;
    if (res.ok) {
      const data = await res.json();
      if (data.signedUrl) playUrl = data.signedUrl;
    }
    document.getElementById('video-title').textContent = d.title || '';
    document.getElementById('video-meta').textContent = (d.courseTitle || '') + (d.moduleTitle ? ' · ' + d.moduleTitle : '');
    await loadVideo(d.videoUrl || '');
    _currentVideoData = d;
    const btn = document.getElementById('save-download-btn');
    if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Saved!'; btn.disabled = true; }
    document.getElementById('tab-notes').innerHTML = '<h4 style="margin-bottom:12px">Notes</h4><p style="color:var(--muted);font-size:0.88rem">Open the lesson from Courses to view notes.</p>';
    document.getElementById('tab-quiz').innerHTML = '<h4 style="margin-bottom:14px">Quiz</h4><p style="color:var(--muted)">Quiz coming soon.</p>';
    document.getElementById('tab-exercise').innerHTML = '<h4 style="margin-bottom:12px">Exercise</h4><p style="color:var(--muted)">Exercise coming soon.</p>';
    document.getElementById('tab-quiz').style.display = 'none';
    document.getElementById('tab-exercise').style.display = 'none';
    document.getElementById('tab-chat').style.display = 'none';
    document.getElementById('tab-notes').style.display = 'block';
    document.querySelectorAll('.video-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
    navigate('video');
  } catch { alert('Could not play video. Please try again.'); }
}

function removeDownload(index) {
  const downloads = JSON.parse(localStorage.getItem('ck_downloads') || '[]');
  downloads.splice(index, 1);
  localStorage.setItem('ck_downloads', JSON.stringify(downloads));
  renderDownloads();
}

let _allCourseCategories = ['All', 'Programming', 'Web Dev', 'Data Science', 'DSA'];

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

// ─── Offline Downloads ───────────────────────────────────────────────────────────────

function getCurrentUserId() {
  const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
  return cached.id || cached.userId || '';
}

async function downloadOffline() {
  if (!window.electron || !window.electron.downloadContent) {
    alert('Downloads only available in the desktop app.');
    return;
  }
  if (!_currentVideoData) return;

  const userId = getCurrentUserId();
  if (!userId) { alert('Please log in to download.'); return; }

  const btn = document.getElementById('offline-download-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...'; }

  const { lessonId, title, courseTitle, moduleTitle, videoUrl } = _currentVideoData;
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  let downloadedAny = false;

  // Helper: get signed URL for S3 files
  async function getSignedUrl(url) {
    if (!url || !url.includes('amazonaws.com')) return url;
    try {
      const res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ url }),
      });
      if (res.ok) { const d = await res.json(); if (d.signedUrl) return d.signedUrl; }
    } catch {}
    return url;
  }

  // Download video
  if (videoUrl) {
    try {
      const dlUrl = await getSignedUrl(videoUrl);
      const result = await window.electron.downloadContent({
        url: dlUrl, lessonId, title, type: 'video',
        userId, courseTitle, moduleTitle,
      });
      if (result.success) downloadedAny = true;
    } catch {}
  }

  // Download PDF (notes) if available
  const notesUrl = _currentVideoData.notesUrl || '';
  if (notesUrl) {
    try {
      const dlUrl = await getSignedUrl(notesUrl);
      const result = await window.electron.downloadContent({
        url: dlUrl, lessonId, title: title + ' (PDF)', type: 'pdf',
        userId, courseTitle, moduleTitle,
      });
      if (result.success) downloadedAny = true;
    } catch {}
  }

  if (btn) {
    btn.innerHTML = downloadedAny
      ? '<i class="fas fa-check"></i> Downloaded'
      : '<i class="fas fa-check"></i> Already saved';
  }
}

async function renderOfflineDownloads() {
  const container = document.getElementById('offline-downloads-list');
  if (!container) return;

  if (!window.electron || !window.electron.getDownloads) {
    container.innerHTML = '<p style="color:var(--muted);padding:20px">Downloads only available in the desktop app.</p>';
    return;
  }

  const userId = getCurrentUserId();
  if (!userId) {
    container.innerHTML = '<p style="color:var(--muted);padding:20px">Please log in to view downloads.</p>';
    return;
  }

  container.innerHTML = '<p style="color:var(--muted);padding:20px">Loading...</p>';
  const result = await window.electron.getDownloads({ userId });

  if (!result.success || result.downloads.length === 0) {
    container.innerHTML =
      '<div style="text-align:center;padding:60px 20px">' +
      '<i class="fas fa-download" style="font-size:2.5rem;color:var(--muted);margin-bottom:16px;display:block"></i>' +
      '<p style="color:var(--muted);font-size:0.95rem;font-weight:600">No offline downloads yet</p>' +
      '<p style="color:var(--muted);font-size:0.82rem;margin-top:6px">Open a lesson and click "Download" to save for offline use</p>' +
      '</div>';
    return;
  }

  container.innerHTML = result.downloads.map((d, i) => {
    const icon = d.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-video';
    const iconColor = d.type === 'pdf' ? '#ef4444' : 'var(--primary)';
    return '<div class="download-item">' +
      '<div class="download-icon" style="color:' + iconColor + '"><i class="fas ' + icon + '"></i></div>' +
      '<div class="download-info">' +
      '<h4>' + sanitize(d.title) + '</h4>' +
      '<p style="font-size:0.78rem;color:var(--muted);margin-top:2px">' + sanitize(d.courseTitle || '') + (d.moduleTitle ? ' · ' + sanitize(d.moduleTitle) : '') + '</p>' +
      '<p style="font-size:0.72rem;color:#f59e0b;margin-top:2px">Expires in ' + d.daysLeft + ' day' + (d.daysLeft !== 1 ? 's' : '') + '</p>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary btn-sm" onclick="playOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')">' +
      '<i class="fas ' + (d.type === 'pdf' ? 'fa-eye' : 'fa-play') + '"></i> ' + (d.type === 'pdf' ? 'View' : 'Watch') + '</button>' +
      '<button class="btn btn-outline btn-sm" onclick="deleteOfflineContent(\'' + d.lessonId + '\',\'' + d.type + '\')"><i class="fas fa-trash"></i></button>' +
      '</div>' +
      '</div>';
  }).join('');
}

async function playOfflineContent(lessonId, type) {
  if (!window.electron || !window.electron.playDownload) return;
  const userId = getCurrentUserId();
  const result = await window.electron.playDownload({ lessonId, type, userId });
  if (!result.success) { alert(result.message || 'Playback failed.'); return; }

  if (type === 'pdf') {
    const viewer = document.getElementById('pdf-viewer-modal');
    const iframe = document.getElementById('pdf-viewer-iframe');
    if (viewer && iframe) {
      iframe.src = result.serveUrl;
      viewer.style.display = 'flex';
    }
  } else {
    const iframeEl = document.getElementById('video-iframe');
    const videoEl = document.getElementById('video-player');
    if (iframeEl) { iframeEl.style.display = 'none'; iframeEl.src = ''; }
    if (videoEl) { videoEl.style.display = 'block'; videoEl.src = result.serveUrl; }
    navigate('video');
  }
}

async function deleteOfflineContent(lessonId, type) {
  if (!window.electron || !window.electron.deleteDownload) return;
  const userId = getCurrentUserId();
  await window.electron.deleteDownload({ lessonId, type, userId });
  renderOfflineDownloads();
}

function closePdfViewer() {
  const viewer = document.getElementById('pdf-viewer-modal');
  const iframe = document.getElementById('pdf-viewer-iframe');
  if (viewer) viewer.style.display = 'none';
  if (iframe) iframe.src = '';
}

async function openPdfInApp(url) {
  if (!url) return;
  // Use local HTTP server to serve PDF — avoids CSP issues and works offline
  if (window.electron && window.electron.playDownload) {
    const userId = getCurrentUserId();
    const lessonId = _currentVideoData ? _currentVideoData.lessonId : null;
    if (lessonId) {
      const result = await window.electron.playDownload({ lessonId, type: 'pdf', userId });
      if (result.success) {
        const viewer = document.getElementById('pdf-viewer-modal');
        const iframe = document.getElementById('pdf-viewer-iframe');
        if (viewer && iframe) { iframe.src = result.serveUrl; viewer.style.display = 'flex'; }
        return;
      }
    }
  }
  // Fallback: open signed URL in iframe (online only)
  try {
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    let pdfUrl = url;
    if (url.includes('amazonaws.com')) {
      const res = await fetch(BASE_URL + '/api/media/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ url }),
      });
      if (res.ok) { const d = await res.json(); if (d.signedUrl) pdfUrl = d.signedUrl; }
    }
    const viewer = document.getElementById('pdf-viewer-modal');
    const iframe = document.getElementById('pdf-viewer-iframe');
    if (viewer && iframe) { iframe.src = pdfUrl; viewer.style.display = 'flex'; }
  } catch { alert('Could not open PDF.'); }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.activeElement.id === 'chatInput') sendChat();
    if (document.activeElement.id === 'aiInput') sendAI();
  }
});

// Init
(async function init() {
  // Hide splash immediately — never block on any network call
  const splash = document.getElementById('splash');

  if (window.electron && window.electron.getPendingAuth) {
    try {
      const pending = await Promise.race([
        window.electron.getPendingAuth(),
        new Promise(resolve => setTimeout(() => resolve(null), 2000))
      ]);
      if (pending && pending.token) {
        if (pending.remember) {
          localStorage.setItem('ck_token', pending.token);
          localStorage.setItem('ck_user', pending.user || '{}');
        } else {
          sessionStorage.setItem('ck_token', pending.token);
          sessionStorage.setItem('ck_user', pending.user || '{}');
        }
      }
    } catch {}
  }

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
  if (token) {
    const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    if (cached.name) {
      const initial = cached.name.charAt(0).toUpperCase();
      const sidebarName = document.getElementById('sidebar-user-name');
      const sidebarAvatar = document.getElementById('sidebar-user-avatar');
      const dashWelcome = document.getElementById('dashboard-welcome-name');
      if (sidebarName) sidebarName.textContent = cached.name;
      if (sidebarAvatar) sidebarAvatar.textContent = initial;
      if (dashWelcome) dashWelcome.textContent = cached.name;
    }
    navigate('dashboard');
  } else {
    navigate('login');
  }

  // Hide splash immediately after navigation
  if (splash) splash.style.display = 'none';

  // All backend calls in background — never block UI
  if (token) {
    loadStudentData();
    StudentAPI.getDashboard().then(data => _applyDashboardData(data)).catch(() => {});
  }
  loadCourses().then(courses => renderCourseGrid(courses)).catch(() => renderCourseGrid(MOCK_COURSES));
  initCourseFilters();

  // Refresh dashboard on window focus (payment browser se wapas aane pe)
  window.addEventListener('focus', () => {
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (t) StudentAPI.getDashboard().then(data => _applyDashboardData(data)).catch(() => {});
  });

  // Listen for enrollment complete from deep link
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.on('enrollment-complete', () => {
      StudentAPI.getDashboard().then(d => _applyDashboardData(d)).catch(() => {});
      loadCourses().then(courses => renderCourseGrid(courses)).catch(() => {});
    });
  }

  // Polling fallback — har 5s mein enrollment check karo
  let _lastEnrolledCount = -1;
  setInterval(() => {
    if (!document.hasFocus()) return;
    const t = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (!t) return;
    StudentAPI.getDashboard().then(data => {
      if (!data.success) return;
      if (_lastEnrolledCount === -1) {
        _lastEnrolledCount = data.enrolledCount;
        return;
      }
      if (data.enrolledCount !== _lastEnrolledCount) {
        _lastEnrolledCount = data.enrolledCount;
        _applyDashboardData(data);
      }
    }).catch(() => {});
  }, 5000);
})();

// Chat and AI Functionality
function sendAI() {
  const input = document.getElementById('aiInput');
  const messages = document.getElementById('aiMessages');
  if (!input || !messages) return;
  const text = input.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg';
  userMsg.style.cssText = 'display: flex; gap: 16px; max-width: 85%; align-self: flex-end; flex-direction: row-reverse; animation: slideInRight 0.3s ease;';
  userMsg.innerHTML = `
    <div class="ai-icon" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #10b981, #34d399); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">You</div>
    <div class="ai-bubble" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 16px 0 16px 16px; padding: 16px 20px; color: #fff; font-size: 0.95rem; line-height: 1.5;">${sanitize(text)}</div>
  `;
  messages.appendChild(userMsg);
  input.value = '';
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });

  setTimeout(() => {
    const aiMsg = document.createElement('div');
    aiMsg.className = 'ai-msg';
    aiMsg.style.cssText = 'display: flex; gap: 16px; max-width: 85%; animation: slideInLeft 0.3s ease;';
    aiMsg.innerHTML = `
      <div class="ai-icon" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #3b1fa8, #6c47ff); display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(108, 71, 255, 0.3);">AI</div>
      <div class="ai-bubble" style="background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 0 16px 16px 16px; padding: 16px 20px; color: #fff; font-size: 0.95rem; line-height: 1.5;">
        <span style="font-style:italic; color:var(--muted)">Thinking...</span>
      </div>
    `;
    messages.appendChild(aiMsg);
    messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });

    setTimeout(async () => {
      const bubble = aiMsg.querySelector('.ai-bubble');
      const lowerText = text.toLowerCase();
      let reply = "";

      try {
        if (lowerText.includes('hello') || lowerText.includes('hi ') || lowerText === 'hi' || lowerText === 'hey') {
          reply = "Hello there! I am your CodingKida AI Mentor, powered by Antigravity magic ✨. How can I help you learn today?";
        } else if (lowerText.includes('joke') || lowerText.includes('funny')) {
          const res = await fetch('https://v2.jokeapi.dev/joke/Programming?type=single');
          const data = await res.json();
          reply = data.joke || "Why do programmers prefer dark mode? Because light attracts bugs! 🐛";
        } else if (lowerText.includes('who are you') || lowerText.includes('your name')) {
          reply = "I am an advanced AI Mentor built by Antigravity for CodingKida. I know about code, tech, and the universe! 🚀";
        } else {
          const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(text)}&utf8=&format=json&origin=*`);
          const searchData = await searchRes.json();
          if (searchData.query && searchData.query.search.length > 0) {
            const title = searchData.query.search[0].title;
            const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
            const summaryData = await summaryRes.json();
            if (summaryData.extract) {
              reply = `Here is what I found about **${title}**:<br><br>${summaryData.extract}`;
            } else {
              reply = "I couldn't find a detailed answer, but keep asking! I'm best at programming questions.";
            }
          } else {
            reply = "I couldn't find a specific answer for that in my database. But as your CodingKida mentor, I'm always here to help you learn coding! Ask me about Python, JavaScript, or AI.";
          }
        }
      } catch (err) {
        reply = "Oops! My magical Antigravity servers are taking a short break. Try asking again in a moment! ⚡";
      }

      bubble.innerHTML = reply;
      messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
    }, 1000);

  }, 500);
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const messages = document.getElementById('chatMessages');
  if (!input || !messages) return;
  const text = input.value.trim();
  if (!text) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg own';
  msg.innerHTML = `
    <div class="chat-avatar" style="background:#10b981">You</div>
    <div class="chat-bubble">
      <p>${sanitize(text)}</p>
      <div class="time">Just now</div>
    </div>
  `;
  messages.appendChild(msg);
  input.value = '';
  messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
}
