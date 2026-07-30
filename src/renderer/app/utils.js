/**
 * CodingKida Desktop — Shared Utilities
 * Core helper functions used across all modules.
 */

// ─── DOM Sanitize (XSS prevention) ──────────────────────────────────────────
function sanitize(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ─── Auth UI Helpers ─────────────────────────────────────────────────────────
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

// ─── User Identity ───────────────────────────────────────────────────────────
function getCurrentUserId() {
  const cached = JSON.parse(localStorage.getItem('ck_user') || sessionStorage.getItem('ck_user') || '{}');
  return cached.id || cached.userId || '';
}

// ─── URL Helpers ─────────────────────────────────────────────────────────────
function _openUrl(url) {
  if (window.electron && window.electron.openExternal) {
    window.electron.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}
