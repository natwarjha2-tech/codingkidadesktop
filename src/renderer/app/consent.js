/**
 * CodingKida Desktop — sign-up checks + parent verification.
 *
 * Students under 18 (and anyone whose age is not on file) need a parent or
 * guardian to confirm: the student saves the parent's email and phone, a 6-digit
 * code goes to the parent's email (and to their WhatsApp once that is switched
 * on), the parent reads the codes out and the student types them in.
 * Before the deadline the screen can be closed; after it, it holds the app.
 */

// ── Sign-up checks (the same rules the server applies; the server decides) ──────
var CK_NAME_MESSAGE = 'Enter your real name: letters only, 2 to 50 characters (no email address or numbers).';
var CK_NAME_PLACEHOLDERS = ['test', 'testing', 'abc', 'abcd', 'abcde', 'xyz', 'user', 'username', 'student', 'name', 'your name',
  'full name', 'admin', 'demo', 'asdf', 'asd', 'qwerty', 'na', 'none', 'null', 'undefined', 'unknown', 'nothing', 'hello', 'hi'];

function ckValidateName(raw) {
  var name = String(raw || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 50) return CK_NAME_MESSAGE;
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) return CK_NAME_MESSAGE;
  if ((name.match(/\p{L}/gu) || []).length < 2) return CK_NAME_MESSAGE;
  if (CK_NAME_PLACEHOLDERS.indexOf(name.toLowerCase()) !== -1) return CK_NAME_MESSAGE;
  if (/(.)\1{3,}/u.test(name)) return CK_NAME_MESSAGE;
  return null;
}

function ckValidateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()) ? null : 'Enter a valid email address.';
}

var CK_COMMON_PASSWORDS = ['password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword1', 'qwerty123', 'qwertyuiop',
  'abcd1234', 'abc12345', 'abcdefgh', '12345678', '123456789', '1234567890', 'iloveyou', 'welcome1', 'welcome123', 'admin123',
  'letmein1', 'india123', 'india@123', 'codingkida', 'codingkida1', 'codingkida123', 'student123', 'student1', 'test1234',
  'test@123', 'master123', 'login123', 'changeme', 'sunshine1', 'princess1', 'football1', 'monkey123'];
var CK_COMMON_BASE = ['password', 'passw0rd', 'qwerty', 'welcome', 'iloveyou', 'letmein', 'admin', 'student', 'india', 'codingkida',
  'abcd', 'abcdefgh', 'test', 'login', 'master', 'changeme'];

function ckValidatePassword(pw, email) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  var p = pw.toLowerCase();
  var base = p.replace(/[0-9!@#$%^&*._-]+$/, '');
  if (CK_COMMON_PASSWORDS.indexOf(p) !== -1 || (base && CK_COMMON_BASE.indexOf(base) !== -1)) {
    return 'That password is too common. Choose something harder to guess.';
  }
  var local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && p.indexOf(local) !== -1) return 'Password must not contain your email name.';
  return null;
}

/** "yyyy-mm-dd" (the date picker) or "dd-mm-yyyy" → { y, m, d } or null. */
function ckParseDob(raw) {
  var s = String(raw || '').trim();
  var y, m, d;
  var iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else {
    var dm = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    if (!dm) return null;
    d = +dm[1]; m = +dm[2]; y = +dm[3];
  }
  var t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y: y, m: m, d: d };
}

/** Whole years old today, or null when the date isn't valid. */
function ckAgeFromDob(raw) {
  var dob = ckParseDob(raw);
  if (!dob) return null;
  var now = new Date();
  var age = now.getFullYear() - dob.y;
  if (now.getMonth() + 1 < dob.m || (now.getMonth() + 1 === dob.m && now.getDate() < dob.d)) age -= 1;
  return age;
}

function ckValidateDob(raw) {
  var age = ckAgeFromDob(raw);
  if (age === null) return 'Enter your date of birth.';
  if (age < 0) return "The date of birth can't be in the future.";
  if (age < 3 || age > 100) return 'Please check the date of birth.';
  return null;
}

/** Sign-up form: show the parent fields only for students under 18. */
function ckSignupDobChanged() {
  var el = document.getElementById('signup-dob');
  var box = document.getElementById('signup-parent-box');
  if (!el || !box) return;
  var age = ckAgeFromDob(el.value);
  box.style.display = age !== null && age >= 0 && age < 18 ? 'block' : 'none';
}

// ── Parent verification screen ──────────────────────────────────────────────────
var _ckC = null;                 // working state of the open screen
var _ckConsentReminded = false;  // one reminder per app start

function _ckEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/** "12-04-2010" (phone app) → "2010-04-12" (date picker). Anything else is left as is. */
function _ckToIso(s) {
  var m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(String(s || '').trim());
  if (!m) return String(s || '').trim();
  return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

/** After sign-in / app start: remind, or hold the app until the parent is verified. */
async function ckCheckConsent() {
  try {
    var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
    if (!token) return;
    var d = await ConsentAPI.get();
    var c = d && d.consent;
    if (!c || !c.enabled || !c.required || c.verified) return;
    if (document.getElementById('ck-consent-overlay')) return;
    if (c.blocked) { ckShowConsent(c, { blocking: true }); return; }
    if (_ckConsentReminded) return;
    _ckConsentReminded = true;
    _ckShowConsentBanner(c);
  } catch (e) { /* never block the app because this check failed */ }
}

function _ckShowConsentBanner(c) {
  var old = document.getElementById('ck-consent-banner');
  if (old) old.remove();
  var left = c.daysLeft == null ? 0 : c.daysLeft;
  var bar = document.createElement('div');
  bar.id = 'ck-consent-banner';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:11500;background:#b45309;color:#fff;padding:10px 16px;' +
    'display:flex;align-items:center;gap:12px;font-size:0.85rem;box-shadow:0 2px 12px rgba(0,0,0,0.4)';
  bar.innerHTML = '<span style="flex:1">Parent verification needed. ' + (left <= 1 ? 'Today is the last day.' : 'You have ' + left + ' days left.') +
    ' After that, learning stops until it is done.</span>' +
    '<button id="ck-banner-go" style="background:#fff;color:#92400e;border:none;border-radius:8px;padding:6px 14px;font-weight:700;cursor:pointer">Verify now</button>' +
    '<button id="ck-banner-x" style="background:none;border:none;color:#fff;font-size:1.1rem;cursor:pointer" aria-label="Close">\u2715</button>';
  document.body.appendChild(bar);
  document.getElementById('ck-banner-go').onclick = function () { bar.remove(); ckShowConsent(c, { blocking: false }); };
  document.getElementById('ck-banner-x').onclick = function () { bar.remove(); };
}

/** Open the verification screen. `c` = consent state (fetched when null). */
async function ckShowConsent(c, opts) {
  opts = opts || {};
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token');
  if (!token) return;
  if (!c) {
    try { c = (await ConsentAPI.get()).consent; } catch (e) { return; }
  }
  if (!c || !c.required || c.verified) return;
  var banner = document.getElementById('ck-consent-banner');
  if (banner) banner.remove();
  _ckC = { c: c, blocking: !!(opts.blocking || c.blocked), busy: '', msg: null, emailSent: false, emailTo: '', phoneSent: false, devCode: null };
  _ckFillForm(c);
  _ckRenderConsent();
}

function _ckFillForm(c) {
  _ckC.dob = _ckToIso(c.studentDob);
  _ckC.parentName = c.parentName || '';
  _ckC.parentEmail = c.parentEmail || '';
  _ckC.parentPhone = c.parentContact || '';
}

function _ckConsentDirty() {
  var c = _ckC.c;
  return _ckC.dob !== _ckToIso(c.studentDob) || _ckC.parentName.trim() !== (c.parentName || '') ||
    _ckC.parentEmail.trim() !== (c.parentEmail || '') || _ckC.parentPhone.trim() !== (c.parentContact || '');
}

function _ckRenderConsent() {
  if (!_ckC) return;
  var c = _ckC.c;
  var overlay = document.getElementById('ck-consent-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ck-consent-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(5,5,15,0.93);display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.addEventListener('click', _ckConsentClick);
    overlay.addEventListener('input', _ckConsentInput);
    document.body.appendChild(overlay);
  }

  var busy = _ckC.busy;
  var done = !c.required || c.verified;
  var inp = 'width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);color:#fff;font-size:0.88rem;';
  var lbl = 'display:block;font-size:0.78rem;font-weight:600;color:#e2e8f0;margin:10px 0 5px;';
  var card = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:14px;padding:14px;margin-bottom:12px;';
  var btn = 'background:#7c3aed;color:#fff;border:none;border-radius:9px;padding:10px 14px;font-weight:700;font-size:0.86rem;cursor:pointer;';

  var msg = _ckC.msg
    ? '<div style="margin-bottom:12px;padding:10px 12px;border-radius:9px;font-size:0.82rem;color:#fff;background:' +
      (_ckC.msg.kind === 'error' ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.16)') + '">' + _ckEsc(_ckC.msg.text) + '</div>'
    : '';

  var body;
  if (done) {
    body = '<div style="text-align:center;padding:10px 0">' +
      '<div style="font-size:2.6rem">\u2705</div>' +
      '<div style="font-size:1.2rem;font-weight:800;color:#fff;margin:6px 0">' + (c.required ? 'Parent verified' : 'All set') + '</div>' +
      '<div style="font-size:0.85rem;color:#94a3b8;margin-bottom:14px">' + (c.required
        ? 'Thank you. Your parent or guardian is verified. You can use CodingKida without any limit.'
        : 'No parent verification is needed for your age.') + '</div>' +
      '<button data-act="close" style="' + btn + '">Continue</button></div>';
  } else {
    var banner = c.blocked
      ? '<div style="margin-bottom:12px;padding:10px 12px;border-radius:9px;font-size:0.82rem;color:#fff;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4)">' +
        'Finish this to keep using CodingKida. Your learning is on hold until your parent is verified.</div>'
      : (c.daysLeft != null
        ? '<div style="margin-bottom:12px;padding:10px 12px;border-radius:9px;font-size:0.82rem;color:#fff;background:rgba(245,158,11,0.13);border:1px solid rgba(245,158,11,0.4)">' +
          (c.daysLeft <= 1 ? 'Last day to finish this.' : c.daysLeft + ' days left to finish this.') + '</div>'
        : '');

    var emailBlock = c.emailVerified
      ? '<div style="color:#4ade80;font-weight:700;font-size:0.88rem">Verified (' + _ckEsc(c.parentEmailMasked || '') + ')</div>'
      : '<div style="font-size:0.82rem;color:#94a3b8;margin-bottom:8px">We email a 6-digit code to ' + _ckEsc(c.parentEmailMasked || 'your parent') +
        '. Your parent reads it out and you type it here.</div>' +
        (_ckC.emailSent
          ? '<div style="display:flex;gap:8px;margin-bottom:6px"><input id="ck-c-ecode" maxlength="6" inputmode="numeric" placeholder="6-digit code" style="' + inp + 'letter-spacing:4px;text-align:center"/>' +
            '<button data-act="emailConfirm" style="' + btn + '"' + (busy ? ' disabled' : '') + '>' + (busy === 'emailConfirm' ? '\u2026' : 'Confirm') + '</button></div>' +
            '<div style="font-size:0.74rem;color:#94a3b8;margin-bottom:6px">Sent to ' + _ckEsc(_ckC.emailTo) + '. Check the spam folder too.</div>'
          : '') +
        '<button data-act="emailSend" style="' + btn + 'width:100%"' + (busy ? ' disabled' : '') + '>' +
        (busy === 'emailSend' ? 'Sending\u2026' : _ckC.emailSent ? 'Send a new code' : 'Send code to parent email') + '</button>';

    var phoneBlock;
    if (!c.phoneRequired) {
      phoneBlock = '<div style="font-size:0.82rem;color:#94a3b8">Phone verification on WhatsApp will start soon. For now, only the parent email is checked. Please keep the phone number above correct.</div>';
    } else if (c.phoneVerified) {
      phoneBlock = '<div style="color:#4ade80;font-weight:700;font-size:0.88rem">Verified (\u2022\u2022\u2022\u2022 ' + _ckEsc(c.parentPhoneLast4 || '') + ')</div>';
    } else {
      phoneBlock = '<div style="font-size:0.82rem;color:#94a3b8;margin-bottom:8px">We send a 6-digit code to your parent\u2019s WhatsApp. Your parent reads it out and you type it here.</div>' +
        (_ckC.phoneSent
          ? '<div style="display:flex;gap:8px;margin-bottom:6px"><input id="ck-c-pcode" maxlength="6" inputmode="numeric" placeholder="6-digit code" style="' + inp + 'letter-spacing:4px;text-align:center"/>' +
            '<button data-act="phoneConfirm" style="' + btn + '"' + (busy ? ' disabled' : '') + '>' + (busy === 'phoneConfirm' ? '\u2026' : 'Confirm') + '</button></div>'
          : '') +
        (_ckC.devCode ? '<div style="font-size:0.74rem;color:#fbbf24;margin-bottom:6px">Test mode: your code is ' + _ckEsc(_ckC.devCode) + '</div>' : '') +
        '<button data-act="phoneSend" style="' + btn + 'width:100%"' + (busy ? ' disabled' : '') + '>' +
        (busy === 'phoneSend' ? 'Sending\u2026' : _ckC.phoneSent ? 'Send a new code' : 'Send code to parent\u2019s WhatsApp') + '</button>';
    }

    body =
      '<div style="font-size:1.25rem;font-weight:800;color:#fff;margin-bottom:4px">Parent verification</div>' +
      '<div style="font-size:0.84rem;color:#94a3b8;margin-bottom:14px">CodingKida is made for students, and anyone under 18 needs a parent or guardian to confirm. It takes about two minutes.</div>' +
      banner + msg +
      '<div style="' + card + '"><div style="font-weight:800;color:#fff;margin-bottom:2px">1. Your details</div>' +
      '<label style="' + lbl + '">Your date of birth</label><input id="ck-c-dob" type="date" value="' + _ckEsc(_ckC.dob) + '" style="' + inp + '"/>' +
      '<label style="' + lbl + '">Parent or guardian name</label><input id="ck-c-pname" type="text" value="' + _ckEsc(_ckC.parentName) + '" placeholder="Full name" style="' + inp + '"/>' +
      '<label style="' + lbl + '">Parent email</label><input id="ck-c-pemail" type="email" value="' + _ckEsc(_ckC.parentEmail) + '" placeholder="parent@example.com" style="' + inp + '"/>' +
      '<label style="' + lbl + '">Parent phone (WhatsApp)</label><input id="ck-c-pphone" type="tel" value="' + _ckEsc(_ckC.parentPhone) + '" placeholder="10-digit mobile number" style="' + inp + '"/>' +
      '<button id="ck-c-save" data-act="save" style="' + btn + 'width:100%;margin-top:12px;display:' + (_ckConsentDirty() ? 'block' : 'none') + '"' + (busy ? ' disabled' : '') + '>' +
      (busy === 'save' ? 'Saving\u2026' : 'Save details') + '</button></div>' +
      '<div style="' + card + '"><div style="font-weight:800;color:#fff;margin-bottom:8px">2. Parent email ' + (c.emailVerified ? '\u2705' : '') + '</div>' + emailBlock + '</div>' +
      '<div style="' + card + '"><div style="font-weight:800;color:#fff;margin-bottom:8px">3. Parent phone ' + (c.phoneRequired && c.phoneVerified ? '\u2705' : '') + '</div>' + phoneBlock + '</div>' +
      '<div style="text-align:center">' +
      (_ckC.blocking ? '' : '<a data-act="close" style="color:#a78bfa;cursor:pointer;font-weight:600;font-size:0.88rem;margin:0 12px">Do this later</a>') +
      '<a data-act="logout" style="color:#64748b;cursor:pointer;font-size:0.85rem;margin:0 12px">Sign out</a></div>';
  }

  overlay.innerHTML = '<div style="width:100%;max-width:520px;max-height:92vh;overflow-y:auto;background:linear-gradient(135deg,#1a1a2e,#141428);' +
    'border:1px solid rgba(124,58,237,0.35);border-radius:20px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,0.6)">' + body + '</div>';
}

/** Typing updates the working copy only (no re-render, so the cursor stays put). */
function _ckConsentInput(e) {
  if (!_ckC) return;
  var id = e.target && e.target.id;
  if (id === 'ck-c-dob') _ckC.dob = e.target.value;
  else if (id === 'ck-c-pname') _ckC.parentName = e.target.value;
  else if (id === 'ck-c-pemail') _ckC.parentEmail = e.target.value;
  else if (id === 'ck-c-pphone') _ckC.parentPhone = e.target.value;
  else if (id === 'ck-c-ecode' || id === 'ck-c-pcode') { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); return; }
  else return;
  var save = document.getElementById('ck-c-save');
  if (save) save.style.display = _ckConsentDirty() ? 'block' : 'none';
}

function _ckSetMsg(text, kind) { _ckC.msg = text ? { text: text, kind: kind || 'error' } : null; }

async function _ckReloadConsent(refill) {
  var c = (await ConsentAPI.get()).consent;
  _ckC.c = c;
  if (refill) _ckFillForm(c);
}

async function _ckSaveDetails() {
  var problem = ckValidateDob(_ckC.dob);
  if (problem) { _ckSetMsg(problem); return false; }
  var adult = ckAgeFromDob(_ckC.dob) >= 18;
  if (!adult) {
    if (ckValidateEmail(_ckC.parentEmail)) { _ckSetMsg("Enter your parent or guardian's email address."); return false; }
    if (_ckC.parentPhone.replace(/\D/g, '').length < 10) { _ckSetMsg("Enter your parent or guardian's 10-digit phone number."); return false; }
  }
  var payload = { studentDob: _ckC.dob.trim() };
  if (!adult) {
    payload.parentName = _ckC.parentName.trim();
    payload.parentEmail = _ckC.parentEmail.trim();
    payload.parentContact = _ckC.parentPhone.trim();
  }
  _ckC.busy = 'save'; _ckRenderConsent();
  try {
    await StudentAPI.updateProfile(payload);
    await _ckReloadConsent(true);
    _ckSetMsg('');
    return true;
  } catch (e) {
    _ckSetMsg(e.message || 'Could not save. Please try again.');
    return false;
  } finally {
    _ckC.busy = '';
  }
}

async function _ckConsentClick(e) {
  var t = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!t || !_ckC || _ckC.busy) return;
  var act = t.getAttribute('data-act');
  try {
    if (act === 'close') { document.getElementById('ck-consent-overlay').remove(); _ckC = null; return; }
    if (act === 'logout') { document.getElementById('ck-consent-overlay').remove(); _ckC = null; if (typeof logout === 'function') logout(); return; }

    if (act === 'save') { await _ckSaveDetails(); _ckRenderConsent(); return; }

    if (act === 'emailSend' || act === 'phoneSend') {
      if (_ckConsentDirty() && !(await _ckSaveDetails())) { _ckRenderConsent(); return; }
      _ckC.busy = act; _ckRenderConsent();
      try {
        if (act === 'emailSend') {
          var r = await ConsentAPI.sendEmailCode();
          _ckC.emailSent = true; _ckC.emailTo = r.sentTo || '';
          _ckSetMsg('We emailed a 6-digit code to ' + (r.sentTo || 'your parent') + '. Ask your parent to read it out to you.', 'ok');
        } else {
          var p = await ConsentAPI.sendPhoneCode();
          _ckC.phoneSent = true; _ckC.devCode = p.devCode || null;
          _ckSetMsg(p.testMode ? 'Test mode: no WhatsApp message was sent. The code is shown on screen.'
            : 'We sent a 6-digit code to your parent\u2019s WhatsApp (' + p.sentTo + '). Ask them to read it out to you.', 'ok');
        }
      } catch (err) { _ckSetMsg(err.message || 'Could not send the code. Please try again.'); }
      _ckC.busy = ''; _ckRenderConsent();
      return;
    }

    if (act === 'emailConfirm' || act === 'phoneConfirm') {
      var box = document.getElementById(act === 'emailConfirm' ? 'ck-c-ecode' : 'ck-c-pcode');
      var code = box ? box.value.trim() : '';
      if (!/^\d{6}$/.test(code)) { _ckSetMsg('Enter the 6-digit code.'); _ckRenderConsent(); return; }
      _ckC.busy = act; _ckRenderConsent();
      try {
        if (act === 'emailConfirm') { await ConsentAPI.confirmEmailCode(code); _ckC.emailSent = false; }
        else { await ConsentAPI.confirmPhoneCode(code); _ckC.phoneSent = false; _ckC.devCode = null; }
        await _ckReloadConsent(false);
        _ckSetMsg('');
      } catch (err) { _ckSetMsg(err.message || 'Code not accepted. Please try again.'); }
      _ckC.busy = ''; _ckRenderConsent();
      return;
    }
  } catch (err) {
    if (_ckC) { _ckC.busy = ''; _ckSetMsg(err.message || 'Something went wrong.'); _ckRenderConsent(); }
  }
}
