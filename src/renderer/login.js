(function initParticles() {
  const canvas = document.getElementById('lp-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
    r: Math.random() * 1.6 + 0.3, dx: (Math.random() - 0.5) * 0.28, dy: (Math.random() - 0.5) * 0.28,
    o: Math.random() * 0.3 + 0.07,
  }));
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167,139,250,${p.o})`; ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

(function initAnimations() {
  if (typeof gsap === 'undefined') return;
  gsap.from('#lp-left', { x: -28, opacity: 0, duration: 0.9, ease: 'power3.out' });
  gsap.from('#lp-card', { opacity: 0, duration: 0.9, ease: 'power3.out' });
  gsap.to('.lp-orb-tl', { y: 24, x: 12, duration: 4.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.lp-orb-br', { y: -20, x: -14, duration: 5.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
})();

function togglePassword() {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('lp-eye-icon');
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  icon.innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
}

window.login = async function () {
  const btn = document.getElementById('login-btn');
  const btnIcon = document.getElementById('lp-btn-icon');
  const btnText = document.getElementById('lp-btn-text');
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.style.display = 'none';

  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value.trim();

  if (!email || !password) {
    showLpError(errorEl, !email ? 'Please enter your email.' : 'Please enter your password.');
    return;
  }

  btn.disabled = true;
  btnText.textContent = 'Logging in...';
  let spinTween;
  if (typeof gsap !== 'undefined' && btnIcon) {
    spinTween = gsap.to(btnIcon, { rotation: 360, duration: 0.6, repeat: -1, ease: 'none' });
  }
  try {
    const data = await AuthAPI.login(email, password);
    if (spinTween) spinTween.kill();
    const remember = document.getElementById('lp-remember')?.checked;
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('ck_token', data.token);
    storage.setItem('ck_user', JSON.stringify(data.user || {}));
    await loadStudentData();
    navigate('dashboard');
  } catch (err) {
    if (spinTween) spinTween.kill();
    if (btnIcon && typeof gsap !== 'undefined') gsap.set(btnIcon, { rotation: 0 });
    btn.disabled = false;
    btnText.textContent = 'Log In';
    showLpError(errorEl, err.message || 'Invalid credentials. Please try again.');
  }
};

function showLpError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
