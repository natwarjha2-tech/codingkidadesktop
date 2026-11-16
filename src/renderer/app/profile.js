/**
 * CodingKida Desktop — Profile Management
 * Logout, profile editing, password change, photo upload.
 */

function logout() {
  // Stop any Codo voice immediately on logout.
  try { if (typeof _codoStopAll === 'function') _codoStopAll(); } catch (e) {}
  // Codo "finish the quiz first?" nudge — if the student is on the lesson video
  // screen, has watched ≥90%, and hasn't done the quiz, Codo asks before they
  // log out. "Not now" resumes the logout.
  try {
    if (typeof getCurrentActivePage === 'function' && getCurrentActivePage() === 'video' &&
        typeof codoMaybeInterceptLeave === 'function' &&
        codoMaybeInterceptLeave(function () { logout(); })) {
      return;
    }
  } catch (e) {}

  const userId = getCurrentUserId();
  if (userId) {
    _attendanceRecordLogout(userId);
    localStorage.removeItem('ck_dashboard_cache_' + userId);
    // NOTE: Persistent cache (ck_pcache_*) intentionally NOT cleared on logout.
    // Same user re-login = instant data from cache. Different user detection clears old cache.
  }
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
  const studentName = document.getElementById('student-name-input')?.value.trim();
  const studentDob = document.getElementById('student-dob-input')?.value;
  const studentGrade = document.getElementById('student-grade-input')?.value;
  const studentGender = document.getElementById('student-gender-input')?.value;
  const studentSchool = document.getElementById('student-school-input')?.value.trim();
  const parentName = document.getElementById('parent-name-input')?.value.trim();
  const parentEmail = document.getElementById('parent-email-input')?.value.trim();
  const parentContact = document.getElementById('parent-contact-input')?.value.trim();

  if (!name) {
    const msgEl = document.getElementById('profile-save-msg');
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = 'var(--danger)'; msgEl.textContent = 'Account name is required.'; }
    return;
  }

  const msgEl = document.getElementById('profile-save-msg');
  if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = 'var(--muted)'; msgEl.textContent = 'Saving...'; }

  try {
    const profileData = {
      name,
      studentName,
      studentDob,
      studentGrade,
      studentGender,
      studentSchool,
      parentName,
      parentEmail,
      parentContact
    };

    const data = await StudentAPI.updateProfile(profileData);
    if (!data.success) throw new Error(data.message);

    // Update localStorage with all profile data
    const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
    Object.assign(cached, profileData);
    if (localStorage.getItem('ck_user')) localStorage.setItem('ck_user', JSON.stringify(cached));
    else sessionStorage.setItem('ck_user', JSON.stringify(cached));

    // Update UI elements that show the display name
    const initial = name.charAt(0).toUpperCase();
    const profileName = document.getElementById('profile-name');
    const profileAvatarText = document.getElementById('profile-avatar-text');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarAvatar = document.getElementById('sidebar-avatar-text');
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

// Change password
async function changePassword() {
  const currentPwd = document.getElementById('pwd-current')?.value.trim();
  const newPwd = document.getElementById('pwd-new')?.value.trim();
  const confirmPwd = document.getElementById('pwd-confirm')?.value.trim();
  const msgEl = document.getElementById('pwd-change-msg');

  if (msgEl) { msgEl.style.display = 'none'; }

  if (!currentPwd || !newPwd || !confirmPwd) {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = 'All password fields are required.'; }
    return;
  }
  if (newPwd.length < 8) {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = 'New password must be at least 8 characters.'; }
    return;
  }
  if (newPwd !== confirmPwd) {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = 'New passwords do not match.'; }
    return;
  }

  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  try {
    const res = await fetch(BASE_URL + '/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
    });
    const data = await res.json();
    if (data.success) {
      if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#10b981'; msgEl.style.background = 'rgba(16,185,129,0.1)'; msgEl.textContent = '✅ Password changed successfully!'; }
      document.getElementById('pwd-current').value = '';
      document.getElementById('pwd-new').value = '';
      document.getElementById('pwd-confirm').value = '';
    } else {
      if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = '❌ ' + (data.message || 'Failed to change password.'); }
    }
  } catch {
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ef4444'; msgEl.style.background = 'rgba(239,68,68,0.1)'; msgEl.textContent = '❌ Network error. Please try again.'; }
  }
}

function handleProfilePhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    // Show preview immediately
    const img = document.getElementById('profile-avatar-img');
    const text = document.getElementById('profile-avatar-text');
    if (img) { img.src = e.target.result; img.style.display = 'block'; }
    if (text) text.style.display = 'none';
    const sidebarImg = document.getElementById('sidebar-avatar-img');
    const sidebarText = document.getElementById('sidebar-avatar-text');
    if (sidebarImg) { sidebarImg.src = e.target.result; sidebarImg.style.display = 'block'; }
    if (sidebarText) sidebarText.style.display = 'none';
    const topbarImg = document.getElementById('topbar-avatar-img');
    const topbarText = document.getElementById('topbar-avatar-text');
    if (topbarImg) { topbarImg.src = e.target.result; topbarImg.style.display = 'block'; }
    if (topbarText) topbarText.style.display = 'none';
    const topbarProfileImg = document.getElementById('topbar-profile-avatar-img');
    const topbarProfileText = document.getElementById('topbar-profile-initial');
    if (topbarProfileImg) { topbarProfileImg.src = e.target.result; topbarProfileImg.style.display = 'block'; }
    if (topbarProfileText) topbarProfileText.style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Upload to server for cross-device sync
  const token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (token) {
    const formData = new FormData();
    formData.append('avatar', file);
    fetch(BASE_URL + '/api/student/avatar', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: formData,
    }).catch(() => {});
  }
}

function openEditProfile() {
  navigate('profile');
  document.getElementById('profile-name-input')?.focus();
}

// ── Delete account (Google Play / App Store standard) ──────────────────────
// Explain → type DELETE → code sent to the account email → signed out. The
// account is deleted after 30 days unless the student signs in again.
function openDeleteAccount() {
  var existing = document.getElementById('ck-del-modal');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'ck-del-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,15,0.75);z-index:11000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
  var box = document.createElement('div');
  box.style.cssText = 'width:100%;max-width:460px;max-height:88vh;overflow-y:auto;background:#141428;border:1px solid rgba(248,113,113,0.35);border-radius:16px;padding:22px;color:#e2e8f0;font-size:0.85rem;line-height:1.5;';
  box.innerHTML =
    '<div style="font-size:1.05rem;font-weight:800;color:#fff;margin-bottom:10px;">Delete your account</div>' +
    '<ul style="margin:0 0 12px 18px;padding:0;color:#cbd5e1;">' +
    '<li>You are signed out of all devices straight away.</li>' +
    '<li>Your account is permanently deleted after 30 days. Sign in again before then to restore it.</li>' +
    '<li>We delete your profile, email, phone, parent details, photo, notifications, chat messages and saved code.</li>' +
    '<li>Progress, coins, badges, certificates and purchased courses can\'t be recovered. Purchases are not refunded.</li>' +
    '<li>Payment records are kept only where the law requires, without your name or email.</li>' +
    '</ul>' +
    '<div id="ck-del-step1">' +
    '<label style="display:block;margin-top:8px;color:#94a3b8;">Why are you leaving? (optional)</label>' +
    '<textarea id="ck-del-reason" maxlength="500" rows="3" style="width:100%;margin-top:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:8px;"></textarea>' +
    '<label style="display:block;margin-top:8px;color:#94a3b8;">Type <b>DELETE</b> to continue</label>' +
    '<input id="ck-del-confirm" style="width:100%;margin-top:4px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:8px;" />' +
    '<button id="ck-del-send" class="btn btn-danger" style="width:100%;margin-top:14px;border-radius:8px;" disabled>Send confirmation code to my email</button>' +
    '</div>' +
    '<div id="ck-del-step2" style="display:none;">' +
    '<div id="ck-del-sent" style="margin-top:8px;color:#94a3b8;"></div>' +
    '<input id="ck-del-code" maxlength="6" inputmode="numeric" placeholder="6-digit code" style="width:100%;margin-top:6px;text-align:center;letter-spacing:8px;font-size:1.2rem;font-weight:800;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;padding:8px;" />' +
    '<button id="ck-del-go" class="btn btn-danger" style="width:100%;margin-top:14px;border-radius:8px;" disabled>Delete my account</button>' +
    '<button id="ck-del-resend" class="btn btn-outline" style="width:100%;margin-top:8px;border-radius:8px;">Send a new code</button>' +
    '</div>' +
    '<div id="ck-del-msg" style="margin-top:10px;color:#f87171;"></div>' +
    '<button class="btn btn-outline" style="width:100%;margin-top:10px;border-radius:8px;" onclick="document.getElementById(\'ck-del-modal\').remove()">Cancel</button>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  var msg = document.getElementById('ck-del-msg');
  var post = function (path, body) {
    return fetch(BASE_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || d.success === false) throw new Error(d.message || 'Something went wrong.');
        return d;
      });
    });
  };
  var confirmInput = document.getElementById('ck-del-confirm');
  var sendBtn = document.getElementById('ck-del-send');
  confirmInput.oninput = function () { sendBtn.disabled = confirmInput.value.trim().toUpperCase() !== 'DELETE'; };
  var codeInput = document.getElementById('ck-del-code');
  var goBtn = document.getElementById('ck-del-go');
  codeInput.oninput = function () {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
    goBtn.disabled = codeInput.value.length !== 6;
  };

  var sendCode = function () {
    msg.textContent = '';
    sendBtn.disabled = true;
    post('/api/account/delete/send-code').then(function (d) {
      document.getElementById('ck-del-step1').style.display = 'none';
      document.getElementById('ck-del-step2').style.display = 'block';
      document.getElementById('ck-del-sent').textContent = 'We sent a 6-digit code to ' + (d.sentTo || 'your email') + '.';
      codeInput.focus();
    }).catch(function (e) { msg.textContent = e.message; sendBtn.disabled = false; });
  };
  sendBtn.onclick = sendCode;
  document.getElementById('ck-del-resend').onclick = sendCode;

  goBtn.onclick = function () {
    if (!window.confirm('Delete your CodingKida account? You will be signed out of all devices. It is deleted permanently after 30 days unless you sign in again.')) return;
    msg.textContent = '';
    goBtn.disabled = true;
    post('/api/account/delete', {
      code: codeInput.value.trim(),
      reason: document.getElementById('ck-del-reason').value,
      channel: 'desktop',
    }).then(function (d) {
      var when = d.scheduledFor ? new Date(d.scheduledFor).toLocaleDateString('en-IN', { dateStyle: 'long' }) : 'in 30 days';
      window.alert('Your account will be deleted on ' + when + '. Sign in again before then to keep it.');
      // Sign out and remove everything stored on this computer.
      try { if (typeof _attendanceRecordLogout === 'function') _attendanceRecordLogout(); } catch (e) {}
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('ck_') === 0 && k !== 'ck_saved_login') localStorage.removeItem(k); });
      localStorage.removeItem('ck_saved_login');
      sessionStorage.clear();
      window.location.href = 'login.html';
    }).catch(function (e) { msg.textContent = e.message; goBtn.disabled = false; });
  };
}
