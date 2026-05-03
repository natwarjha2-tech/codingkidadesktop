const appPages = ['dashboard','courses','course-detail','video','chat','ai','live','downloads','profile'];
const authPages = ['login','signup'];
const sidebarMap = { dashboard:'nav-dashboard', courses:'nav-courses', 'course-detail':'nav-courses', video:'nav-courses', chat:'nav-chat', ai:'nav-ai', live:'nav-live', downloads:'nav-downloads', profile:'nav-profile' };

function navigate(page) {
  // hide all auth pages
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

  // show app shell
  app.style.display = 'flex';

  // hide all app pages
  appPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });

  // show target page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // update sidebar active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = sidebarMap[page];
  if (navId) {
    const navEl = document.getElementById(navId);
    if (navEl) navEl.classList.add('active');
  }
}

function switchTab(el, tabId) {
  // deactivate all tabs
  el.parentElement.querySelectorAll('.video-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  // hide all tab contents
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

function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'chat-msg own';
  div.innerHTML = `<div class="chat-avatar">Y</div><div class="chat-bubble"><p>${msg}</p><div class="time">Just now</div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  input.value = '';
}

async function sendAI() {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('aiMessages');

  // user message
  const userDiv = document.createElement('div');
  userDiv.className = 'ai-msg user';
  userDiv.innerHTML = `<div class="ai-icon" style="background:var(--primary)">Y</div><div class="ai-bubble">${msg}</div>`;
  container.appendChild(userDiv);
  input.value = '';

  // loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'ai-msg';
  loadingDiv.id = 'ai-loading';
  loadingDiv.innerHTML = `<div class="ai-icon">🤖</div><div class="ai-bubble" style="color:var(--muted)">Thinking...</div>`;
  container.appendChild(loadingDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `You are a helpful coding tutor for CodingKeda platform. Answer this student question clearly and concisely: ${msg}` }]
          }]
        })
      }
    );
    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not get a response. Please try again.';

    // remove loading
    document.getElementById('ai-loading')?.remove();

    const aiDiv = document.createElement('div');
    aiDiv.className = 'ai-msg';
    aiDiv.innerHTML = `<div class="ai-icon">🤖</div><div class="ai-bubble">${answer.replace(/\n/g, '<br/>')}</div>`;
    container.appendChild(aiDiv);
  } catch (err) {
    document.getElementById('ai-loading')?.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'ai-msg';
    errDiv.innerHTML = `<div class="ai-icon">🤖</div><div class="ai-bubble" style="color:var(--danger)">Error connecting to AI. Check your API key or internet connection.</div>`;
    container.appendChild(errDiv);
  }

  container.scrollTop = container.scrollHeight;
}

// filter tabs on courses page
document.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    tab.closest('.filter-tabs').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// enter key support for chat and AI
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (document.activeElement.id === 'chatInput') sendChat();
    if (document.activeElement.id === 'aiInput') sendAI();
  }
});
