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

/**
 * Codo avatar for AI Mentor message rows — the mascot image with a gentle
 * continuous bob (reuses the codo-help wave styles injected by the quiz Help).
 */
function _aiCodoAvatar() {
  if (typeof _ensureCodoStyles === 'function') _ensureCodoStyles();
  return '<div class="ai-icon" style="padding:0;overflow:hidden;background:linear-gradient(135deg,#60a5fa,#a78bfa);">' +
    '<img src="assets/codo.jpg" alt="Codo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;animation:codoBob 3s ease-in-out infinite;"/>' +
    '</div>';
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
  loadingDiv.innerHTML = _aiCodoAvatar() + '<div class="ai-bubble" style="color:var(--muted)">Codo is thinking...</div>';
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
      // Reuse the shared quiz-Help markdown formatter for consistency.
      const formatted = (typeof _formatHelpText === 'function')
        ? _formatHelpText(result.answer)
        : sanitize(result.answer).replace(/\n/g, '<br/>');

      // Build Codo's answer bubble (mascot avatar + Listen button).
      const spokenText = (typeof _plainForSpeech === 'function') ? _plainForSpeech(result.answer) : result.answer;
      const speakId = 'ai-speak-' + Date.now();

      let bubbleInner =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="font-size:0.72rem;font-weight:800;color:#93c5fd;">Codo</span>' +
        '<button id="' + speakId + '" onclick="toggleCodoSpeak(this)" data-text="' + encodeURIComponent(spokenText) + '" title="Hear Codo read it" style="margin-left:auto;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:4px 10px;color:#93c5fd;font-size:0.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;"><i class="fas fa-volume-up"></i> Listen</button>' +
        '</div>' +
        formatted;

      // "From your course material" sources (name + open link + Ctrl-F snippet),
      // shown only when the answer was grounded in study material.
      const sources = Array.isArray(result.sources) ? result.sources : [];
      if (result.source === 'study_material' && sources.length > 0) {
        bubbleInner += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.12);">';
        bubbleInner += '<div style="font-size:0.72rem;font-weight:700;color:#86efac;margin-bottom:6px;">\uD83D\uDCD8 From your course material:</div>';
        sources.forEach(function (s) {
          const name = sanitize(s.name || 'Document');
          bubbleInner += '<div style="margin:8px 0;padding:8px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">';
          if (s.fileUrl) {
            bubbleInner += '<a href="#" onclick="openHelpSource(this); return false;" data-fileurl="' + encodeURIComponent(s.fileUrl) + '" style="color:#60a5fa;font-size:0.8rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="fas fa-file-pdf" style="color:#f87171;"></i> ' + name + ' <i class="fas fa-external-link-alt" style="font-size:0.65rem;opacity:0.7;"></i></a>';
          } else {
            bubbleInner += '<div style="color:#cbd5e1;font-size:0.8rem;font-weight:600;"><i class="fas fa-file-alt"></i> ' + name + '</div>';
          }
          if (s.snippet) {
            bubbleInner += '<div style="margin-top:6px;font-size:0.74rem;color:#94a3b8;line-height:1.4;"><span style="color:#fbbf24;">\uD83D\uDD0D Find this in the doc:</span> \u201C' + sanitize(s.snippet) + '\u201D</div>';
          }
          bubbleInner += '</div>';
        });
        bubbleInner += '</div>';
      }

      const aiDiv = document.createElement('div');
      aiDiv.className = 'ai-msg';
      aiDiv.innerHTML = _aiCodoAvatar() + '<div class="ai-bubble" style="color:#e2e8f0">' + bubbleInner + '</div>';
      container.appendChild(aiDiv);

      // Codo reads the answer aloud automatically (same as quiz Help).
      if (typeof _codoSpeak === 'function') {
        _codoSpeak(spokenText, document.getElementById(speakId));
      }
    } else {
      const errDiv = document.createElement('div');
      errDiv.className = 'ai-msg';
      errDiv.innerHTML = _aiCodoAvatar() + '<div class="ai-bubble" style="color:#f59e0b">\u23f3 ' + (result.message || 'Codo is busy. Please wait a few seconds and try again.') + '</div>';
      container.appendChild(errDiv);
    }
  } catch (err) {
    document.getElementById('ai-loading')?.remove();
    const errDiv = document.createElement('div');
    errDiv.className = 'ai-msg';
    errDiv.innerHTML = _aiCodoAvatar() + '<div class="ai-bubble" style="color:#f59e0b">\u23f3 Codo is busy. Please wait a few seconds and try again.</div>';
    container.appendChild(errDiv);
  }

  // Re-enable input and button
  input.disabled = false;
  if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  input.focus();
  container.scrollTop = container.scrollHeight;
}
