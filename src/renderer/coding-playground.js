/**
 * CodingKida — Coding Playground Page
 * 
 * LeetCode/GFG-style coding practice interface.
 * - Left panel: Problem list (from API + user's local problems)
 * - Right panel: Monaco Editor + Run/Submit
 * 
 * Problems source:
 * - Default: fetched from /api/coding-problems (server)
 * - My Problems: stored in localStorage (per user, zero server load)
 */

// State
var _pgProblems = [];       // All problems from API
var _pgMyProblems = [];     // User's custom problems (localStorage)
var _pgActiveTab = 'all';   // 'all' | 'my'
var _pgActiveProblem = null; // Currently selected problem
var _pgEditorInstance = null; // Monaco editor for playground
var _pgBottomPanelVisible = true; // Bottom panel (input/output/history) visible

// ═══════════════════════════════════════════════════════
// INITIALIZATION — called when page navigates to 'coding'
// ═══════════════════════════════════════════════════════

function codingPgInit() {
  codingPgLoadProblems();
  codingPgLoadMyProblems();
}

/**
 * Load problems from API
 */
function codingPgLoadProblems() {
  var listEl = document.getElementById('coding-pg-list');
  if (!listEl) return;

  fetch(BASE_URL + '/api/coding-problems')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        _pgProblems = data.problems || [];
        // Populate category filter
        var catFilter = document.getElementById('coding-pg-cat-filter');
        if (catFilter && data.categories) {
          catFilter.innerHTML = '<option value="all">All Categories</option>';
          data.categories.forEach(function(cat) {
            catFilter.innerHTML += '<option value="' + cat + '">' + cat + '</option>';
          });
        }
        codingPgRenderList();
      }
    })
    .catch(function() {
      listEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:0.82rem;">Could not load problems. Check connection.</div>';
    });
}

/**
 * Load user's custom problems from localStorage
 */
function codingPgLoadMyProblems() {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'default';
  var key = 'ck_my_problems_' + userId;
  try {
    _pgMyProblems = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    _pgMyProblems = [];
  }
}

/**
 * Save user's custom problems to localStorage
 */
function codingPgSaveMyProblems() {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'default';
  var key = 'ck_my_problems_' + userId;
  localStorage.setItem(key, JSON.stringify(_pgMyProblems));
}

/**
 * Render the problem list based on active tab + filters
 */
function codingPgRenderList() {
  var listEl = document.getElementById('coding-pg-list');
  if (!listEl) return;

  var problems = _pgActiveTab === 'my' ? _pgMyProblems : _pgProblems;

  // Apply filters
  var catFilter = document.getElementById('coding-pg-cat-filter');
  var diffFilter = document.getElementById('coding-pg-diff-filter');
  var cat = catFilter ? catFilter.value : 'all';
  var diff = diffFilter ? diffFilter.value : 'all';

  if (cat !== 'all') problems = problems.filter(function(p) { return p.category === cat; });
  if (diff !== 'all') problems = problems.filter(function(p) { return p.difficulty === diff; });

  if (problems.length === 0) {
    var emptyMsg = _pgActiveTab === 'my'
      ? '<div style="text-align:center;padding:40px;color:var(--muted);"><div style="font-size:2rem;margin-bottom:12px;">📝</div><div style="font-size:0.85rem;">No custom problems yet.</div><div style="font-size:0.78rem;margin-top:6px;">Click + to add your own!</div></div>'
      : '<div style="text-align:center;padding:40px;color:var(--muted);font-size:0.85rem;">No problems found for this filter.</div>';
    listEl.innerHTML = emptyMsg;
    return;
  }

  var html = '';
  problems.forEach(function(p, i) {
    var isActive = _pgActiveProblem && _pgActiveProblem.id === p.id;
    var diffClass = 'coding-pg-diff-' + p.difficulty;
    html += '<div class="coding-pg-item' + (isActive ? ' active' : '') + '" onclick="codingPgSelectProblem(\'' + p.id + '\')">';
    html += '  <span class="coding-pg-item-num">' + (i + 1) + '</span>';
    html += '  <div class="coding-pg-item-info">';
    html += '    <div class="coding-pg-item-title">' + sanitize(p.title) + '</div>';
    html += '    <div class="coding-pg-item-meta">' + sanitize(p.category) + '</div>';
    html += '  </div>';
    html += '  <span class="coding-pg-diff ' + diffClass + '">' + p.difficulty + '</span>';
    html += '</div>';
  });
  listEl.innerHTML = html + '<div style="height:16px;"></div>';
}

/**
 * Switch between All / My Problems tabs
 */
function codingPgSwitchTab(tab) {
  _pgActiveTab = tab;
  var tabAll = document.getElementById('coding-pg-tab-all');
  var tabMy = document.getElementById('coding-pg-tab-my');
  var tabScore = document.getElementById('coding-pg-tab-score');
  
  if (tabAll) { tabAll.style.color = tab === 'all' ? '#a78bfa' : '#94a3b8'; tabAll.style.borderBottomColor = tab === 'all' ? '#a78bfa' : 'transparent'; }
  if (tabMy) { tabMy.style.color = tab === 'my' ? '#a78bfa' : '#94a3b8'; tabMy.style.borderBottomColor = tab === 'my' ? '#a78bfa' : 'transparent'; }
  if (tabScore) { tabScore.style.color = tab === 'score' ? '#a78bfa' : '#94a3b8'; tabScore.style.borderBottomColor = tab === 'score' ? '#a78bfa' : 'transparent'; }

  if (tab === 'score') {
    codingPgRenderScore();
  } else {
    codingPgRenderList();
  }
}

/**
 * Filter problems
 */
function codingPgFilterProblems() {
  codingPgRenderList();
}

/**
 * Select a problem and render the editor
 */
function codingPgSelectProblem(problemId) {
  // Find problem in both arrays
  var problem = _pgProblems.find(function(p) { return p.id === problemId; })
    || _pgMyProblems.find(function(p) { return p.id === problemId; });
  if (!problem) return;

  _pgActiveProblem = problem;
  codingPgRenderList(); // Update active highlight

  // Show editor area, hide welcome
  var welcome = document.getElementById('coding-pg-welcome');
  var editorArea = document.getElementById('coding-pg-editor-area');
  if (welcome) welcome.style.display = 'none';
  if (editorArea) editorArea.style.display = 'flex';

  // Auto-collapse left panel for full-screen coding workspace
  var leftPanel = document.getElementById('coding-pg-left');
  if (leftPanel) {
    leftPanel.style.width = '0';
    leftPanel.style.minWidth = '0';
    leftPanel.style.padding = '0';
    leftPanel.style.overflow = 'hidden';
    leftPanel.style.borderRight = 'none';
    leftPanel.style.transition = 'all 0.25s ease';
  }

  // Render the coding interface for this problem
  codingPgRenderEditor(problem);
}

/**
 * Toggle left panel visibility (VS Code style sidebar toggle)
 */
function codingPgToggleLeftPanel() {
  var leftPanel = document.getElementById('coding-pg-left');
  if (!leftPanel) return;
  var isCollapsed = leftPanel.style.width === '0' || leftPanel.style.width === '0px';
  if (isCollapsed) {
    leftPanel.style.width = '320px';
    leftPanel.style.minWidth = '280px';
    leftPanel.style.padding = '';
    leftPanel.style.overflow = 'hidden';
    leftPanel.style.borderRight = '1px solid rgba(255,255,255,0.08)';
  } else {
    leftPanel.style.width = '0';
    leftPanel.style.minWidth = '0';
    leftPanel.style.padding = '0';
    leftPanel.style.overflow = 'hidden';
    leftPanel.style.borderRight = 'none';
  }
}

/**
 * Render Monaco editor + problem details in right panel
 * Layout: horizontal split — left=problem, right=editor (like LeetCode)
 */
function codingPgRenderEditor(problem) {
  var area = document.getElementById('coding-pg-editor-area');
  if (!area) return;

  var defaultLang = problem.defaultLanguage || 'cpp';
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === defaultLang; }) || CODING_LANGUAGES[1];
  var starterCode = (problem.starterCode && problem.starterCode[defaultLang]) || '';

  var diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
  var diffColor = diffColors[problem.difficulty] || '#f59e0b';

  var html = '';

  // Horizontal split container — proper flex split pane (LeetCode style)
  html += '<div id="coding-pg-split-container" style="display:flex;height:100%;width:100%;overflow:hidden;">';

  // ═══ LEFT: Problem Description ═══
  html += '<div id="coding-pg-desc-panel" style="flex:none;width:38%;min-width:150px;max-width:65%;overflow-y:auto;padding:12px 8px 12px 12px;user-select:text;cursor:default;">';

  // Problem Header
  html += '<div class="coding-header">';
  html += '  <div class="coding-title-row">';
  html += '    <span class="coding-title">' + sanitize(problem.title) + '</span>';
  html += '    <span class="coding-difficulty" style="background:' + diffColor + '20;color:' + diffColor + ';border:1px solid ' + diffColor + '40;">' + problem.difficulty + '</span>';
  html += '    <span style="font-size:0.7rem;color:var(--muted);background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:6px;">' + sanitize(problem.category) + '</span>';
  html += '  </div>';
  html += '</div>';

  // Description
  html += '<div class="coding-description">';
  html += '  <div class="coding-description-text">' + sanitize(problem.description) + '</div>';
  html += '</div>';

  // Input / Output Format
  if (problem.inputFormat || problem.outputFormat) {
    html += '<div style="display:flex;gap:10px;margin-bottom:10px;">';
    if (problem.inputFormat) {
      html += '<div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;">';
      html += '  <div style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Input Format</div>';
      html += '  <pre style="font-size:0.78rem;color:rgba(255,255,255,0.75);white-space:pre-wrap;margin:0;">' + sanitize(problem.inputFormat) + '</pre>';
      html += '</div>';
    }
    if (problem.outputFormat) {
      html += '<div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px 12px;">';
      html += '  <div style="font-size:0.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Output Format</div>';
      html += '  <pre style="font-size:0.78rem;color:rgba(255,255,255,0.75);white-space:pre-wrap;margin:0;">' + sanitize(problem.outputFormat) + '</pre>';
      html += '</div>';
    }
    html += '</div>';
  }

  // Sample test cases
  var visibleTCs = (problem.testCases || []).filter(function(tc) { return !tc.isHidden; });
  if (visibleTCs.length > 0) {
    html += '<div class="coding-samples">';
    html += '  <div class="coding-samples-header"><i class="fas fa-flask"></i> Sample Test Cases</div>';
    html += '  <div class="coding-samples-body">';
    visibleTCs.forEach(function(tc, i) {
      html += '<div class="coding-sample-case">';
      html += '  <div class="coding-sample-label">Sample ' + (i + 1) + '</div>';
      html += '  <div class="coding-sample-row">';
      html += '    <div class="coding-sample-col"><span class="coding-sample-col-label">Input</span><pre class="coding-sample-pre">' + sanitize(tc.input) + '</pre></div>';
      html += '    <div class="coding-sample-col"><span class="coding-sample-col-label">Expected</span><pre class="coding-sample-pre">' + sanitize(tc.expectedOutput) + '</pre></div>';
      html += '  </div></div>';
    });
    html += '  </div></div>';
  }

  // Hints
  if (problem.hints && problem.hints.length > 0) {
    html += '<div class="coding-hint"><i class="fas fa-lightbulb"></i><span>' + sanitize(problem.hints.join(' | ')) + '</span></div>';
  }

  // Explanation
  if (problem.explanation) {
    html += '<div style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:10px 14px;margin-top:10px;font-size:0.8rem;">';
    html += '  <div style="color:#22c55e;font-weight:700;margin-bottom:4px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;">Explanation</div>';
    html += '  <div style="color:rgba(255,255,255,0.8);">' + sanitize(problem.explanation) + '</div>';
    html += '</div>';
  }

  // Tags
  if (problem.tags && problem.tags.length > 0) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">';
    problem.tags.forEach(function(tag) {
      html += '<span style="font-size:0.68rem;font-weight:600;background:rgba(255,255,255,0.06);color:#94a3b8;padding:3px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);">#' + sanitize(tag) + '</span>';
    });
    html += '</div>';
  }

  // Constraints + Complexity
  if (problem.constraints || problem.timeComplexity || problem.spaceComplexity) {
    html += '<div style="background:rgba(108,71,255,0.06);border:1px solid rgba(108,71,255,0.15);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:0.8rem;">';
    if (problem.constraints) {
      html += '<div style="color:#a78bfa;font-weight:700;margin-bottom:6px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;">Constraints</div>';
      html += '<div style="color:rgba(255,255,255,0.8);white-space:pre-wrap;margin-bottom:8px;">' + sanitize(problem.constraints) + '</div>';
    }
    if (problem.timeComplexity || problem.spaceComplexity) {
      html += '<div style="display:flex;gap:16px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04);">';
      if (problem.timeComplexity) html += '<span style="color:#22c55e;font-size:0.72rem;font-weight:600;">⏱ Expected: ' + sanitize(problem.timeComplexity) + '</span>';
      if (problem.spaceComplexity) html += '<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">💾 Space: ' + sanitize(problem.spaceComplexity) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>'; // End left panel

  // ── Resize Handle (Description ↔ Editor) — vertical drag ──
  html += '<div id="coding-pg-vresize" style="flex:none;width:5px;cursor:col-resize;background:rgba(255,255,255,0.04);border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);" onmouseenter="this.style.background=\'rgba(108,71,255,0.5)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.04)\'" onmousedown="codingPgStartResize(event)"></div>';

  // ═══ RIGHT: Code Editor ═══
  html += '<div style="flex:1;min-width:0;width:0;display:flex;flex-direction:column;overflow:hidden;padding-left:4px;">';

  // Toolbar with toggle button
  html += '<div class="coding-toolbar">';
  html += '  <div class="coding-toolbar-left">';
  html += '    <button onclick="codingPgToggleLeftPanel()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:5px 8px;color:#94a3b8;cursor:pointer;font-size:0.7rem;margin-right:8px;" title="Toggle Problem List (Ctrl+B)"><i class="fas fa-bars"></i></button>';
  html += '    <select id="coding-pg-lang" class="coding-lang-select" onchange="codingPgChangeLang()">';
  CODING_LANGUAGES.forEach(function(lang) {
    var sel = lang.id === defaultLang ? ' selected' : '';
    html += '<option value="' + lang.id + '"' + sel + '>' + lang.icon + ' ' + lang.label + '</option>';
  });
  html += '    </select>';
  html += '  </div>';
  html += '  <div class="coding-toolbar-right">';
  html += '    <button onclick="codingPgFormatCode()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:5px 10px;color:#94a3b8;cursor:pointer;font-size:0.7rem;font-weight:600;display:flex;align-items:center;gap:4px;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(34,197,94,0.15)\';this.style.color=\'#22c55e\';this.style.borderColor=\'rgba(34,197,94,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\';this.style.color=\'#94a3b8\';this.style.borderColor=\'rgba(255,255,255,0.1)\'" title="Format Code (Ctrl+Shift+F)"><i class="fas fa-magic"></i> Format</button>';
  html += '    <button id="coding-pg-bottom-toggle-btn" onclick="codingPgToggleBottomPanel()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:5px 10px;color:#94a3b8;cursor:pointer;font-size:0.7rem;font-weight:600;display:flex;align-items:center;gap:4px;transition:all 0.15s;" onmouseover="this.style.background=\'rgba(108,71,255,0.15)\';this.style.color=\'#a78bfa\';this.style.borderColor=\'rgba(108,71,255,0.3)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\';this.style.color=\'#94a3b8\';this.style.borderColor=\'rgba(255,255,255,0.1)\'" title="Toggle Bottom Panel"><i class="fas fa-terminal"></i> <span id="coding-pg-toggle-text">Hide Panel</span></button>';
  html += '    <button class="coding-btn coding-btn-run" id="coding-pg-run-btn" onclick="codingPgRun()"><i class="fas fa-play"></i> Run</button>';
  html += '    <button class="coding-btn coding-btn-submit" id="coding-pg-submit-btn" onclick="codingPgSubmit()"><i class="fas fa-paper-plane"></i> Submit</button>';
  html += '  </div>';
  html += '</div>';

  // Monaco container — flex:1 fills remaining height between toolbar and bottom panels
  html += '<div class="coding-editor-wrap" style="flex:1;display:flex;flex-direction:column;min-height:0;">';
  html += '  <div class="coding-editor-header">';
  html += '    <span class="coding-editor-filename" id="coding-pg-filename"><i class="fas fa-code"></i> solution' + langObj.extension + '</span>';
  html += '    <span class="coding-editor-info" id="coding-pg-cursor">Ln 1, Col 1</span>';
  html += '  </div>';
  html += '  <div id="coding-pg-monaco" class="coding-monaco-container" style="flex:1;min-height:0;"></div>';
  html += '</div>';

  // Bottom panels — scrollable area for input/output/history
  html += '<div id="coding-pg-bottom-panels" style="flex:none;overflow-y:auto;max-height:45%;min-height:160px;">';

  // Custom Input — auto-load first sample input
  var firstSampleInput = '';
  var visibleTCsForInput = (problem.testCases || []).filter(function(tc) { return !tc.isHidden; });
  if (visibleTCsForInput.length > 0) firstSampleInput = visibleTCsForInput[0].input || '';

  html += '<div class="coding-input-section">';
  html += '  <div class="coding-input-header" onclick="codingPgToggleInput()">';
  html += '    <span><i class="fas fa-terminal"></i> Custom Input</span>';
  html += '    <span id="coding-pg-input-toggle">▼</span>';
  html += '  </div>';
  html += '  <textarea id="coding-pg-stdin" class="coding-input-textarea" style="display:block;" placeholder="Enter input...">' + sanitize(firstSampleInput) + '</textarea>';
  html += '</div>';

  // Output
  html += '<div class="coding-output-section">';
  html += '  <div class="coding-output-header"><span><i class="fas fa-terminal"></i> Output</span>';
  html += '    <button class="coding-output-clear" onclick="codingPgClearOutput()">Clear</button></div>';
  html += '  <div id="coding-pg-output" class="coding-output-console"><span class="coding-output-placeholder">Run your code to see output...</span></div>';
  html += '</div>';

  // Submission History
  html += '<div style="margin-top:8px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">';
  html += '  <div style="padding:8px 12px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:6px;"><i class="fas fa-history"></i> Submission History</div>';
  html += '  <div id="coding-pg-history-body" style="padding:8px;max-height:110px;overflow-y:auto;">';
  html += '    <span style="color:var(--muted);font-size:0.78rem;font-style:italic;">No submissions yet.</span>';
  html += '  </div>';
  html += '</div>';

  html += '</div>'; // End bottom panels
  html += '</div>'; // End right panel (editor)
  html += '</div>'; // End horizontal split container

  area.innerHTML = html;

  // Initialize Monaco and load submission history
  setTimeout(function() {
    codingPgInitMonaco(defaultLang, starterCode);
    codingPgLoadHistory(problem.id);
  }, 50);
}

// ═══════════════════════════════════════════════════════
// PLAYGROUND CODE PERSISTENCE
// ═══════════════════════════════════════════════════════

function _pgCodeKey(problemId, langId) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'anon';
  return 'ck_pg_' + userId + '_' + problemId + '_' + langId;
}

var _pgSaveTimer = null;
function pgSaveCode(problemId, langId, code) {
  if (!problemId) return;
  clearTimeout(_pgSaveTimer);
  _pgSaveTimer = setTimeout(function() {
    try { localStorage.setItem(_pgCodeKey(problemId, langId), code); } catch (e) {}
  }, 1500);
}

function pgRestoreCode(problemId, langId) {
  if (!problemId) return null;
  try { return localStorage.getItem(_pgCodeKey(problemId, langId)) || null; } catch (e) { return null; }
}

/**
 * Initialize Monaco editor in playground
 */
function codingPgInitMonaco(langId, starterCode) {
  var container = document.getElementById('coding-pg-monaco');
  if (!container) return;

  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:0.85rem;gap:8px;"><i class="fas fa-spinner fa-spin"></i> Loading editor...</div>';

  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; }) || CODING_LANGUAGES[1];

  loadMonacoEditor().then(function(monaco) {
    container.innerHTML = '';
    if (_pgEditorInstance) { _pgEditorInstance.dispose(); _pgEditorInstance = null; }

    // Restore saved code or use starter
    var problemId = _pgActiveProblem ? _pgActiveProblem.id : '';
    var savedCode = pgRestoreCode(problemId, langId);
    var initialCode = savedCode !== null ? savedCode : (starterCode || getDefaultStarter(langId));

    _pgEditorInstance = monaco.editor.create(container, {
      value: initialCode,
      language: langObj.monacoId,
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
      lineNumbers: 'on',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
      tabSize: 4,
      wordWrap: 'on',
      bracketPairColorization: { enabled: true },
      renderLineHighlight: 'line',
      scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    });

    _pgEditorInstance.onDidChangeCursorPosition(function(e) {
      var el = document.getElementById('coding-pg-cursor');
      if (el) el.textContent = 'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
    });

    // Auto-save code on change + trigger compile check
    _pgEditorInstance.onDidChangeModelContent(function() {
      var pid = _pgActiveProblem ? _pgActiveProblem.id : '';
      var select = document.getElementById('coding-pg-lang');
      var lid = select ? select.value : langId;
      if (pid) pgSaveCode(pid, lid, _pgEditorInstance.getValue());
      // Real-time syntax error detection (debounced)
      codingPgScheduleCompileCheck();
    });
  }).catch(function() {
    container.innerHTML = '<textarea id="coding-pg-fallback" class="coding-editor-textarea" spellcheck="false" placeholder="// Write your code here...">' + sanitize(starterCode || '') + '</textarea>';
  });
}

/**
 * Change language in playground editor
 */
function codingPgChangeLang() {
  var select = document.getElementById('coding-pg-lang');
  if (!select || !_pgEditorInstance || !window.monaco) return;
  var langId = select.value;
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; }) || CODING_LANGUAGES[1];

  var model = _pgEditorInstance.getModel();
  if (model) window.monaco.editor.setModelLanguage(model, langObj.monacoId);

  var filenameEl = document.getElementById('coding-pg-filename');
  if (filenameEl) filenameEl.innerHTML = '<i class="fas fa-code"></i> solution' + langObj.extension;

  // Restore saved code for new language, else use starter/default
  var savedForLang = pgRestoreCode(_pgActiveProblem ? _pgActiveProblem.id : '', langId);
  if (savedForLang !== null) {
    _pgEditorInstance.setValue(savedForLang);
  } else {
    var code = _pgEditorInstance.getValue().trim();
    var isDefault = false;
    CODING_LANGUAGES.forEach(function(l) { if (code === getDefaultStarter(l.id).trim()) isDefault = true; });
    if (!code || isDefault) {
      var starter = (_pgActiveProblem && _pgActiveProblem.starterCode && _pgActiveProblem.starterCode[langId]) || getDefaultStarter(langId);
      _pgEditorInstance.setValue(starter);
    }
  }
}

/**
 * Get code from playground editor
 */
function codingPgGetCode() {
  if (_pgEditorInstance) return _pgEditorInstance.getValue();
  var fb = document.getElementById('coding-pg-fallback');
  return fb ? fb.value : '';
}

/**
 * Run code in playground
 */
function codingPgRun() {
  var code = codingPgGetCode();
  var outputEl = document.getElementById('coding-pg-output');
  if (!code.trim()) { if (outputEl) outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Write some code first.</span>'; return; }

  var select = document.getElementById('coding-pg-lang');
  var langId = select ? select.value : 'cpp';
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; }) || CODING_LANGUAGES[1];
  var stdin = document.getElementById('coding-pg-stdin');
  var stdinVal = stdin ? stdin.value : '';

  if (outputEl) outputEl.innerHTML = '<span class="coding-output-info"><i class="fas fa-spinner fa-spin"></i> Running...</span>';
  var runBtn = document.getElementById('coding-pg-run-btn');
  if (runBtn) { runBtn.disabled = true; runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...'; }

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/code/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ source_code: code, language_id: langObj.judge0Id, stdin: stdinVal }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      var h = '';
      if (data.status === 'compilation_error') { h += '<div class="coding-output-status coding-status-error">Compilation Error</div><pre class="coding-output-pre coding-output-error-text">' + sanitize(data.compile_output) + '</pre>'; }
      else if (data.status === 'runtime_error') { h += '<div class="coding-output-status coding-status-error">Runtime Error</div><pre class="coding-output-pre coding-output-error-text">' + sanitize(data.stderr) + '</pre>'; }
      else if (data.status === 'time_limit') { h += '<div class="coding-output-status coding-status-warning">Time Limit Exceeded</div>'; }
      else {
        h += '<div class="coding-output-status coding-status-success">Executed Successfully</div><pre class="coding-output-pre">' + sanitize(data.stdout || '(no output)') + '</pre>';
        if (data.time != null || data.memory != null) {
          h += '<div style="display:flex;gap:12px;margin-top:8px;padding:6px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">';
          if (data.time != null) h += '<span style="font-size:0.72rem;color:#22c55e;font-weight:600;">⏱ ' + parseFloat(data.time).toFixed(3) + 's</span>';
          if (data.memory != null) h += '<span style="font-size:0.72rem;color:#60a5fa;font-weight:600;">💾 ' + (data.memory >= 1024 ? (data.memory / 1024).toFixed(1) + ' MB' : data.memory + ' KB') + '</span>';
          h += '</div>';
        }
      }
      if (outputEl) outputEl.innerHTML = h;
    } else { if (outputEl) outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> ' + sanitize(data.message) + '</span>'; }
  })
  .catch(function() { if (outputEl) outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Connection failed.</span>'; })
  .finally(function() { if (runBtn) { runBtn.disabled = false; runBtn.innerHTML = '<i class="fas fa-play"></i> Run'; } });
}

/**
 * Submit code against test cases in playground
 */
function codingPgSubmit() {
  var code = codingPgGetCode();
  var outputEl = document.getElementById('coding-pg-output');
  if (!code.trim()) { if (outputEl) outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Write your solution first.</span>'; return; }
  if (!_pgActiveProblem) return;

  var select = document.getElementById('coding-pg-lang');
  var langId = select ? select.value : 'cpp';
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; }) || CODING_LANGUAGES[1];

  if (outputEl) outputEl.innerHTML = '<span class="coding-output-info"><i class="fas fa-spinner fa-spin"></i> Testing against all cases...</span>';
  var submitBtn = document.getElementById('coding-pg-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...'; }

  // For playground problems (not in DB), run against test cases client-side via /api/code/run
  var testCases = _pgActiveProblem.testCases || [];
  if (testCases.length === 0) { if (outputEl) outputEl.innerHTML = '<span class="coding-output-info">No test cases for this problem.</span>'; if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit'; } return; }

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  var results = [];
  var completed = 0;

  testCases.forEach(function(tc, i) {
    fetch(BASE_URL + '/api/code/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ source_code: code, language_id: langObj.judge0Id, stdin: tc.input }),
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var stdout = (data.stdout || '').trim();
      var expected = tc.expectedOutput.trim();
      var passed = data.success && data.status === 'accepted' && stdout === expected;
      results[i] = { test_case: i + 1, passed: passed, input: tc.isHidden ? '(hidden)' : tc.input, expected: tc.isHidden ? '(hidden)' : tc.expectedOutput, actual: tc.isHidden ? (passed ? '(correct)' : '(wrong)') : (stdout || data.stderr || data.compile_output || 'No output'), status: data.status || 'error', is_hidden: tc.isHidden };
    })
    .catch(function() { results[i] = { test_case: i + 1, passed: false, input: '?', expected: '?', actual: 'Error', status: 'error', is_hidden: tc.isHidden }; })
    .finally(function() {
      completed++;
      if (completed === testCases.length) {
        // All done — render results
        var allPassed = results.every(function(r) { return r.passed; });
        var passedCount = results.filter(function(r) { return r.passed; }).length;
        var h = '';
        if (allPassed) { h += '<div class="coding-output-status coding-status-accepted">✅ Accepted — All ' + testCases.length + ' Test Cases Passed!</div>'; }
        else { h += '<div class="coding-output-status coding-status-failed">❌ ' + passedCount + '/' + testCases.length + ' test cases passed.</div>'; }
        h += '<div class="coding-tc-results">';
        results.forEach(function(r) {
          var cls = r.passed ? 'coding-tc-pass' : 'coding-tc-fail';
          h += '<div class="coding-tc-item ' + cls + '"><div class="coding-tc-header">' + (r.passed ? '✅' : '❌') + ' Test Case ' + r.test_case + '</div>';
          if (!r.is_hidden && !r.passed) { h += '<div class="coding-tc-detail"><div><span class="coding-tc-label">Input:</span> <code>' + sanitize(r.input) + '</code></div><div><span class="coding-tc-label">Expected:</span> <code>' + sanitize(r.expected) + '</code></div><div><span class="coding-tc-label">Got:</span> <code>' + sanitize(r.actual) + '</code></div></div>'; }
          h += '</div>';
        });
        h += '</div>';
        if (outputEl) outputEl.innerHTML = h;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit'; }

        // Award points if all passed (first time only)
        if (allPassed && _pgActiveProblem) {
          var award = codingScoreAward(_pgActiveProblem.id, _pgActiveProblem.title, _pgActiveProblem.difficulty, langObj.id);
          if (award.awarded) {
            var toast = '<div style="margin-top:10px;padding:10px 14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;font-size:0.82rem;color:#22c55e;font-weight:600;">🎉 +' + award.points + ' points | +' + award.coins + ' coins earned!</div>';
            if (outputEl) outputEl.innerHTML += toast;
            // Show streak bonus toast if earned
            if (award.streakBonus) {
              var streakToast = '<div style="margin-top:6px;padding:10px 14px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:10px;font-size:0.82rem;color:#fbbf24;font-weight:600;">🔥 7-Day Streak Complete! +10 bonus coins awarded!</div>';
              if (outputEl) outputEl.innerHTML += streakToast;
            }
          }
          // Show "View Best Solution" button after successful submit
          var viewBtn = '<div style="margin-top:8px;"><button onclick="codingPgViewBestSolution()" style="background:rgba(108,71,255,0.15);border:1px solid rgba(108,71,255,0.3);border-radius:8px;padding:8px 14px;color:#a78bfa;font-size:0.78rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;"><i class="fas fa-eye"></i> View Best Solution</button></div>';
          if (outputEl) outputEl.innerHTML += viewBtn;

          // Submit to leaderboard (non-blocking)
          codingPgSubmitToLeaderboard(_pgActiveProblem.id, _pgActiveProblem.title);
        }

        // Save submission to localStorage + refresh history
        if (_pgActiveProblem) {
          var subStatus = allPassed ? 'accepted' : 'wrong_answer';
          _pgSaveSubmission(_pgActiveProblem.id, subStatus, allPassed, langObj.id, passedCount, testCases.length);
          codingPgLoadHistory(_pgActiveProblem.id);
        }
      }
    });
  });
}

/**
 * Toggle custom input in playground
 */
function codingPgToggleInput() {
  var el = document.getElementById('coding-pg-stdin');
  var tog = document.getElementById('coding-pg-input-toggle');
  if (el) { var h = el.style.display === 'none'; el.style.display = h ? 'block' : 'none'; if (tog) tog.textContent = h ? '▼' : '▶'; }
}

/**
 * Clear playground output
 */
function codingPgClearOutput() {
  var el = document.getElementById('coding-pg-output');
  if (el) el.innerHTML = '<span class="coding-output-placeholder">Run your code to see output...</span>';
}

/**
 * Toggle bottom panel (Custom Input / Output / Submission History)
 * When hidden, code editor takes full height
 */
function codingPgToggleBottomPanel() {
  _pgBottomPanelVisible = !_pgBottomPanelVisible;
  var bottomPanel = document.getElementById('coding-pg-bottom-panels');
  var toggleText = document.getElementById('coding-pg-toggle-text');
  if (bottomPanel) {
    bottomPanel.style.display = _pgBottomPanelVisible ? '' : 'none';
  }
  if (toggleText) {
    toggleText.textContent = _pgBottomPanelVisible ? 'Hide Panel' : 'Show Panel';
  }
  // Relayout Monaco editor to fill available space
  if (_pgEditorInstance) {
    setTimeout(function() { _pgEditorInstance.layout(); }, 50);
  }
}

/**
 * Format code in the editor
 * Uses Monaco's built-in formatter for JS, custom indent-based for C/Java/Python
 */
function codingPgFormatCode() {
  if (!_pgEditorInstance) return;

  var select = document.getElementById('coding-pg-lang');
  var langId = select ? select.value : 'c';

  // Try Monaco's built-in format action first (works well for JS)
  if (langId === 'javascript') {
    var formatAction = _pgEditorInstance.getAction('editor.action.formatDocument');
    if (formatAction) {
      formatAction.run();
      return;
    }
  }

  // Custom formatter for C/Java/Python — indent-based
  var code = _pgEditorInstance.getValue();
  var formatted = _pgFormatIndent(code, langId);
  if (formatted !== code) {
    _pgEditorInstance.setValue(formatted);
  }
}

/**
 * Custom indent-based code formatter
 * Handles bracket-based languages (C, Java) and Python
 */
function _pgFormatIndent(code, langId) {
  if (!code || !code.trim()) return code;

  if (langId === 'python') {
    // Python: normalize indentation (spaces only), remove trailing whitespace per line
    var pyLines = code.split('\n');
    var result = [];
    for (var i = 0; i < pyLines.length; i++) {
      // Replace tabs with 4 spaces, trim trailing whitespace
      result.push(pyLines[i].replace(/\t/g, '    ').replace(/\s+$/, ''));
    }
    // Remove multiple consecutive blank lines
    var final = [];
    var prevBlank = false;
    for (var j = 0; j < result.length; j++) {
      var isBlank = result[j].trim() === '';
      if (isBlank && prevBlank) continue;
      final.push(result[j]);
      prevBlank = isBlank;
    }
    return final.join('\n');
  }

  // C / Java — bracket-based indentation formatter
  var lines = code.split('\n');
  var indent = 0;
  var formatted = [];
  var indentStr = '    '; // 4 spaces

  for (var k = 0; k < lines.length; k++) {
    var line = lines[k].trim();
    if (!line) { formatted.push(''); continue; }

    // Decrease indent before closing braces
    var closingFirst = /^[}\]]/.test(line);
    if (closingFirst && indent > 0) indent--;

    // Apply current indentation
    var prefix = '';
    for (var p = 0; p < indent; p++) prefix += indentStr;
    formatted.push(prefix + line);

    // Count braces to adjust indent for next line
    var opens = (line.match(/[{]/g) || []).length;
    var closes = (line.match(/[}]/g) || []).length;
    indent += opens - closes;
    // Re-add closing that was subtracted at start
    if (closingFirst) indent += 0; // already handled
    else indent = indent; // no change needed

    if (indent < 0) indent = 0;
  }

  // Remove multiple consecutive blank lines (keep max 1)
  var collapsed = [];
  var wasPrevBlank = false;
  for (var m = 0; m < formatted.length; m++) {
    var isEmpty = formatted[m].trim() === '';
    if (isEmpty && wasPrevBlank) continue;
    collapsed.push(formatted[m]);
    wasPrevBlank = isEmpty;
  }
  // Remove trailing blank lines
  while (collapsed.length > 0 && collapsed[collapsed.length - 1].trim() === '') {
    collapsed.pop();
  }

  return collapsed.join('\n');
}

/**
 * Toggle submission history panel in playground
 */
function codingPgToggleHistory() {
  var bodyEl = document.getElementById('coding-pg-history-body');
  var toggleEl = document.getElementById('coding-pg-history-toggle');
  if (bodyEl) {
    var isHidden = bodyEl.style.display === 'none';
    bodyEl.style.display = isHidden ? 'block' : 'none';
    if (toggleEl) toggleEl.textContent = isHidden ? '▼' : '▶';
  }
}

/**
 * Load submission history for playground problem — from localStorage
 */
function codingPgLoadHistory(problemId) {
  var container = document.getElementById('coding-pg-history-body');
  if (!container) return;

  var submissions = _pgGetSubmissions(problemId);

  if (submissions.length === 0) {
    container.innerHTML = '<span style="color:#94a3b8;font-size:0.78rem;font-style:italic;">No submissions yet.</span>';
    return;
  }

  var html = '';
  submissions.forEach(function(sub) {
    var statusIcon = '⏳';
    var statusColor = '#94a3b8';
    var statusText = sub.status || 'submitted';

    if (sub.passed || sub.status === 'accepted') {
      statusIcon = '✅'; statusColor = '#22c55e'; statusText = 'Accepted';
    } else if (sub.status === 'wrong_answer') {
      statusIcon = '❌'; statusColor = '#ef4444'; statusText = 'Wrong Answer';
    } else if (sub.status === 'time_limit') {
      statusIcon = '⏱'; statusColor = '#f59e0b'; statusText = 'Time Limit';
    } else if (sub.status === 'runtime_error') {
      statusIcon = '💥'; statusColor = '#ef4444'; statusText = 'Runtime Error';
    } else if (sub.status === 'compilation_error') {
      statusIcon = '🔴'; statusColor = '#ef4444'; statusText = 'Compilation Error';
    }

    var timeAgo = codingTimeAgo(sub.createdAt);
    var langLabel = (sub.language || '?').toUpperCase();

    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:4px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:8px;">';
    html += '  <span style="font-size:0.78rem;font-weight:700;color:' + statusColor + ';">' + statusIcon + ' ' + statusText + '</span>';
    html += '  <span style="font-size:0.7rem;color:#94a3b8;display:flex;align-items:center;gap:8px;">';
    html += '    <span style="background:rgba(108,71,255,0.1);color:#a78bfa;padding:1px 6px;border-radius:4px;font-weight:700;font-size:0.65rem;">' + langLabel + '</span>';
    if (sub.passedCount !== undefined) html += '<span>' + sub.passedCount + '/' + sub.totalCount + '</span>';
    html += '    <span>' + timeAgo + '</span>';
    html += '  </span>';
    html += '</div>';
  });
  container.innerHTML = html;
}

/**
 * Save a submission to localStorage
 */
function _pgSaveSubmission(problemId, status, passed, language, passedCount, totalCount) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'anon';
  var key = 'ck_pg_subs_' + userId + '_' + problemId;
  var subs = [];
  try { subs = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { subs = []; }
  subs.unshift({ status: status, passed: passed, language: language, passedCount: passedCount, totalCount: totalCount, createdAt: new Date().toISOString() });
  if (subs.length > 10) subs = subs.slice(0, 10); // Keep max 10
  try { localStorage.setItem(key, JSON.stringify(subs)); } catch (e) {}
}

/**
 * Get submissions from localStorage
 */
function _pgGetSubmissions(problemId) {
  if (!problemId) return [];
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'anon';
  var key = 'ck_pg_subs_' + userId + '_' + problemId;
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
}

/**
 * Show Add Problem Modal (user custom problems)
 */
function codingPgShowAddModal() {
  var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;" id="coding-pg-add-modal" onclick="if(event.target===this)this.remove()">';
  html += '<div style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;width:500px;max-height:80vh;overflow-y:auto;">';
  html += '<h3 style="color:#fff;font-size:1.1rem;margin-bottom:16px;">➕ Add Custom Problem</h3>';
  html += '<div style="display:flex;flex-direction:column;gap:12px;">';
  html += '<input id="pg-add-title" placeholder="Problem Title" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#fff;font-size:0.88rem;outline:none;">';
  html += '<textarea id="pg-add-desc" placeholder="Problem Description" rows="3" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#fff;font-size:0.85rem;outline:none;resize:vertical;"></textarea>';
  html += '<div style="display:flex;gap:8px;"><select id="pg-add-cat" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:#fff;font-size:0.82rem;outline:none;cursor:pointer;"><option value="Arrays">Arrays</option><option value="Strings">Strings</option><option value="Math">Math</option><option value="Sorting">Sorting</option><option value="Searching">Searching</option><option value="Recursion">Recursion</option><option value="Dynamic Programming">DP</option></select>';
  html += '<select id="pg-add-diff" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:#fff;font-size:0.82rem;outline:none;cursor:pointer;"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div>';
  html += '<div style="font-size:0.8rem;color:var(--muted);font-weight:600;margin-top:4px;">Test Cases:</div>';
  html += '<div style="display:flex;gap:8px;"><input id="pg-add-tc-in" placeholder="Input (e.g. 5 3)" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:#fff;font-size:0.82rem;outline:none;"><input id="pg-add-tc-out" placeholder="Expected Output (e.g. 8)" style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px;color:#fff;font-size:0.82rem;outline:none;"></div>';
  html += '<button onclick="codingPgAddProblem()" style="background:linear-gradient(135deg,#6c47ff,#b251ff);border:none;border-radius:10px;padding:12px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;">Add Problem</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * Save custom problem to localStorage
 */
function codingPgAddProblem() {
  var title = document.getElementById('pg-add-title').value.trim();
  var desc = document.getElementById('pg-add-desc').value.trim();
  var cat = document.getElementById('pg-add-cat').value;
  var diff = document.getElementById('pg-add-diff').value;
  var tcIn = document.getElementById('pg-add-tc-in').value;
  var tcOut = document.getElementById('pg-add-tc-out').value.trim();
  if (!title || !desc) { alert('Title and description required.'); return; }

  var problem = {
    id: 'my-' + Date.now(),
    title: title,
    description: desc,
    category: cat,
    difficulty: diff,
    defaultLanguage: 'cpp',
    starterCode: { cpp: getDefaultStarter('cpp'), python: getDefaultStarter('python'), javascript: getDefaultStarter('javascript') },
    testCases: tcIn && tcOut ? [{ input: tcIn, expectedOutput: tcOut, isHidden: false }] : [],
    hints: [],
  };
  _pgMyProblems.push(problem);
  codingPgSaveMyProblems();
  // Close modal and switch to My tab
  var modal = document.getElementById('coding-pg-add-modal');
  if (modal) modal.remove();
  codingPgSwitchTab('my');
}

// ═══════════════════════════════════════════════════════
// CODING SCORE SYSTEM
// ═══════════════════════════════════════════════════════

var CODING_POINTS = { easy: 2, medium: 4, hard: 8 };

/**
 * Get score data from localStorage
 */
function codingScoreGet() {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'anon';
  var key = 'ck_coding_score_' + userId;
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { return {}; }
}

/**
 * Save score data to localStorage
 */
function codingScoreSave(data) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'anon';
  var key = 'ck_coding_score_' + userId;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
}

/**
 * Award points for first-time successful submission
 * Returns { awarded, points, coins } or { awarded: false } if already solved
 */
function codingScoreAward(problemId, problemTitle, difficulty, language) {
  var data = codingScoreGet();
  if (!data.solvedProblems) data.solvedProblems = [];
  if (!data.totalPoints) data.totalPoints = 0;
  if (!data.totalCoins) data.totalCoins = 0;
  if (!data.submissionCalendar) data.submissionCalendar = {};
  if (!data.streakRewards) data.streakRewards = [];

  // Check if already solved
  var alreadySolved = data.solvedProblems.find(function(p) { return p.problemId === problemId; });
  if (alreadySolved) return { awarded: false };

  var points = CODING_POINTS[difficulty] || 2;
  var coins = points * 2;

  // Add to solved list
  data.solvedProblems.push({
    problemId: problemId,
    title: problemTitle,
    difficulty: difficulty,
    points: points,
    coins: coins,
    solvedAt: new Date().toISOString(),
    language: language,
  });

  data.totalPoints += points;
  data.totalCoins += coins;

  // Update calendar
  var today = new Date().toISOString().split('T')[0];
  data.submissionCalendar[today] = (data.submissionCalendar[today] || 0) + 1;

  // Check 7-day streak and award bonus
  var streakBonus = _pgCheckStreakBonus(data);

  codingScoreSave(data);

  // Award coins on server (non-blocking)
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (token) {
    fetch(BASE_URL + '/api/coding-score/earn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ problemId: problemId, problemTitle: problemTitle, difficulty: difficulty, points: points, coins: coins }),
    }).catch(function() {});

    // Award streak bonus on server if earned
    if (streakBonus) {
      fetch(BASE_URL + '/api/coding-score/earn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ problemId: 'streak_bonus_' + today, problemTitle: '7-Day Streak Bonus', difficulty: 'streak', points: 0, coins: 10 }),
      }).catch(function() {});
    }
  }

  return { awarded: true, points: points, coins: coins, streakBonus: streakBonus };
}

/**
 * Check if user has completed a 7-day streak and award 10 bonus coins
 * Returns true if bonus was awarded, false otherwise
 */
function _pgCheckStreakBonus(data) {
  var calendar = data.submissionCalendar || {};
  var today = new Date();
  var streak = 0;

  // Count consecutive days backwards from today
  for (var d = 0; d < 30; d++) {
    var checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - d);
    var key = checkDate.toISOString().split('T')[0];
    if (calendar[key] && calendar[key] > 0) {
      streak++;
    } else {
      break;
    }
  }

  // If streak is exactly 7 (or multiple of 7), check if already rewarded
  if (streak >= 7 && streak % 7 === 0) {
    var streakEndDate = today.toISOString().split('T')[0];
    var streakStartDate = new Date(today);
    streakStartDate.setDate(streakStartDate.getDate() - 6);
    var streakKey = streakStartDate.toISOString().split('T')[0] + '_to_' + streakEndDate;

    if (!data.streakRewards) data.streakRewards = [];
    if (data.streakRewards.indexOf(streakKey) === -1) {
      // Award 10 bonus coins
      data.streakRewards.push(streakKey);
      data.totalCoins += 10;
      return true;
    }
  }

  return false;
}

/**
 * Get current streak count (consecutive days with submissions)
 */
function _pgGetCurrentStreak() {
  var data = codingScoreGet();
  var calendar = data.submissionCalendar || {};
  var today = new Date();
  var streak = 0;

  for (var d = 0; d < 365; d++) {
    var checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - d);
    var key = checkDate.toISOString().split('T')[0];
    if (calendar[key] && calendar[key] > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Render Coding Score tab
 */
function codingPgRenderScore() {
  var listEl = document.getElementById('coding-pg-list');
  if (!listEl) return;

  var data = codingScoreGet();
  var totalPoints = data.totalPoints || 0;
  var totalCoins = data.totalCoins || 0;
  var solved = data.solvedProblems || [];
  var calendar = data.submissionCalendar || {};

  var html = '';

  // Total Score Card
  html += '<div style="margin:8px 4px 12px;padding:16px;background:linear-gradient(135deg,rgba(108,71,255,0.12),rgba(236,72,153,0.08));border:1px solid rgba(108,71,255,0.2);border-radius:14px;text-align:center;">';
  html += '  <div style="font-size:1.8rem;font-weight:800;color:#fff;">' + totalPoints + '</div>';
  html += '  <div style="font-size:0.72rem;color:#a78bfa;font-weight:600;margin-bottom:8px;">Total Points</div>';
  html += '  <div style="font-size:0.9rem;color:#fbbf24;font-weight:700;">🪙 ' + totalCoins + ' coins earned</div>';
  html += '</div>';

  // 7-Day Streak Card
  var currentStreak = _pgGetCurrentStreak();
  var streakProgress = Math.min(currentStreak, 7);
  html += '<div style="margin:0 4px 12px;padding:12px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:12px;">';
  html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
  html += '    <span style="font-size:0.78rem;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:5px;">🔥 Current Streak: ' + currentStreak + ' day' + (currentStreak !== 1 ? 's' : '') + '</span>';
  if (currentStreak >= 7) {
    html += '    <span style="font-size:0.65rem;font-weight:700;color:#22c55e;background:rgba(34,197,94,0.15);padding:2px 8px;border-radius:8px;">✅ Streak Active!</span>';
  } else {
    html += '    <span style="font-size:0.65rem;color:#94a3b8;">' + (7 - streakProgress) + ' more to bonus</span>';
  }
  html += '  </div>';
  // Streak progress bar (7 dots)
  html += '  <div style="display:flex;gap:4px;align-items:center;">';
  for (var sd = 0; sd < 7; sd++) {
    var filled = sd < streakProgress;
    html += '<div style="flex:1;height:6px;border-radius:3px;background:' + (filled ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'rgba(255,255,255,0.08)') + ';"></div>';
  }
  html += '  </div>';
  html += '  <div style="font-size:0.65rem;color:#94a3b8;margin-top:6px;">Complete 7 consecutive days → +10 bonus coins 🪙</div>';
  html += '</div>';

  // Submission Heatmap
  var year = new Date().getFullYear();
  var totalSubs = Object.values(calendar).reduce(function(s, v) { return s + v; }, 0);
  html += '<div style="margin:0 4px 12px;padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;">';
  html += '  <div style="font-size:0.78rem;font-weight:700;color:#fff;margin-bottom:10px;">' + totalSubs + ' Submissions in ' + year + '</div>';
  html += '  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">';
  // Last 49 days heatmap (7 weeks)
  for (var d = 48; d >= 0; d--) {
    var date = new Date(); date.setDate(date.getDate() - d);
    var key = date.toISOString().split('T')[0];
    var count = calendar[key] || 0;
    var opacity = count === 0 ? '0.1' : count === 1 ? '0.4' : count === 2 ? '0.6' : '0.9';
    html += '<div style="width:100%;aspect-ratio:1;border-radius:2px;background:rgba(34,197,94,' + opacity + ');" title="' + key + ': ' + count + ' submissions"></div>';
  }
  html += '  </div>';
  html += '</div>';

  // Solved Problems List with Leaderboard button
  if (solved.length === 0) {
    html += '<div style="text-align:center;padding:30px;color:#94a3b8;"><div style="font-size:1.5rem;margin-bottom:8px;">📊</div><div style="font-size:0.82rem;">No problems solved yet.<br>Start solving to earn points!</div></div>';
  } else {
    html += '<div style="font-size:0.75rem;font-weight:700;color:var(--muted);padding:4px 8px;margin-bottom:6px;">Solved Problems (' + solved.length + ')</div>';
    // Sort by most recent first
    var sortedSolved = solved.slice().sort(function(a, b) { return new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime(); });
    sortedSolved.forEach(function(s) {
      var diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
      var dc = diffColors[s.difficulty] || '#f59e0b';
      var dateStr = new Date(s.solvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      html += '<div style="padding:10px 12px;margin:0 4px 6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
      html += '    <span style="font-size:0.8rem;font-weight:700;color:#fff;">✅ ' + sanitize(s.title) + '</span>';
      html += '    <span style="font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:8px;background:' + dc + '20;color:' + dc + ';border:1px solid ' + dc + '40;">' + s.difficulty.toUpperCase() + '</span>';
      html += '  </div>';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;">';
      html += '    <div style="display:flex;align-items:center;gap:10px;font-size:0.7rem;color:#94a3b8;">';
      html += '      <span style="color:#a78bfa;font-weight:600;">+' + s.points + 'pts</span>';
      html += '      <span style="color:#fbbf24;font-weight:600;">+' + s.coins + '🪙</span>';
      html += '      <span>' + (s.language || '').toUpperCase() + '</span>';
      html += '      <span>' + dateStr + '</span>';
      html += '    </div>';
      html += '    <button onclick="codingPgShowLeaderboard(\'' + s.problemId + '\')" style="background:rgba(108,71,255,0.1);border:1px solid rgba(108,71,255,0.25);border-radius:6px;padding:3px 8px;color:#a78bfa;font-size:0.65rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:3px;" onmouseover="this.style.background=\'rgba(108,71,255,0.2)\'" onmouseout="this.style.background=\'rgba(108,71,255,0.1)\'">🏆 Rank</button>';
      html += '  </div>';
      html += '</div>';
    });
  }

  listEl.innerHTML = html + '<div style="height:16px;"></div>';
}

// ═══════════════════════════════════════════════════════
// RESIZABLE PANELS (VS Code style drag handles)
// ═══════════════════════════════════════════════════════

/**
 * Start vertical resize (Description ↔ Editor width)
 */
function codingPgStartResize(e) {
  e.preventDefault();
  var descPanel = document.getElementById('coding-pg-desc-panel');
  var container = document.getElementById('coding-pg-split-container');
  if (!descPanel || !container) return;

  var startX = e.clientX;
  var startWidth = descPanel.getBoundingClientRect().width;
  var containerWidth = container.getBoundingClientRect().width;

  // Highlight divider during drag
  var divider = document.getElementById('coding-pg-vresize');
  if (divider) divider.style.background = 'rgba(108,71,255,0.6)';

  function onMove(ev) {
    var dx = ev.clientX - startX;
    var newWidth = Math.max(150, Math.min(startWidth + dx, containerWidth * 0.65));
    descPanel.style.flex = 'none';
    descPanel.style.width = newWidth + 'px';
    if (_pgEditorInstance) {
      requestAnimationFrame(function() { _pgEditorInstance.layout(); });
    }
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (divider) divider.style.background = 'rgba(255,255,255,0.04)';
    if (_pgEditorInstance) _pgEditorInstance.layout();
  }

  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ═══════════════════════════════════════════════════════
// REAL-TIME SYNTAX ERROR DETECTION (VS Code style)
// Debounced compile-check on every code change
// ═══════════════════════════════════════════════════════

var _pgCompileCheckTimer = null;

/**
 * Trigger compile check after 2 seconds of no typing
 * Called from Monaco onDidChangeModelContent
 */
function codingPgScheduleCompileCheck() {
  clearTimeout(_pgCompileCheckTimer);
  _pgCompileCheckTimer = setTimeout(function() {
    codingPgRunCompileCheck();
  }, 2000);
}

/**
 * Send code to /api/code/compile-check and show errors in Monaco
 */
function codingPgRunCompileCheck() {
  if (!_pgEditorInstance || !window.monaco) return;

  var code = _pgEditorInstance.getValue();
  if (!code || code.trim().length < 5) {
    // Clear markers if code is too short
    var model = _pgEditorInstance.getModel();
    if (model) window.monaco.editor.setModelMarkers(model, 'compile-check', []);
    return;
  }

  var select = document.getElementById('coding-pg-lang');
  var langId = select ? select.value : 'c';
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; });
  if (!langObj) return;

  // Skip for Python/JS (interpreted — no compile errors)
  if (langObj.judge0Id === 71 || langObj.judge0Id === 63) {
    var model = _pgEditorInstance.getModel();
    if (model) window.monaco.editor.setModelMarkers(model, 'compile-check', []);
    return;
  }

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) return;

  fetch(BASE_URL + '/api/code/compile-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ source_code: code, language_id: langObj.judge0Id }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!_pgEditorInstance || !window.monaco) return;
    var model = _pgEditorInstance.getModel();
    if (!model) return;

    if (data.success && data.has_errors && data.errors && data.errors.length > 0) {
      // Set Monaco markers (red/yellow underlines)
      var markers = data.errors.map(function(err) {
        return {
          severity: err.severity === 'warning' ? window.monaco.MarkerSeverity.Warning : window.monaco.MarkerSeverity.Error,
          startLineNumber: err.line || 1,
          startColumn: err.column || 1,
          endLineNumber: err.line || 1,
          endColumn: (err.column || 1) + 20,
          message: err.message || 'Syntax error',
          source: 'CodingKida Compiler',
        };
      });
      window.monaco.editor.setModelMarkers(model, 'compile-check', markers);
    } else {
      // Clear markers — no errors
      window.monaco.editor.setModelMarkers(model, 'compile-check', []);
    }
  })
  .catch(function() {
    // Silently fail — don't disrupt user
  });
}

// ═══════════════════════════════════════════════════════
// BEST SOLUTION VIEWER + QUALITY COMPARISON
// ═══════════════════════════════════════════════════════

/**
 * Show "View Best Solution" popup for current problem
 */
function codingPgViewBestSolution() {
  if (!_pgActiveProblem) return;

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/coding-problems/best-solution?problemId=' + _pgActiveProblem.id, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success && data.solution) {
      var s = data.solution;
      var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;" id="best-solution-modal" onclick="if(event.target===this)this.remove()">';
      html += '<div style="background:#1a1a2e;border:1px solid rgba(108,71,255,0.3);border-radius:16px;padding:24px;width:600px;max-height:80vh;overflow-y:auto;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
      html += '  <h3 style="color:#fff;font-size:1.1rem;margin:0;">🏆 Best Solution — ' + sanitize(_pgActiveProblem.title) + '</h3>';
      html += '  <button onclick="document.getElementById(\'best-solution-modal\').remove()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;font-size:0.9rem;">✕</button>';
      html += '</div>';
      // Complexity badges
      html += '<div style="display:flex;gap:12px;margin-bottom:14px;">';
      html += '  <span style="font-size:0.78rem;font-weight:700;background:rgba(34,197,94,0.1);color:#22c55e;padding:4px 10px;border-radius:8px;border:1px solid rgba(34,197,94,0.2);">⏱ Time: ' + sanitize(s.timeComplexity) + '</span>';
      html += '  <span style="font-size:0.78rem;font-weight:700;background:rgba(96,165,250,0.1);color:#60a5fa;padding:4px 10px;border-radius:8px;border:1px solid rgba(96,165,250,0.2);">💾 Space: ' + sanitize(s.spaceComplexity) + '</span>';
      html += '  <span style="font-size:0.78rem;font-weight:600;background:rgba(255,255,255,0.05);color:#94a3b8;padding:4px 10px;border-radius:8px;">' + sanitize(s.language).toUpperCase() + '</span>';
      html += '</div>';
      // Code block
      html += '<pre style="background:#0d0b1e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:0.82rem;color:#c4b5fd;overflow-x:auto;white-space:pre-wrap;margin-bottom:14px;">' + sanitize(s.code) + '</pre>';
      // Explanation
      html += '<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:12px 14px;font-size:0.82rem;">';
      html += '  <div style="color:#22c55e;font-weight:700;margin-bottom:6px;font-size:0.72rem;text-transform:uppercase;">Explanation</div>';
      html += '  <div style="color:rgba(255,255,255,0.8);line-height:1.6;">' + sanitize(s.explanation) + '</div>';
      html += '</div>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    } else {
      alert('Best solution not available for this problem yet.');
    }
  })
  .catch(function() { alert('Could not load best solution.'); });
}

/**
 * Compare user's solution quality with best solution
 * Returns: 'green' | 'yellow' | 'red'
 */
function codingPgGetQualityTag(problemId, userTC, userSC) {
  // Simple comparison based on problem's expected TC/SC
  var problem = _pgProblems.find(function(p) { return p.id === problemId; });
  if (!problem || !problem.timeComplexity) return 'yellow';

  var expectedTC = problem.timeComplexity;
  var expectedSC = problem.spaceComplexity;

  // Exact match = green
  if (userTC === expectedTC && userSC === expectedSC) return 'green';

  // Close match (same class) = yellow
  if (userTC === expectedTC || userSC === expectedSC) return 'yellow';

  // Far off = red
  return 'red';
}

// ═══════════════════════════════════════════════════════
// LEADERBOARD + RANKING COINS
// ═══════════════════════════════════════════════════════

/**
 * Submit to per-problem leaderboard after successful submission
 * Awards coins: Top 20 = 20 coins, Rank 21-50 = 10 coins
 */
function codingPgSubmitToLeaderboard(problemId, problemTitle) {
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token || !problemId) return;

  fetch(BASE_URL + '/api/coding-problems/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ problemId: problemId, problemTitle: problemTitle, qualityTag: 'green' }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success && !data.alreadyRanked) {
      var outputEl = document.getElementById('coding-pg-output');
      if (outputEl && data.rank) {
        var rankHtml = '<div style="margin-top:8px;padding:10px 14px;background:rgba(108,71,255,0.1);border:1px solid rgba(108,71,255,0.25);border-radius:10px;font-size:0.82rem;display:flex;align-items:center;justify-content:space-between;">';
        rankHtml += '<span style="color:#a78bfa;font-weight:700;">🏆 Rank #' + data.rank + '</span>';
        if (data.coinsAwarded > 0) {
          rankHtml += '<span style="color:#fbbf24;font-weight:700;">+' + data.coinsAwarded + ' 🪙 coins</span>';
        }
        rankHtml += '</div>';
        outputEl.innerHTML += rankHtml;
      }
    }
  })
  .catch(function() {});
}

/**
 * View leaderboard for current problem (popup)
 */
function codingPgViewLeaderboard() {
  if (!_pgActiveProblem) return;
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  fetch(BASE_URL + '/api/coding-problems/leaderboard?problemId=' + _pgActiveProblem.id, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) { alert('Could not load leaderboard.'); return; }

    var lb = data.leaderboard || [];
    var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;" id="coding-lb-modal" onclick="if(event.target===this)this.remove()">';
    html += '<div style="background:#1a1a2e;border:1px solid rgba(108,71,255,0.3);border-radius:16px;padding:24px;width:450px;max-height:70vh;overflow-y:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '  <h3 style="color:#fff;font-size:1rem;margin:0;">🏆 Leaderboard — ' + sanitize(_pgActiveProblem.title) + '</h3>';
    html += '  <button onclick="document.getElementById(\'coding-lb-modal\').remove()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;">✕</button>';
    html += '</div>';
    html += '<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:12px;">' + data.totalParticipants + ' participants</div>';

    if (lb.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#94a3b8;">No submissions yet. Be the first!</div>';
    } else {
      lb.forEach(function(entry) {
        var rankColor = entry.rank <= 3 ? '#fbbf24' : entry.rank <= 20 ? '#22c55e' : entry.rank <= 50 ? '#60a5fa' : '#94a3b8';
        html += '<div style="display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.05);">';
        html += '  <span style="width:30px;font-size:0.82rem;font-weight:800;color:' + rankColor + ';">#' + entry.rank + '</span>';
        html += '  <span style="flex:1;font-size:0.82rem;color:#fff;font-weight:600;">' + sanitize(entry.name) + '</span>';
        if (entry.coins > 0) html += '<span style="font-size:0.72rem;color:#fbbf24;font-weight:700;">+' + entry.coins + '🪙</span>';
        html += '</div>';
      });
    }
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  })
  .catch(function() { alert('Could not load leaderboard.'); });
}

/**
 * Show leaderboard for any problem by ID (used from Coding Score tab)
 */
function codingPgShowLeaderboard(problemId) {
  if (!problemId) return;
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  // Find problem title from solved list
  var data = codingScoreGet();
  var solvedItem = (data.solvedProblems || []).find(function(p) { return p.problemId === problemId; });
  var title = solvedItem ? solvedItem.title : 'Problem';

  fetch(BASE_URL + '/api/coding-problems/leaderboard?problemId=' + problemId, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!data.success) { alert('Could not load leaderboard.'); return; }

    var lb = data.leaderboard || [];
    var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;" id="coding-lb-modal" onclick="if(event.target===this)this.remove()">';
    html += '<div style="background:#1a1a2e;border:1px solid rgba(108,71,255,0.3);border-radius:16px;padding:24px;width:450px;max-height:70vh;overflow-y:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '  <h3 style="color:#fff;font-size:1rem;margin:0;">🏆 Leaderboard — ' + sanitize(title) + '</h3>';
    html += '  <button onclick="document.getElementById(\'coding-lb-modal\').remove()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;">✕</button>';
    html += '</div>';
    html += '<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:12px;">' + (data.totalParticipants || 0) + ' participants</div>';

    if (lb.length === 0) {
      html += '<div style="text-align:center;padding:30px;color:#94a3b8;">No submissions yet. Be the first!</div>';
    } else {
      lb.forEach(function(entry) {
        var rankColor = entry.rank <= 3 ? '#fbbf24' : entry.rank <= 20 ? '#22c55e' : entry.rank <= 50 ? '#60a5fa' : '#94a3b8';
        html += '<div style="display:flex;align-items:center;padding:8px 12px;margin-bottom:4px;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.05);">';
        html += '  <span style="width:30px;font-size:0.82rem;font-weight:800;color:' + rankColor + ';">#' + entry.rank + '</span>';
        html += '  <span style="flex:1;font-size:0.82rem;color:#fff;font-weight:600;">' + sanitize(entry.name) + '</span>';
        if (entry.coins > 0) html += '<span style="font-size:0.72rem;color:#fbbf24;font-weight:700;">+' + entry.coins + '🪙</span>';
        html += '</div>';
      });
    }
    html += '</div></div>';
    // Remove existing modal if any
    var existing = document.getElementById('coding-lb-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  })
  .catch(function() { alert('Could not load leaderboard.'); });
}
