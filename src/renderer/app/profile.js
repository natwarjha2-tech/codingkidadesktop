/**
 * CodingKida Desktop — Profile Management
 * Logout, profile editing, password change, photo upload.
 */

function logout() {
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
