/**
 * CodingKida Desktop — AI Chat
 * Dashboard AI chat, and video chat.
 * (The lesson video-player "AI Mentor" was removed and replaced by the lesson
 *  Q&A doubt chat — see lesson-chat.js. Dashboard AI remains unchanged.)
 */

// Dashboard AI chat history
let _dashboardAIHistory = [];

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
  const sendBtn = input ? input.closest('.chat-input-bar')?.querySelector('button') : null;

  // Disable input and button during fetch
  input.disabled = true;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

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
    const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

    const response = await fetch(BASE_URL + '/api/ai-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ question: msg, mode: 'general' }),
    });

    const result = await response.json();
    document.getElementById('ai-loading')?.remove();

    if (result.success && result.answer) {
      let formatted = result.answer
        .replace(/```(\w*)\n([\s\S]*?)```/g, function(m, lang, code) {
          const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<pre style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:8px;padding:12px;margin:8px 0;overflow-x:auto;font-family:monospace;font-size:0.8rem;color:#a78bfa;">' + escaped + '</pre>';
        })
        .replace(/`([^`]+)`/g, function(m, code) {
          const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<code style="background:rgba(108,71,255,0.15);padding:2px 6px;border-radius:4px;font-family:monospace;font-size:0.8rem;color:#c4b5fd;">' + escaped + '</code>';
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff;">$1</strong>')
        .replace(/\n/g, '<br/>');

      const aiDiv = document.createElement('div');
      aiDiv.className = 'ai-msg';
      aiDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:#e2e8f0">' + formatted + '</div>';
      container.appendChild(aiDiv);
    } else {
      const errDiv = document.createElement('div');
      errDiv.className = 'ai-msg';
      errDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:#f59e0b">\u23f3 ' + (result.message || 'AI is busy. Please wait a few seconds and try again.') + '</div>';
      container.appendChild(errDiv);
    }
  } catch (err) {
    document.getElementById('ai-loading')?.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'ai-msg';
    errDiv.innerHTML = '<div class="ai-icon">AI</div><div class="ai-bubble" style="color:#f59e0b">\u23f3 AI is busy. Please wait a few seconds and try again.</div>';
    container.appendChild(errDiv);
  }

  // Re-enable input and button
  input.disabled = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  input.focus();
  container.scrollTop = container.scrollHeight;
}
