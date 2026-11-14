/**
 * Final Course Test + Certificate (desktop).
 *
 * - renderFinalTestCard(course, container): card after the last module on the
 *   course detail page (start / resume / locked / cooldown / certificate).
 * - Full-screen test overlay: 50 server-graded MCQs, server-synced timer,
 *   question palette, prev/next, submit (auto-submit at 0:00). Picked answers
 *   are saved locally per attempt so the test can be resumed.
 * - Result + review (correct answers shown only when passed), confirm the
 *   certificate name, then view the certificate INSIDE the app (PDF.js canvas,
 *   no download/print). A copy is kept in this app's storage for offline view.
 *
 * Uses: BASE_URL, sanitize(), _openPdfDataInCanvas() (pdf-viewer.js).
 */
(function () {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var _ft = null; // { courseId, attemptId, questions, answers, endsAt, offset, timer, idx }

  function token() { return localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || ''; }
  function esc(s) { return (typeof sanitize === 'function') ? sanitize(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } }
  function fmtClock(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

  function api(method, path, body) {
    var opts = { method: method, headers: { 'Authorization': 'Bearer ' + token() } };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(BASE_URL + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || d.success === false) throw new Error(d.message || ('Request failed (' + r.status + ')'));
        return d;
      });
    });
  }

  function ensureStyles() {
    if (document.getElementById('ft-styles')) return;
    var st = document.createElement('style');
    st.id = 'ft-styles';
    st.textContent =
      '.ft-card{margin-top:14px;padding:18px 20px;border-radius:14px;background:rgba(108,71,255,.10);border:1px solid rgba(108,71,255,.35)}' +
      '.ft-card-head{display:flex;align-items:center;gap:14px}.ft-card-icon{font-size:2rem}' +
      '.ft-label{font-size:.72rem;font-weight:800;color:#a78bfa;letter-spacing:.5px}.ft-title{font-size:1rem;font-weight:700;color:#fff;margin-top:2px}' +
      '.ft-badge{margin-left:auto;font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.06);color:var(--muted)}' +
      '.ft-badge.ok{background:rgba(34,197,94,.15);color:#22c55e}' +
      '.ft-meta{font-size:.8rem;color:var(--muted);margin:10px 0 12px}.ft-lock{font-size:.85rem;color:#f59e0b}' +
      '.ft-btn{background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:10px;padding:10px 18px;color:#fff;font-weight:700;font-size:.85rem;cursor:pointer}' +
      '.ft-btn:disabled{opacity:.5;cursor:default}.ft-btn.ghost{background:transparent;border:1px solid #a78bfa;color:#a78bfa}.ft-btn.green{background:#22c55e}' +
      '.ft-btns{display:flex;gap:10px;flex-wrap:wrap}' +
      '#ft-overlay{position:fixed;inset:0;background:rgba(10,8,20,.97);z-index:9998;display:none;flex-direction:column;align-items:center}' +
      '#ft-overlay .ft-wrap{width:100%;max-width:820px;height:100%;display:flex;flex-direction:column;padding:0 18px}' +
      '.ft-top{display:flex;align-items:center;gap:14px;padding:16px 0;flex-shrink:0}.ft-top .ft-h{flex:1;color:#fff;font-weight:800;font-size:1.05rem}' +
      '.ft-timer{font-weight:800;font-variant-numeric:tabular-nums;padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.08);color:#e2e8f0}.ft-timer.low{background:#ef4444;color:#fff}' +
      '.ft-x{background:rgba(239,68,68,.18);border:1px solid rgba(239,68,68,.4);color:#f87171;cursor:pointer;padding:7px 14px;border-radius:10px;font-weight:700}' +
      '.ft-bar{height:4px;background:rgba(255,255,255,.08);border-radius:2px;flex-shrink:0}.ft-bar i{display:block;height:4px;background:#6c47ff;border-radius:2px}' +
      '.ft-body{flex:1;overflow-y:auto;padding:18px 0 30px}' +
      '.ft-q{color:#fff;font-size:1.08rem;font-weight:700;line-height:1.55;margin-bottom:16px;white-space:pre-wrap}' +
      '.ft-opt{display:flex;align-items:center;gap:12px;padding:13px 14px;margin-bottom:10px;border-radius:12px;background:#16213e;border:1.5px solid rgba(255,255,255,.08);cursor:pointer;color:#e2e8f0}' +
      '.ft-opt:hover{border-color:rgba(108,71,255,.6)}.ft-opt.on{border-color:#6c47ff;background:rgba(108,71,255,.15)}' +
      '.ft-letter{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);font-weight:800;flex-shrink:0}.ft-opt.on .ft-letter{background:#6c47ff;color:#fff}' +
      '.ft-palette{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}.ft-dot{width:36px;height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:.8rem;font-weight:700;cursor:pointer}' +
      '.ft-dot.done{background:rgba(108,71,255,.35);border-color:#6c47ff}.ft-dot.cur{outline:2px solid #fff}' +
      '.ft-nav{display:flex;gap:10px;padding:14px 0;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0}.ft-nav button{flex:1}' +
      '.ft-center{text-align:center;color:#e2e8f0}.ft-big{font-size:3rem}.ft-score{font-size:3.4rem;font-weight:900}' +
      '.ft-rules{background:#1a1a2e;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px 18px;margin:18px auto;max-width:520px;text-align:left;line-height:1.9;color:#e2e8f0}' +
      '.ft-rev{border-radius:10px;padding:12px 14px;margin-bottom:8px;border:1px solid;text-align:left}.ft-rev.ok{background:rgba(34,197,94,.05);border-color:rgba(34,197,94,.2)}.ft-rev.bad{background:rgba(239,68,68,.05);border-color:rgba(239,68,68,.2)}' +
      '.ft-rev b{color:#fff}.ft-rev div{font-size:.85rem;margin-top:4px;color:#cbd5e1}' +
      '.ft-attempt{display:flex;align-items:center;gap:12px;padding:11px 14px;margin-bottom:8px;border-radius:12px;background:#16213e;border:1px solid rgba(255,255,255,.08);cursor:pointer}.ft-attempt:hover{border-color:rgba(108,71,255,.6)}' +
      '.ft-cert-act{background:rgba(255,255,255,.1);border:none;color:#fff;cursor:pointer;padding:5px 11px;border-radius:7px;font-size:.78rem;font-weight:700;margin-right:6px}.ft-cert-act:hover{background:rgba(255,255,255,.2)}.ft-cert-act.wa{background:#25D366}.ft-cert-act.ok{background:rgba(34,197,94,.25);color:#22c55e;cursor:default}' +
      '.ft-dl-card{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:8px;border-radius:12px;background:#16213e;border:1px solid rgba(255,255,255,.08)}' +
      '.ft-dl-ico{width:40px;height:40px;border-radius:10px;background:rgba(251,191,36,.15);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}' +
      '.ft-name{width:100%;max-width:420px;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:#16213e;color:#fff;font-size:1.05rem;text-align:center;outline:none;margin:14px 0}';
    document.head.appendChild(st);
  }

  function overlay() {
    ensureStyles();
    var el = document.getElementById('ft-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ft-overlay';
      el.innerHTML = '<div class="ft-wrap" id="ft-wrap"></div>';
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    return document.getElementById('ft-wrap');
  }
  function closeOverlay() {
    if (_ft && _ft.timer) clearInterval(_ft.timer);
    var el = document.getElementById('ft-overlay');
    if (el) el.style.display = 'none';
    if (_ft && _ft.courseId) refreshCard(_ft.courseId);
  }

  // ── Course page card ─────────────────────────────────────────────────────
  var _cardCourse = null;
  window.renderFinalTestCard = function (course, container) {
    if (!course || !course.isEnrolled || !container || !token()) return;
    ensureStyles();
    _cardCourse = course;
    var card = document.getElementById('ft-card');
    if (card) card.remove();
    card = document.createElement('div');
    card.id = 'ft-card';
    card.className = 'ft-card';
    card.style.display = 'none';
    container.appendChild(card);
    refreshCard(course.id);
  };

  function refreshCard(courseId) {
    var card = document.getElementById('ft-card');
    if (!card) return;
    api('GET', '/api/final-test?courseId=' + encodeURIComponent(courseId)).then(function (s) {
      if (!s.available) { card.style.display = 'none'; return; }
      card.style.display = 'block';
      var badge = s.certificate ? '<span class="ft-badge ok">Passed</span>' : (!s.unlocked ? '<span class="ft-badge">🔒 Locked</span>' : '');
      var meta = s.totalQuestions + ' MCQs · ' + s.timeLimitMin + ' min · pass ' + s.passPercent + '%' + (s.bestPercent !== null ? ' · best ' + s.bestPercent + '%' : '');
      var action;
      if (s.certificate) {
        action = '<div class="ft-btns"><button class="ft-btn" data-ft="cert" data-code="' + esc(s.certificate.code) + '">📜 View Certificate</button>' +
          '<button class="ft-btn ghost" data-ft="open">Practice</button></div>';
      } else if (s.pendingCertificate) {
        action = '<button class="ft-btn" data-ft="claim">🎉 Passed — Get Certificate</button>';
      } else if (!s.unlocked) {
        action = '<div class="ft-lock">Complete all lessons to unlock (' + s.completedLessons + '/' + s.totalLessons + ' done)</div>';
      } else if (s.nextAttemptAt && !s.inProgress) {
        action = '<div class="ft-lock">Retake available after ' + esc(fmtDate(s.nextAttemptAt)) + '</div>';
      } else {
        action = '<button class="ft-btn" data-ft="open">' + (s.inProgress ? '▶ Resume Test' : '▶ Start Final Test') + '</button>';
      }
      card.innerHTML =
        '<div class="ft-card-head"><span class="ft-card-icon">🎓</span><div><div class="ft-label">FINAL TEST</div><div class="ft-title">Course Certificate Test</div></div>' + badge + '</div>' +
        '<div class="ft-meta">' + esc(meta) + '</div>' + action;
      card.onclick = function (e) {
        var b = e.target.closest('[data-ft]');
        if (!b) return;
        var k = b.getAttribute('data-ft');
        if (k === 'cert') viewCertificate(b.getAttribute('data-code'), { courseTitle: s.courseTitle, percent: s.certificate && s.certificate.percent });
        else if (k === 'open') openIntro(courseId);
        else if (k === 'claim') showClaim(courseId, s.pendingCertificate.attemptId, s.pendingCertificate.suggestedName);
      };
    }).catch(function () { card.style.display = 'none'; });
  }

  // ── Intro ────────────────────────────────────────────────────────────────
  function openIntro(courseId) {
    var w = overlay();
    w.innerHTML = '<div class="ft-body ft-center"><p style="color:var(--muted)">Loading…</p></div>';
    api('GET', '/api/final-test?courseId=' + encodeURIComponent(courseId)).then(function (s) {
      var cooling = s.nextAttemptAt && !s.inProgress;
      var btn = !s.unlocked
        ? '<div class="ft-lock">🔒 Complete all lessons to unlock (' + s.completedLessons + '/' + s.totalLessons + ' done).</div>'
        : cooling ? '<div class="ft-lock">⏳ You can retake the test after ' + esc(fmtDate(s.nextAttemptAt)) + '.</div>'
        : '<button class="ft-btn" id="ft-start" style="padding:13px 30px;font-size:1rem">' + (s.inProgress ? '▶ Resume Test' : s.passed ? '🔁 Practice Again' : '▶ Start Final Test') + '</button>';
      var attemptsHtml = '';
      if (s.attempts && s.attempts.length) {
        attemptsHtml = '<div style="max-width:520px;margin:6px auto 16px;text-align:left"><div class="ft-label" style="margin-bottom:8px">MY ATTEMPTS · CLICK TO REVIEW ANSWERS</div>' +
          s.attempts.map(function (a, i) {
            return '<div class="ft-attempt" data-attempt="' + esc(a.attemptId) + '"><div style="flex:1"><div style="color:#fff;font-weight:700">Attempt ' + (s.attempts.length - i) + ' · ' + a.percent + '%</div>' +
              '<div style="color:var(--muted);font-size:.78rem">' + a.score + '/' + a.total + ' correct · ' + esc(fmtDate(a.submittedAt)) + '</div></div>' +
              '<span style="font-weight:800;font-size:.78rem;color:' + (a.passed ? '#22c55e' : '#f59e0b') + '">' + (a.passed ? '✅ Passed' : 'Not passed') + '</span><span style="color:var(--muted)">›</span></div>';
          }).join('') + '</div>';
      }
      w.innerHTML =
        '<div class="ft-top"><span class="ft-h">🎓 Final Test</span><button class="ft-x" id="ft-close"><i class="fas fa-times"></i> Close</button></div>' +
        '<div class="ft-body ft-center"><div class="ft-big">🎓</div>' +
        '<h2 style="color:#fff;margin:6px 0 4px">' + esc(s.courseTitle) + '</h2>' +
        '<div style="color:#a78bfa;font-weight:700;font-size:.8rem;letter-spacing:.5px">FINAL COURSE TEST</div>' +
        '<div class="ft-rules">❓ ' + s.totalQuestions + ' multiple-choice questions from every lesson<br>⏱ ' + s.timeLimitMin +
        ' minutes — submitted automatically when time ends<br>🎯 Score ' + s.passPercent + '% or more to pass and earn your certificate<br>🔁 Failed? You can retake it after 24 hours</div>' +
        (s.bestPercent !== null ? '<p style="color:var(--muted)">Attempts: ' + s.attemptsCount + ' · Best score: ' + s.bestPercent + '%</p>' : '') +
        attemptsHtml + btn + '</div>';
      document.getElementById('ft-close').onclick = closeOverlay;
      w.querySelectorAll('[data-attempt]').forEach(function (el) {
        el.onclick = function () { openReview(courseId, el.getAttribute('data-attempt'), s.courseTitle); };
      });
      var sb = document.getElementById('ft-start');
      if (sb) sb.onclick = function () { sb.disabled = true; startTest(courseId); };
    }).catch(function (e) {
      w.innerHTML = '<div class="ft-body ft-center"><p class="ft-lock">' + esc(e.message) + '</p><button class="ft-btn" id="ft-close">Close</button></div>';
      document.getElementById('ft-close').onclick = closeOverlay;
    });
  }

  // ── Test ─────────────────────────────────────────────────────────────────
  function startTest(courseId) {
    api('POST', '/api/final-test/start', { courseId: courseId }).then(function (t) {
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem('ck_final_answers_' + t.attemptId) || '{}') || {}; } catch (e) {}
      _ft = {
        courseId: courseId, attemptId: t.attemptId, questions: t.questions, answers: saved,
        endsAt: new Date(t.endsAt).getTime(), offset: new Date(t.serverNow).getTime() - Date.now(),
        idx: 0, submitted: false, timer: null, title: t.courseTitle,
      };
      renderQuestion();
      _ft.timer = setInterval(tickTimer, 1000);
      tickTimer();
    }).catch(function (e) { alert(e.message); openIntro(courseId); });
  }

  function tickTimer() {
    if (!_ft) return;
    var left = (_ft.endsAt - (Date.now() + _ft.offset)) / 1000;
    var el = document.getElementById('ft-timer');
    if (el) { el.textContent = '⏱ ' + fmtClock(left); el.classList.toggle('low', left < 300); }
    if (left <= 0) submitTest(true);
  }

  function renderQuestion() {
    var w = overlay();
    var q = _ft.questions[_ft.idx];
    var n = _ft.questions.length;
    var answered = Object.keys(_ft.answers).length;
    var opts = q.options.map(function (o, i) {
      return '<div class="ft-opt' + (_ft.answers[q.id] === i ? ' on' : '') + '" data-opt="' + i + '" role="radio" aria-checked="' + (_ft.answers[q.id] === i) + '" tabindex="0">' +
        '<span class="ft-letter">' + (LETTERS[i] || i + 1) + '</span><span>' + esc(o) + '</span></div>';
    }).join('');
    var dots = _ft.questions.map(function (qq, i) {
      return '<button class="ft-dot' + (_ft.answers[qq.id] !== undefined ? ' done' : '') + (i === _ft.idx ? ' cur' : '') + '" data-dot="' + i + '">' + (i + 1) + '</button>';
    }).join('');
    w.innerHTML =
      '<div class="ft-top"><span class="ft-h">Question ' + (_ft.idx + 1) + '/' + n + '</span>' +
      '<span class="ft-timer" id="ft-timer">⏱ --:--</span><button class="ft-x" id="ft-leave">Leave</button></div>' +
      '<div class="ft-bar"><i style="width:' + (answered / n * 100) + '%"></i></div>' +
      '<div class="ft-body"><div class="ft-q">' + esc(q.question) + '</div>' + opts +
      '<div style="color:var(--muted);font-size:.8rem;margin-top:16px">' + answered + '/' + n + ' answered — jump to any question:</div>' +
      '<div class="ft-palette">' + dots + '</div></div>' +
      '<div class="ft-nav"><button class="ft-btn ghost" id="ft-prev"' + (_ft.idx === 0 ? ' disabled' : '') + '>‹ Prev</button>' +
      (_ft.idx < n - 1 ? '<button class="ft-btn" id="ft-next">Next ›</button>' : '<button class="ft-btn green" id="ft-submit">✓ Submit</button>') + '</div>';
    tickTimer();
    w.querySelectorAll('[data-opt]').forEach(function (el) {
      el.onclick = function () {
        _ft.answers[q.id] = Number(el.getAttribute('data-opt'));
        try { localStorage.setItem('ck_final_answers_' + _ft.attemptId, JSON.stringify(_ft.answers)); } catch (e) {}
        renderQuestion();
      };
    });
    w.querySelectorAll('[data-dot]').forEach(function (el) { el.onclick = function () { _ft.idx = Number(el.getAttribute('data-dot')); renderQuestion(); }; });
    document.getElementById('ft-prev').onclick = function () { if (_ft.idx > 0) { _ft.idx--; renderQuestion(); } };
    var nx = document.getElementById('ft-next');
    if (nx) nx.onclick = function () { _ft.idx++; renderQuestion(); };
    var sb = document.getElementById('ft-submit');
    if (sb) sb.onclick = function () {
      var un = n - Object.keys(_ft.answers).length;
      if (confirm(un > 0 ? 'You have ' + un + ' unanswered question(s). Submit anyway?' : 'Submit your answers now?')) submitTest(false);
    };
    document.getElementById('ft-leave').onclick = function () {
      if (confirm('Leave the test? Your answers are saved and the timer keeps running. You can resume from the course page.')) closeOverlay();
    };
  }

  function submitTest(auto) {
    if (!_ft || _ft.submitted) return;
    _ft.submitted = true;
    if (_ft.timer) clearInterval(_ft.timer);
    var w = overlay();
    w.innerHTML = '<div class="ft-body ft-center" style="padding-top:120px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#a78bfa"></i><p style="color:var(--muted)">Checking your answers…</p></div>';
    api('POST', '/api/final-test/submit', { attemptId: _ft.attemptId, answers: _ft.answers }).then(function (r) {
      try { localStorage.removeItem('ck_final_answers_' + _ft.attemptId); } catch (e) {}
      renderResult(r, auto);
    }).catch(function (e) {
      _ft.submitted = false;
      alert('Submit failed: ' + e.message + '\nYour answers are saved — try again.');
      renderQuestion();
      _ft.timer = setInterval(tickTimer, 1000);
    });
  }

  // ── Result ───────────────────────────────────────────────────────────────
  function reviewHtml(items) {
    return items.map(function (it, i) {
      var yours = it.selected !== null && it.selected !== undefined ? LETTERS[it.selected] + '. ' + esc(it.options[it.selected] || '') : 'Not answered';
      return '<div class="ft-rev ' + (it.correct ? 'ok' : 'bad') + '"><b>' + (it.correct ? '✅' : '❌') + ' ' + (i + 1) + '. ' + esc(it.question) + '</b>' +
        '<div>Your answer: ' + yours + '</div>' +
        (it.answer !== null && !it.correct ? '<div style="color:#22c55e">Correct: ' + LETTERS[it.answer] + '. ' + esc(it.options[it.answer] || '') + '</div>' : '') +
        (it.explanation && !it.correct ? '<div style="color:var(--muted)">' + esc(it.explanation) + '</div>' : '') + '</div>';
    }).join('');
  }

  // ── Review of a past attempt (works after the app was closed and reopened) ──
  function openReview(courseId, attemptId, courseTitle) {
    var w = overlay();
    w.innerHTML = '<div class="ft-body ft-center" style="padding-top:120px"><i class="fas fa-spinner fa-spin" style="font-size:2rem;color:#a78bfa"></i></div>';
    api('GET', '/api/final-test/review?attemptId=' + encodeURIComponent(attemptId)).then(function (d) {
      w.innerHTML =
        '<div class="ft-top"><span class="ft-h">Attempt review</span><button class="ft-x" id="ft-back"><i class="fas fa-arrow-left"></i> Back</button></div>' +
        '<div class="ft-body"><div class="ft-center"><div class="ft-score" style="color:' + (d.passed ? '#22c55e' : '#f59e0b') + '">' + d.percent + '%</div>' +
        '<h2 style="color:#fff;margin:4px 0">' + (d.passed ? 'Passed' : 'Not passed') + '</h2>' +
        '<p style="color:var(--muted)">' + d.score + '/' + d.total + ' correct · ' + esc(fmtDate(d.submittedAt)) + '</p></div>' +
        '<h3 style="color:#a78bfa;font-size:.85rem;margin:20px 0 10px;text-transform:uppercase">Review</h3>' + reviewHtml(d.review) +
        (!d.answersRevealed ? '<p style="color:var(--muted);text-align:center">Correct answers are shown once you pass the test.</p>' : '') + '</div>';
      document.getElementById('ft-back').onclick = function () { openIntro(courseId); };
    }).catch(function (e) {
      alert('Could not load this attempt: ' + e.message);
      openIntro(courseId);
    });
  }

  function renderResult(r, auto) {
    var w = overlay();
    var rev = reviewHtml(r.review);
    var action = r.passed
      ? (r.certificate ? '<button class="ft-btn" id="ft-view" data-code="' + esc(r.certificate.code) + '">📜 View Certificate</button>'
        : r.needsCertificate ? '<button class="ft-btn" id="ft-claim">🎓 Get Your Certificate</button>' : '')
      : '<p class="ft-lock">Revise the lessons you missed and try again' + (r.nextAttemptAt ? ' after ' + esc(fmtDate(r.nextAttemptAt)) : '') + '.</p>';
    w.innerHTML =
      '<div class="ft-top"><span class="ft-h">Result</span><button class="ft-x" id="ft-close"><i class="fas fa-times"></i> Close</button></div>' +
      '<div class="ft-body"><div class="ft-center"><div class="ft-big">' + (r.passed ? '🎉' : '💪') + '</div>' +
      '<div class="ft-score" style="color:' + (r.passed ? '#22c55e' : '#f59e0b') + '">' + r.percent + '%</div>' +
      '<h2 style="color:#fff;margin:4px 0">' + (r.passed ? 'You passed!' : 'Not passed yet') + '</h2>' +
      '<p style="color:var(--muted)">' + r.score + '/' + r.total + ' correct · pass mark ' + r.passPercent + '%' +
      (r.late ? '<br>Submitted after the time limit — answers were not counted.' : '') + (auto ? '<br>Time was up — submitted automatically.' : '') + '</p>' +
      action + '</div>' +
      '<h3 style="color:#a78bfa;font-size:.85rem;margin:24px 0 10px;text-transform:uppercase">Review</h3>' + rev +
      (!r.passed ? '<p style="color:var(--muted);text-align:center">Correct answers are shown once you pass.</p>' : '') + '</div>';
    document.getElementById('ft-close').onclick = closeOverlay;
    var v = document.getElementById('ft-view');
    if (v) v.onclick = function () { viewCertificate(v.getAttribute('data-code'), { courseTitle: _ft && _ft.title, percent: r.percent }); };
    var c = document.getElementById('ft-claim');
    if (c) c.onclick = function () { showClaim(_ft.courseId, _ft.attemptId, r.suggestedName || ''); };
  }

  // ── Confirm name + issue certificate ─────────────────────────────────────
  function showClaim(courseId, attemptId, suggested) {
    if (!_ft) _ft = { courseId: courseId, attemptId: attemptId };
    var w = overlay();
    w.innerHTML =
      '<div class="ft-top"><span class="ft-h">Your Certificate</span><button class="ft-x" id="ft-close"><i class="fas fa-times"></i> Close</button></div>' +
      '<div class="ft-body ft-center"><div class="ft-big">📜</div><h2 style="color:#fff">Name on your certificate</h2>' +
      '<p style="color:var(--muted)">Check the spelling — the certificate can’t be edited after it is issued.</p>' +
      '<input class="ft-name" id="ft-name" maxlength="60" placeholder="Full name" value="' + esc(suggested || '') + '"/><br>' +
      '<button class="ft-btn" id="ft-issue" style="padding:12px 28px">Get Certificate</button></div>';
    document.getElementById('ft-close').onclick = closeOverlay;
    document.getElementById('ft-issue').onclick = function () {
      var btn = this;
      var name = document.getElementById('ft-name').value.replace(/\s+/g, ' ').trim();
      if (!/^[A-Za-z][A-Za-z .'-]{1,59}$/.test(name)) { alert("Use English letters only (spaces, . ' - allowed), 2–60 characters."); return; }
      if (!confirm('Your certificate will show:\n\n' + name + '\n\nThis cannot be changed later. Continue?')) return;
      btn.disabled = true;
      api('POST', '/api/certificates', { attemptId: attemptId, name: name }).then(function (d) {
        refreshCard(courseId);
        viewCertificate(d.certificate.code, { courseTitle: d.certificate.courseTitle, percent: d.certificate.percent });
        openIntro(courseId);
      }).catch(function (e) { btn.disabled = false; alert(e.message); });
    };
  }

  // ── Certificate viewer (in-app only, offline copy in app storage) ────────
  function b64ToBytes(b64) {
    var raw = atob(b64), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function certKey(code) { return 'ck_cert_' + (typeof getCurrentUserId === 'function' ? getCurrentUserId() : 'anon') + '_' + code; }

  // ── Certificate extras: Download (Downloads → Certificates), Save PDF, WhatsApp ──
  function userKey() { return typeof getCurrentUserId === 'function' ? (getCurrentUserId() || 'anon') : 'anon'; }
  function dlListKey() { return 'ck_cert_dl_' + userKey(); }
  function getCertDownloads() { try { return JSON.parse(localStorage.getItem(dlListKey()) || '[]') || []; } catch (e) { return []; } }
  function saveCertDownloads(list) { try { localStorage.setItem(dlListKey(), JSON.stringify(list)); } catch (e) {} }
  function niceName(code, title) {
    var c = String(title || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return c ? 'CodingKida Certificate - ' + c : 'CodingKida Certificate - ' + code;
  }
  function toast(msg) {
    if (typeof _showWatchlistToast === 'function') _showWatchlistToast(msg, false); else alert(msg);
  }
  // Course name / score when the caller doesn't know them (looked up once).
  function resolveInfo(code, info) {
    if (info && info.courseTitle) return Promise.resolve(info);
    return api('GET', '/api/certificates').then(function (d) {
      var m = (d.certificates || []).filter(function (c) { return c.code === code; })[0];
      return m ? { courseTitle: m.courseTitle, percent: (info && info.percent != null) ? info.percent : m.percent } : (info || {});
    }).catch(function () { return info || {}; });
  }

  function openWhatsApp(code, info) {
    var what = info && info.courseTitle ? ' the ' + info.courseTitle + ' course' : ' a course';
    var score = info && typeof info.percent === 'number' ? ' with ' + info.percent + '%' : '';
    var text = '🎓 I just completed' + what + ' on CodingKida' + score + '!\nCertificate ID: ' + code + '\nLearn coding with me: https://www.codingkida.com';
    var url = 'https://wa.me/?text=' + encodeURIComponent(text);
    if (window.electron && window.electron.openExternal) window.electron.openExternal(url);
    else window.open(url, '_blank');
    toast('Tip: use “Save PDF” and attach the file in WhatsApp.');
  }

  function savePdfToComputer(code, info) {
    var b64 = null;
    try { b64 = localStorage.getItem(certKey(code)); } catch (e) {}
    if (!b64) { alert('Open the certificate first, then try again.'); return; }
    var blob = new Blob([b64ToBytes(b64)], { type: 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = niceName(code, info && info.courseTitle) + '.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function addToDownloads(code, info) {
    var list = getCertDownloads().filter(function (c) { return c.code !== code; });
    list.unshift({ code: code, courseTitle: info && info.courseTitle, percent: info && info.percent, savedAt: new Date().toISOString() });
    saveCertDownloads(list);
  }

  // Action buttons inside the PDF viewer's header (removed by closePdfViewer()).
  function addCertActions(code, info) {
    var titleEl = document.getElementById('pdf-viewer-title');
    if (!titleEl || !titleEl.parentElement) return;
    var old = document.getElementById('ft-cert-actions');
    if (old) old.remove();
    var right = titleEl.parentElement.lastElementChild;
    var box = document.createElement('span');
    box.id = 'ft-cert-actions';
    box.style.cssText = 'display:inline-flex;align-items:center';
    var inDl = getCertDownloads().some(function (c) { return c.code === code; });
    box.innerHTML =
      '<button class="ft-cert-act' + (inDl ? ' ok' : '') + '" data-a="dl">' + (inDl ? '✅ In Downloads' : '⬇ Download') + '</button>' +
      '<button class="ft-cert-act" data-a="save">💾 Save PDF</button>' +
      '<button class="ft-cert-act wa" data-a="wa">💬 WhatsApp</button>';
    right.insertBefore(box, right.firstChild);
    box.onclick = function (e) {
      var b = e.target.closest('[data-a]');
      if (!b) return;
      var a = b.getAttribute('data-a');
      resolveInfo(code, info).then(function (inf) {
        if (a === 'dl') {
          if (b.classList.contains('ok')) return;
          addToDownloads(code, inf);
          b.classList.add('ok'); b.textContent = '✅ In Downloads';
          toast('✅ Saved in Downloads → Certificates');
        } else if (a === 'save') savePdfToComputer(code, inf);
        else if (a === 'wa') openWhatsApp(code, inf);
      });
    };
  }

  function viewCertificate(code, info) {
    if (!code) return;
    var show = function (b64) {
      if (typeof window._openPdfDataInCanvas === 'function') {
        window._openPdfDataInCanvas(b64ToBytes(b64), 'Certificate ' + code);
        addCertActions(code, info);
      } else alert('PDF viewer not available.');
    };
    var cached = null;
    try { cached = localStorage.getItem(certKey(code)); } catch (e) {}
    if (cached) { show(cached); return; }
    api('GET', '/api/certificates/' + encodeURIComponent(code) + '?format=base64').then(function (d) {
      try { localStorage.setItem(certKey(code), d.base64); } catch (e) { /* storage full — view only */ }
      show(d.base64);
    }).catch(function (e) { alert('Could not load the certificate: ' + e.message); });
  }
  window.viewCertificate = viewCertificate;

  // ── Downloads page: "Certificates" folder ────────────────────────────────
  // Called from renderOfflineDownloads(); draws a section above the lesson downloads.
  window.renderCertificateDownloads = function () {
    var list = document.getElementById('offline-downloads-list');
    if (!list || !list.parentElement) return;
    ensureStyles();
    var box = document.getElementById('cert-downloads');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cert-downloads';
      list.parentElement.insertBefore(box, list);
    }
    var items = getCertDownloads();
    var q = ((document.getElementById('dl-search') || {}).value || '').trim().toLowerCase();

    var draw = function () {
      var shown = getCertDownloads().filter(function (c) {
        return !q || niceName(c.code, c.courseTitle).toLowerCase().indexOf(q) !== -1;
      });
      if (!shown.length) { box.innerHTML = ''; return; }
      box.innerHTML =
        '<div style="margin:0 0 18px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><span style="font-size:1.3rem">🎓</span>' +
        '<span style="color:#fff;font-weight:800;font-size:1rem">Certificates</span>' +
        '<span style="font-size:.7rem;color:var(--muted);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:10px">' + shown.length + '</span></div>' +
        shown.map(function (c) {
          return '<div class="ft-dl-card"><div class="ft-dl-ico">🏆</div><div style="flex:1;min-width:0">' +
            '<div style="color:#fff;font-weight:700;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(niceName(c.code, c.courseTitle)) + '</div>' +
            '<div style="color:var(--muted);font-size:.74rem;margin-top:2px">Certificate' + (typeof c.percent === 'number' ? ' · ' + c.percent + '%' : '') + ' · ' + esc(c.code) + '</div></div>' +
            '<button class="ft-btn" data-cert-open="' + esc(c.code) + '" style="padding:7px 14px">📖 Open</button>' +
            '<button class="ft-btn ghost" data-cert-del="' + esc(c.code) + '" style="padding:7px 12px" title="Remove from Downloads">🗑</button></div>';
        }).join('') + '</div>';
      box.onclick = function (e) {
        var o = e.target.closest('[data-cert-open]');
        var d = e.target.closest('[data-cert-del]');
        if (o) {
          var code = o.getAttribute('data-cert-open');
          var item = getCertDownloads().filter(function (x) { return x.code === code; })[0] || {};
          viewCertificate(code, { courseTitle: item.courseTitle, percent: item.percent });
        } else if (d) {
          var dc = d.getAttribute('data-cert-del');
          if (!confirm('Remove this certificate from Downloads?\n\nYour certificate is not deleted — you can download it again any time.')) return;
          saveCertDownloads(getCertDownloads().filter(function (x) { return x.code !== dc; }));
          try { localStorage.removeItem(certKey(dc)); } catch (err) {}
          draw();
        }
      };
    };
    draw();

    // Older saves may lack the course name — fill it in once.
    if (items.some(function (c) { return !c.courseTitle; })) {
      api('GET', '/api/certificates').then(function (d) {
        var all = d.certificates || [];
        var cur = getCertDownloads();
        var changed = false;
        cur.forEach(function (c) {
          if (c.courseTitle) return;
          var m = all.filter(function (x) { return x.code === c.code; })[0];
          if (m && m.courseTitle) { c.courseTitle = m.courseTitle; if (c.percent == null) c.percent = m.percent; changed = true; }
        });
        if (changed) { saveCertDownloads(cur); draw(); }
      }).catch(function () {});
    }
  };
})();
