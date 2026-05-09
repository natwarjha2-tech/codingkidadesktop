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

    const profileName = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileNameInput = document.getElementById('profile-name-input');
    const profileEmailInput = document.getElementById('profile-email-input');
    if (profileName) profileName.textContent = name;
    if (profileEmail) profileEmail.textContent = email;
    if (profileAvatar) profileAvatar.textContent = initial;
    if (profileNameInput) profileNameInput.value = name;
    if (profileEmailInput) profileEmailInput.value = email;
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
}

function logout() {
  localStorage.removeItem('ck_token');
  localStorage.removeItem('ck_user');
  window.location.href = 'login.html';
}

async function saveProfile() {
  const name = document.getElementById('profile-name-input')?.value.trim();
  if (!name) return;
  const cached = JSON.parse(localStorage.getItem('ck_user') || '{}');
  cached.name = name;
  localStorage.setItem('ck_user', JSON.stringify(cached));
  const initial = name.charAt(0).toUpperCase();
  const profileName = document.getElementById('profile-name');
  const profileAvatar = document.getElementById('profile-avatar');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  const dashWelcome = document.getElementById('dashboard-welcome-name');
  if (profileName) profileName.textContent = name;
  if (profileAvatar) profileAvatar.textContent = initial;
  if (sidebarName) sidebarName.textContent = name;
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (dashWelcome) dashWelcome.textContent = name;
}

// Navigation

const appPages = ['dashboard','courses','course-detail','video','chat','ai','live','downloads','profile'];
const authPages = ['login','signup'];
const sidebarMap = { dashboard:'nav-dashboard', courses:'nav-courses', 'course-detail':'nav-courses', video:'nav-courses', chat:'nav-chat', ai:'nav-ai', live:'nav-live', downloads:'nav-downloads', profile:'nav-profile' };

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

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = sidebarMap[page];
  if (navId) {
    const navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add('active');
  }
}

function switchTab(el, tabId) {
  el.parentElement.querySelectorAll('.video-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
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
    price: c.isFree ? 'Free' : (c.price ? 'Rs.' + c.price : 'Paid'),
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
    grid.innerHTML = '<p style="color:var(--muted);padding:20px">No courses found.</p>';
    return;
  }
  grid.innerHTML = courses.map(c => `
    <div class="course-card" onclick="openCourseDetail('${c.id}')">
      <div class="course-thumb" style="background:${c.gradient}"><i class="${c.icon}"></i></div>
      <div class="course-body">
        <h3>${sanitize(c.title)}</h3>
        <p>${sanitize(c.subtitle)}</p>
        <div class="course-meta">
          <span class="course-rating"><i class="fas fa-star"></i> ${c.rating}</span>
          <span class="badge ${c.free ? 'badge-free' : 'badge-paid'}">${sanitize(c.price)}</span>
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
  priceBtn.textContent = course.isFree ? 'Free Course' : 'Unlock Rs.' + (course.price || '');
  priceBtn.onclick = course.isFree ? null : () => openPaymentPage();

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
      item.className = 'playlist-item' + (lesson.isFree ? '' : ' locked');
      if (lesson.isFree) {
        item.onclick = () => openVideoFromBackend(course.id, mod.id, lesson.id);
      }
      item.innerHTML =
        '<i class="fas ' + (lesson.isFree ? 'fa-play-circle' : 'fa-lock') + '" style="color:' + (lesson.isFree ? 'var(--success)' : '') + '"></i>' +
        '<span class="item-title">' + sanitize(lesson.title) + '</span>' +
        '<span class="item-duration">' + (lesson.duration || '') + '</span>' +
        '<span class="badge ' + (lesson.isFree ? 'badge-free' : 'badge-paid') + '">' + (lesson.isFree ? 'Free' : 'Pro') + '</span>';
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
  priceBtnMock.textContent = course.free ? 'Free Course' : 'Unlock ' + course.price;
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
function openVideoFromBackend(courseId, moduleId, lessonId) {
  CoursesAPI.getById(courseId).then(data => {
    if (!data.success) return;
    const course = data.course;
    const mod = (course.modules || []).find(m => m.id === moduleId);
    if (!mod) return;
    const lesson = (mod.lessons || []).find(l => l.id === lessonId);
    if (!lesson) return;

    document.getElementById('video-iframe').src = lesson.videoUrl ? lesson.videoUrl + (lesson.videoUrl.includes('youtube') ? '?rel=0' : '') : '';
    document.getElementById('video-title').textContent = lesson.title || '';
    document.getElementById('video-meta').textContent = mod.title + ' - ' + (lesson.duration || '');

    const notesUrl = lesson.notes || '';
    document.getElementById('tab-notes').innerHTML =
      '<h4 style="margin-bottom:12px">Notes</h4>' +
      '<p style="color:var(--muted);font-size:0.88rem;line-height:1.8">' + (notesUrl ? 'PDF notes available for this lesson.' : 'No notes available.') + '</p>' +
      (notesUrl ? '<button class="btn btn-outline btn-sm" style="margin-top:14px" onclick="downloadPdf(\'' + notesUrl + '\')"><i class="fas fa-download"></i> Download PDF</button>' : '');

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
  playlist.innerHTML = mod.videos.map(v => `
    <div class="playlist-item ${v.id === videoId ? 'active' : ''} ${v.free ? '' : 'locked'}" onclick="${v.free ? 'openVideo(' + courseId + ',' + moduleId + ',' + v.id + ')' : 'void(0)'}">
      <i class="fas ${v.free ? 'fa-play-circle' : 'fa-lock'}"></i>
      <span class="item-title">${sanitize(v.title)}</span>
      <span class="item-duration">${v.duration}</span>
    </div>`).join('');

  const mockChatContainer = document.querySelector('#tab-chat .video-chat-messages');
  if (mockChatContainer) mockChatContainer.innerHTML = '';

  document.getElementById('tab-quiz').style.display = 'none';
  document.getElementById('tab-exercise').style.display = 'none';
  document.getElementById('tab-chat').style.display = 'none';
  document.getElementById('tab-notes').style.display = 'block';
  document.querySelectorAll('.video-tab').forEach((t, i) => t.classList.toggle('active', i === 0));

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

function openPaymentPage() {
  const url = 'https://www.codingkida.com/payment';
  if (window.electron && window.electron.ipcRenderer) {
    window.electron.ipcRenderer.invoke('open-external', url);
  } else {
    window.open(url, '_blank');
  }
}

function downloadPdf(url) {
  if (!url) return;
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

function initCourseFilters() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      tab.closest('.filter-tabs').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.textContent.trim();
      const search = document.getElementById('course-search-input')?.value.trim() || '';
      const courses = await loadCourses(filter, search);
      renderCourseGrid(courses);
    });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.activeElement.id === 'chatInput') sendChat();
    if (document.activeElement.id === 'aiInput') sendAI();
  }
});

// Init
(async function init() {
  if (window.electron && window.electron.getPendingAuth) {
    const pending = await window.electron.getPendingAuth();
    if (pending && pending.token) {
      if (pending.remember) {
        localStorage.setItem('ck_token', pending.token);
        localStorage.setItem('ck_user', pending.user || '{}');
      } else {
        sessionStorage.setItem('ck_token', pending.token);
        sessionStorage.setItem('ck_user', pending.user || '{}');
      }
    }
  }

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
  if (token) {
    await loadStudentData();
    navigate('dashboard');
  } else {
    navigate('login');
  }

  // Load courses from backend (fallback to mockData if backend down)
  const courses = await loadCourses();
  renderCourseGrid(courses);
  initCourseFilters();

  const splash = document.getElementById('splash');
  if (splash) splash.style.display = 'none';
})();
