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
var _pgPreloadedSolution = null; // Pre-loaded best solution for instant view
var _pgUserComplexity = null; // User's code TC/SC from AI analysis
var _pgCursorWidget = null; // Monaco ContentWidget for cursor AI pop-up
var _pgCursorWidgetTimer = null; // Timer for 2-sec pause detection
var _pgCursorWidgetVisible = false; // Whether cursor pop-up is currently visible
var _pgCursorWidgetMinimized = false; // Whether cursor pop-up is minimized by user

// ═══════════════════════════════════════════════════════
// CODE EDITOR THEME — Dark/Light Mode Toggle
// ═══════════════════════════════════════════════════════

/**
 * Initialize code editor theme from localStorage on page load.
 * Applies the saved theme (default: dark) to the coding container.
 */
function codingPgInitTheme() {
  var saved = localStorage.getItem('ck_ce_theme') || 'dark';
  if (saved === 'light') {
    document.documentElement.setAttribute('data-ce-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-ce-theme');
  }
}

/**
 * Toggle between dark and light mode for the code editor section.
 * Persists preference in localStorage and updates Monaco theme.
 */
function codingPgToggleTheme() {
  var isLight = document.documentElement.getAttribute('data-ce-theme') === 'light';
  var newTheme = isLight ? 'dark' : 'light';

  if (newTheme === 'light') {
    document.documentElement.setAttribute('data-ce-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-ce-theme');
  }

  localStorage.setItem('ck_ce_theme', newTheme);

  // Update Monaco editor theme
  if (_pgEditorInstance && window.monaco) {
    window.monaco.editor.setTheme(newTheme === 'light' ? 'ck-light' : 'ck-dark');
  }

  // Update all lesson-tab editors too
  if (typeof _codingEditors !== 'undefined') {
    Object.keys(_codingEditors).forEach(function(key) {
      if (_codingEditors[key] && window.monaco) {
        window.monaco.editor.setTheme(newTheme === 'light' ? 'ck-light' : 'ck-dark');
      }
    });
  }

  // Update button icon + label
  var icon = document.getElementById('coding-pg-theme-icon');
  var label = document.getElementById('coding-pg-theme-label');
  if (icon) icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
  if (label) label.textContent = newTheme === 'light' ? 'Light' : 'Dark';
}

// Apply saved theme immediately on script load
codingPgInitTheme();

// ═══════════════════════════════════════════════════════
// INITIALIZATION — called when page navigates to 'coding'
// ═══════════════════════════════════════════════════════

function codingPgInit() {
  codingPgLoadProblems();
  codingPgLoadMyProblems();
  // Pre-load Monaco editor in background so it's instant when problem is selected
  if (typeof loadMonacoEditor === 'function') {
    loadMonacoEditor().catch(function() {});
  }
}

/**
 * Load problems from API (uses pre-cached data if available for instant load)
 */
function codingPgLoadProblems() {
  var listEl = document.getElementById('coding-pg-list');
  if (!listEl) return;

  // Check localStorage cache (pre-fetched on dashboard load)
  try {
    var cached = localStorage.getItem('ck_coding_problems_cache');
    if (cached) {
      var data = JSON.parse(cached);
      if (data.success && data.problems && data.problems.length > 0) {
        _pgProblems = data.problems;
        var catFilter = document.getElementById('coding-pg-cat-filter');
        if (catFilter && data.categories) {
          catFilter.innerHTML = '<option value="all">All Categories</option>';
          data.categories.forEach(function(cat) {
            catFilter.innerHTML += '<option value="' + cat + '">' + cat + '</option>';
          });
        }
        localStorage.removeItem('ck_coding_problems_cache'); // Clear after use
        codingPgRenderList();
        return;
      }
    }
  } catch(e) {}

  // Fallback: fetch from API (shows loading state)
  fetch(BASE_URL + '/api/coding-problems')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.success) {
        _pgProblems = data.problems || [];
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
  var inactiveColor = getComputedStyle(document.documentElement).getPropertyValue('--ce-text-muted').trim() || '#94a3b8';
  
  if (tabAll) { tabAll.style.color = tab === 'all' ? '#a78bfa' : inactiveColor; tabAll.style.borderBottomColor = tab === 'all' ? '#a78bfa' : 'transparent'; }
  if (tabMy) { tabMy.style.color = tab === 'my' ? '#a78bfa' : inactiveColor; tabMy.style.borderBottomColor = tab === 'my' ? '#a78bfa' : 'transparent'; }
  if (tabScore) { tabScore.style.color = tab === 'score' ? '#a78bfa' : inactiveColor; tabScore.style.borderBottomColor = tab === 'score' ? '#a78bfa' : 'transparent'; }

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
    leftPanel.style.borderRight = '1px solid var(--ce-toolbar-border)';
  } else {
    leftPanel.style.width = '0';
    leftPanel.style.minWidth = '0';
    leftPanel.style.padding = '0';
    leftPanel.style.overflow = 'hidden';
    leftPanel.style.borderRight = 'none';
  }
}

/**
 * Toggle description panel visibility
 */
function codingPgToggleDescPanel() {
  var descPanel = document.getElementById('coding-pg-desc-panel');
  var resizeHandle = document.getElementById('coding-pg-vresize');
  if (!descPanel) return;
  var isHidden = descPanel.style.display === 'none';
  if (isHidden) {
    descPanel.style.display = '';
    descPanel.style.width = '38%';
    descPanel.style.minWidth = '150px';
    if (resizeHandle) resizeHandle.style.display = '';
  } else {
    descPanel.style.display = 'none';
    if (resizeHandle) resizeHandle.style.display = 'none';
  }
  if (_pgEditorInstance) {
    setTimeout(function() { _pgEditorInstance.layout(); }, 50);
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
  html += '    <span style="font-size:0.7rem;color:var(--ce-text-muted);background:var(--ce-card-bg);padding:2px 8px;border-radius:6px;border:1px solid var(--ce-card-border);">' + sanitize(problem.category) + '</span>';
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
      html += '<div style="flex:1;background:var(--ce-card-bg);border:1px solid var(--ce-card-border);border-radius:10px;padding:10px 12px;">';
      html += '  <div style="font-size:0.7rem;font-weight:700;color:var(--ce-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Input Format</div>';
      html += '  <pre style="font-size:0.78rem;color:var(--ce-text);white-space:pre-wrap;margin:0;opacity:0.85;">' + sanitize(problem.inputFormat) + '</pre>';
      html += '</div>';
    }
    if (problem.outputFormat) {
      html += '<div style="flex:1;background:var(--ce-card-bg);border:1px solid var(--ce-card-border);border-radius:10px;padding:10px 12px;">';
      html += '  <div style="font-size:0.7rem;font-weight:700;color:var(--ce-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Output Format</div>';
      html += '  <pre style="font-size:0.78rem;color:var(--ce-text);white-space:pre-wrap;margin:0;opacity:0.85;">' + sanitize(problem.outputFormat) + '</pre>';
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
    html += '  <div style="color:var(--ce-text);opacity:0.85;">' + sanitize(problem.explanation) + '</div>';
    html += '</div>';
  }

  // Tags
  if (problem.tags && problem.tags.length > 0) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">';
    problem.tags.forEach(function(tag) {
      html += '<span style="font-size:0.68rem;font-weight:600;background:var(--ce-card-bg);color:var(--ce-text-muted);padding:3px 8px;border-radius:6px;border:1px solid var(--ce-card-border);">#' + sanitize(tag) + '</span>';
    });
    html += '</div>';
  }

  // Constraints + Complexity
  if (problem.constraints || problem.timeComplexity || problem.spaceComplexity) {
    html += '<div style="background:rgba(108,71,255,0.06);border:1px solid rgba(108,71,255,0.15);border-radius:10px;padding:12px 14px;margin-top:10px;font-size:0.8rem;">';
    if (problem.constraints) {
      html += '<div style="color:#a78bfa;font-weight:700;margin-bottom:6px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.5px;">Constraints</div>';
      html += '<div style="color:var(--ce-text);opacity:0.85;white-space:pre-wrap;margin-bottom:8px;">' + sanitize(problem.constraints) + '</div>';
    }
    if (problem.timeComplexity || problem.spaceComplexity) {
      html += '<div style="display:flex;gap:16px;padding-top:6px;border-top:1px solid var(--ce-card-border);">';
      if (problem.timeComplexity) html += '<span style="color:#22c55e;font-size:0.72rem;font-weight:600;">⏱ Expected: ' + sanitize(problem.timeComplexity) + '</span>';
      if (problem.spaceComplexity) html += '<span style="color:#60a5fa;font-size:0.72rem;font-weight:600;">💾 Space: ' + sanitize(problem.spaceComplexity) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }

  html += '</div>'; // End left panel

  // ── Resize Handle (Description ↔ Editor) — vertical drag ──
  html += '<div id="coding-pg-vresize" style="flex:none;width:5px;cursor:col-resize;background:var(--ce-resize-bg);border-left:1px solid var(--ce-toolbar-border);border-right:1px solid var(--ce-toolbar-border);" onmouseenter="this.style.background=\'rgba(108,71,255,0.5)\'" onmouseleave="this.style.background=\'var(--ce-resize-bg)\'" onmousedown="codingPgStartResize(event)"></div>';

  // ═══ RIGHT: Code Editor ═══
  html += '<div style="flex:1;min-width:0;width:0;display:flex;flex-direction:column;overflow:hidden;padding-left:4px;">';

  // Toolbar with toggle button
  html += '<div class="coding-toolbar">';
  html += '  <div class="coding-toolbar-left">';
  html += '    <button class="coding-toolbar-btn coding-toolbar-btn--problems" onclick="codingPgToggleLeftPanel()" title="Toggle Problem List (Ctrl+B)"><i class="fas fa-bars"></i> Problems</button>';
  html += '    <button class="coding-toolbar-btn coding-toolbar-btn--desc" onclick="codingPgToggleDescPanel()" title="Toggle Description Panel"><i class="fas fa-file-alt"></i> Desc</button>';
  html += '    <select id="coding-pg-lang" class="coding-lang-select" onchange="codingPgChangeLang()">';
  CODING_LANGUAGES.forEach(function(lang) {
    var sel = lang.id === defaultLang ? ' selected' : '';
    html += '<option value="' + lang.id + '"' + sel + '>' + lang.icon + ' ' + lang.label + '</option>';
  });
  html += '    </select>';
  html += '  </div>';
  html += '  <div class="coding-toolbar-right">';
  html += '    <button class="coding-toolbar-btn coding-toolbar-btn--format" onclick="codingPgFormatCode()" title="Format Code (Ctrl+Shift+F)"><i class="fas fa-magic"></i> Format</button>';
  html += '    <div id="coding-pg-ai-dropdown-wrap" style="position:relative;display:inline-block;">';
  html += '      <button id="coding-pg-ai-dropdown-btn" class="coding-toolbar-btn coding-toolbar-btn--ai" onclick="codingPgToggleAIDropdown()" title="AI Assist (Hints, Algorithm, Solution)"><i class="fas fa-robot"></i> AI ▾</button>';
  html += '      <div id="coding-pg-ai-dropdown-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:var(--ce-dropdown-bg);border:1px solid rgba(108,71,255,0.3);border-radius:10px;min-width:180px;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,0.5);overflow:hidden;">';
  html += '        <div onclick="codingPgAIHints()" style="padding:10px 14px;color:var(--ce-text);font-size:0.78rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(108,71,255,0.15)\'" onmouseout="this.style.background=\'transparent\'"><i class="fas fa-lightbulb" style="color:#fbbf24;"></i> Hints</div>';
  html += '        <div onclick="codingPgAIAlgorithm()" style="padding:10px 14px;color:var(--ce-text);font-size:0.78rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background 0.15s;border-top:1px solid var(--ce-card-border);" onmouseover="this.style.background=\'rgba(108,71,255,0.15)\'" onmouseout="this.style.background=\'transparent\'"><i class="fas fa-project-diagram" style="color:#60a5fa;"></i> Algorithm</div>';
  html += '        <div onclick="codingPgAIOptimalSolution()" style="padding:10px 14px;color:var(--ce-text);font-size:0.78rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background 0.15s;border-top:1px solid var(--ce-card-border);" onmouseover="this.style.background=\'rgba(108,71,255,0.15)\'" onmouseout="this.style.background=\'transparent\'"><i class="fas fa-code" style="color:#22c55e;"></i> Optimal Solution</div>';
  html += '      </div>';
  html += '    </div>';
  html += '    <button id="coding-pg-bottom-toggle-btn" class="coding-toolbar-btn coding-toolbar-btn--panel" onclick="codingPgToggleBottomPanel()" title="Toggle Bottom Panel"><i class="fas fa-chevron-down" id="coding-pg-toggle-icon"></i> <span id="coding-pg-toggle-text">Hide Panel</span></button>';
  html += '    <button id="coding-pg-theme-btn" class="coding-toolbar-btn coding-toolbar-btn--mode" onclick="codingPgToggleTheme()" title="Toggle Dark/Light Mode"><i class="' + (document.documentElement.getAttribute('data-ce-theme') === 'light' ? 'fas fa-sun' : 'fas fa-moon') + '" id="coding-pg-theme-icon"></i> <span id="coding-pg-theme-label">' + (document.documentElement.getAttribute('data-ce-theme') === 'light' ? 'Light' : 'Dark') + '</span></button>';
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

    // Define custom dark theme with pure black background (only once)
    if (!window._ckMonacoThemesDefined) {
      monaco.editor.defineTheme('ck-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#000000',
          'editorGutter.background': '#000000',
          'editorLineNumber.foreground': '#555555',
          'editorLineNumber.activeForeground': '#888888',
        }
      });
      monaco.editor.defineTheme('ck-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
        }
      });
      window._ckMonacoThemesDefined = true;
    }

    // Restore saved code or use starter
    var problemId = _pgActiveProblem ? _pgActiveProblem.id : '';
    var savedCode = pgRestoreCode(problemId, langId);
    var initialCode = savedCode !== null ? savedCode : (starterCode || getDefaultStarter(langId));

    _pgEditorInstance = monaco.editor.create(container, {
      value: initialCode,
      language: langObj.monacoId,
      theme: document.documentElement.getAttribute('data-ce-theme') === 'light' ? 'ck-light' : 'ck-dark',
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
      quickSuggestions: false,
    });

    // Auto-save code on change + trigger compile check
    _pgEditorInstance.onDidChangeModelContent(function() {
      var pid = _pgActiveProblem ? _pgActiveProblem.id : '';
      var select = document.getElementById('coding-pg-lang');
      var lid = select ? select.value : langId;
      if (pid) pgSaveCode(pid, lid, _pgEditorInstance.getValue());
      // Real-time syntax error detection (debounced)
      codingPgScheduleCompileCheck();
      // Reset cursor widget timer on typing (user is active)
      _pgResetCursorWidgetTimer();
    });

    // Register cursor position change listener for AI pop-up widget
    _pgEditorInstance.onDidChangeCursorPosition(function(e) {
      var el = document.getElementById('coding-pg-cursor');
      if (el) el.textContent = 'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
      // Reset cursor widget timer when cursor moves
      _pgResetCursorWidgetTimer();
    });

    // Pre-load best solution for this problem (so AI features are instant)
    _pgPreloadBestSolution();
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
      // Trigger TC/SC analysis in background (non-blocking)
      codingPgAnalyzeComplexity(code, langId);
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

  // Pre-load best solution in background (so it's instant when user clicks "View Solution")
  _pgPreloadedSolution = null;
  fetch(BASE_URL + '/api/coding-problems/best-solution?problemId=' + _pgActiveProblem.id, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success && d.solution) _pgPreloadedSolution = d.solution;
  }).catch(function() {});

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

        // Trigger TC/SC analysis after every submit (shows user's complexity in output)
        codingPgAnalyzeComplexity(code, langId);

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
 * Analyze user's code time/space complexity using AI
 * Appends result to output panel (non-blocking)
 */
function codingPgAnalyzeComplexity(code, langId) {
  if (!code || code.trim().length < 10) return;
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';

  // Use Gemini via backend proxy to analyze code complexity
  fetch(BASE_URL + '/api/code/analyze-complexity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ code: code, language: langId }),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success && data.timeComplexity && data.spaceComplexity) {
      _pgUserComplexity = { tc: data.timeComplexity, sc: data.spaceComplexity };
      var outputEl = document.getElementById('coding-pg-output');
      if (outputEl) {
        var badge = '<div style="display:flex;gap:10px;margin-top:8px;padding:6px 10px;background:rgba(108,71,255,0.06);border:1px solid rgba(108,71,255,0.15);border-radius:8px;">';
        badge += '<span style="font-size:0.72rem;color:#a78bfa;font-weight:600;">📊 TC: ' + sanitize(data.timeComplexity) + '</span>';
        badge += '<span style="font-size:0.72rem;color:#f59e0b;font-weight:600;">📊 SC: ' + sanitize(data.spaceComplexity) + '</span>';
        badge += '</div>';
        outputEl.innerHTML += badge;
      }
    }
  })
  .catch(function() {}); // Silently fail — non-critical feature
}

/**
 * Toggle bottom panel (Custom Input / Output / Submission History)
 * When hidden, code editor takes full height
 */
function codingPgToggleBottomPanel() {
  _pgBottomPanelVisible = !_pgBottomPanelVisible;
  var bottomPanel = document.getElementById('coding-pg-bottom-panels');
  var toggleText = document.getElementById('coding-pg-toggle-text');
  var toggleIcon = document.getElementById('coding-pg-toggle-icon');
  if (bottomPanel) {
    bottomPanel.style.display = _pgBottomPanelVisible ? '' : 'none';
  }
  if (toggleText) {
    toggleText.textContent = _pgBottomPanelVisible ? 'Hide Panel' : 'Show Panel';
  }
  if (toggleIcon) {
    toggleIcon.className = _pgBottomPanelVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
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
    container.innerHTML = '<span style="color:var(--ce-text-muted);font-size:0.78rem;font-style:italic;">No submissions yet.</span>';
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

    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;margin-bottom:4px;background:var(--ce-card-bg);border:1px solid var(--ce-card-border);border-radius:8px;">';
    html += '  <span style="font-size:0.78rem;font-weight:700;color:' + statusColor + ';">' + statusIcon + ' ' + statusText + '</span>';
    html += '  <span style="font-size:0.7rem;color:var(--ce-text-muted);display:flex;align-items:center;gap:8px;">';
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
  html += '  <div style="font-size:1.8rem;font-weight:800;color:var(--ce-text);">' + totalPoints + '</div>';
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
  html += '<div style="margin:0 4px 12px;padding:12px;background:var(--ce-card-bg);border:1px solid var(--ce-card-border);border-radius:12px;">';
  html += '  <div style="font-size:0.78rem;font-weight:700;color:var(--ce-text);margin-bottom:10px;">' + totalSubs + ' Submissions in ' + year + '</div>';
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
    html += '<div style="text-align:center;padding:30px;color:var(--ce-text-muted);"><div style="font-size:1.5rem;margin-bottom:8px;">📊</div><div style="font-size:0.82rem;">No problems solved yet.<br>Start solving to earn points!</div></div>';
  } else {
    html += '<div style="font-size:0.75rem;font-weight:700;color:var(--ce-text-muted);padding:4px 8px;margin-bottom:6px;">Solved Problems (' + solved.length + ')</div>';
    // Sort by most recent first
    var sortedSolved = solved.slice().sort(function(a, b) { return new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime(); });
    sortedSolved.forEach(function(s) {
      var diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
      var dc = diffColors[s.difficulty] || '#f59e0b';
      var dateStr = new Date(s.solvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      html += '<div style="padding:10px 12px;margin:0 4px 6px;background:var(--ce-card-bg);border:1px solid var(--ce-card-border);border-radius:10px;">';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">';
      html += '    <span style="font-size:0.8rem;font-weight:700;color:var(--ce-text);">✅ ' + sanitize(s.title) + '</span>';
      html += '    <span style="font-size:0.65rem;font-weight:700;padding:2px 6px;border-radius:8px;background:' + dc + '20;color:' + dc + ';border:1px solid ' + dc + '40;">' + s.difficulty.toUpperCase() + '</span>';
      html += '  </div>';
      html += '  <div style="display:flex;align-items:center;justify-content:space-between;">';
      html += '    <div style="display:flex;align-items:center;gap:10px;font-size:0.7rem;color:var(--ce-text-muted);">';
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

  // Use pre-loaded solution if available (instant display)
  if (_pgPreloadedSolution) {
    _pgRenderBestSolutionPopup(_pgPreloadedSolution);
    return;
  }

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/coding-problems/best-solution?problemId=' + _pgActiveProblem.id, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success && data.solution) {
      _pgRenderBestSolutionPopup(data.solution);
    } else {
      alert('Best solution not available for this problem yet.');
    }
  })
  .catch(function() { alert('Could not load best solution.'); });
}

/**
 * Render best solution popup (reused by pre-loaded and fetched paths)
 */
function _pgRenderBestSolutionPopup(s) {
  var html = '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;" id="best-solution-modal" onclick="if(event.target===this)this.remove()">';
  html += '<div style="background:#1a1a2e;border:1px solid rgba(108,71,255,0.3);border-radius:16px;padding:24px;width:650px;max-height:80vh;overflow-y:auto;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
  html += '  <h3 style="color:#fff;font-size:1.1rem;margin:0;">🏆 Best Solution — ' + sanitize(_pgActiveProblem.title) + '</h3>';
  html += '  <button onclick="document.getElementById(\'best-solution-modal\').remove()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:28px;height:28px;color:#fff;cursor:pointer;font-size:0.9rem;">✕</button>';
  html += '</div>';

  // Multi-language tabs (if solution has multiple languages)
  var languages = ['c', 'java', 'python', 'javascript'];
  var activeLang = (typeof s.language === 'string') ? s.language : 'c';
  var multiLang = (s.c || s.java || s.python || s.javascript) ? true : false;

  if (multiLang) {
    html += '<div style="display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:8px;">';
    languages.forEach(function(lang) {
      var sol = s[lang];
      if (!sol) return;
      var isActive = lang === activeLang;
      html += '<button onclick="codingPgSwitchSolutionLang(\'' + lang + '\')" class="sol-lang-tab" data-lang="' + lang + '" style="padding:5px 12px;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;border:1px solid ' + (isActive ? 'rgba(108,71,255,0.5)' : 'rgba(255,255,255,0.1)') + ';background:' + (isActive ? 'rgba(108,71,255,0.2)' : 'rgba(255,255,255,0.03)') + ';color:' + (isActive ? '#a78bfa' : '#94a3b8') + ';">' + lang.toUpperCase() + '</button>';
    });
    html += '</div>';
    // Render each language solution (hidden by default except active)
    languages.forEach(function(lang) {
      var sol = s[lang];
      if (!sol) return;
      var isActive = lang === activeLang;
      html += '<div class="sol-lang-content" data-lang="' + lang + '" style="display:' + (isActive ? 'block' : 'none') + ';">';
      html += '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">';
      html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(34,197,94,0.1);color:#22c55e;padding:3px 8px;border-radius:6px;border:1px solid rgba(34,197,94,0.2);">⏱ Best TC: ' + sanitize(sol.timeComplexity || sol.tc || '?') + '</span>';
      html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(96,165,250,0.1);color:#60a5fa;padding:3px 8px;border-radius:6px;border:1px solid rgba(96,165,250,0.2);">💾 Best SC: ' + sanitize(sol.spaceComplexity || sol.sc || '?') + '</span>';
      if (_pgUserComplexity) {
        html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(245,158,11,0.1);color:#fbbf24;padding:3px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.2);">👤 Your TC: ' + sanitize(_pgUserComplexity.tc) + '</span>';
        html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(245,158,11,0.1);color:#fbbf24;padding:3px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.2);">👤 Your SC: ' + sanitize(_pgUserComplexity.sc) + '</span>';
      }
      html += '</div>';
      html += '<pre style="background:#0d0b1e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:0.82rem;color:#e2e8f0;overflow-x:auto;white-space:pre-wrap;margin-bottom:10px;">' + sanitize(sol.code || '') + '</pre>';
      html += '<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:10px 12px;font-size:0.8rem;">';
      html += '  <div style="color:#22c55e;font-weight:700;margin-bottom:4px;font-size:0.7rem;text-transform:uppercase;">Explanation</div>';
      html += '  <div style="color:rgba(255,255,255,0.8);line-height:1.5;">' + sanitize(sol.explanation || '') + '</div>';
      html += '</div>';
      html += '</div>';
    });
  } else {
    // Single language (backward compatible)
    html += '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
    html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(34,197,94,0.1);color:#22c55e;padding:3px 8px;border-radius:6px;border:1px solid rgba(34,197,94,0.2);">⏱ Best TC: ' + sanitize(s.timeComplexity) + '</span>';
    html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(96,165,250,0.1);color:#60a5fa;padding:3px 8px;border-radius:6px;border:1px solid rgba(96,165,250,0.2);">💾 Best SC: ' + sanitize(s.spaceComplexity) + '</span>';
    html += '  <span style="font-size:0.72rem;font-weight:600;background:rgba(255,255,255,0.05);color:#94a3b8;padding:3px 8px;border-radius:6px;">' + sanitize(s.language || 'c').toUpperCase() + '</span>';
    if (_pgUserComplexity) {
      html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(245,158,11,0.1);color:#fbbf24;padding:3px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.2);">👤 Your TC: ' + sanitize(_pgUserComplexity.tc) + '</span>';
      html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(245,158,11,0.1);color:#fbbf24;padding:3px 8px;border-radius:6px;border:1px solid rgba(245,158,11,0.2);">👤 Your SC: ' + sanitize(_pgUserComplexity.sc) + '</span>';
    }
    html += '</div>';
    html += '<pre style="background:#0d0b1e;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;font-family:\'JetBrains Mono\',monospace;font-size:0.82rem;color:#e2e8f0;overflow-x:auto;white-space:pre-wrap;margin-bottom:14px;">' + sanitize(s.code) + '</pre>';
    html += '<div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:12px 14px;font-size:0.82rem;">';
    html += '  <div style="color:#22c55e;font-weight:700;margin-bottom:6px;font-size:0.72rem;text-transform:uppercase;">Explanation</div>';
    html += '  <div style="color:rgba(255,255,255,0.8);line-height:1.6;">' + sanitize(s.explanation) + '</div>';
    html += '</div>';
  }

  html += '</div></div>';
  // Remove existing modal if any
  var existing = document.getElementById('best-solution-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * Switch language tab in best solution popup
 */
function codingPgSwitchSolutionLang(lang) {
  var tabs = document.querySelectorAll('.sol-lang-tab');
  var contents = document.querySelectorAll('.sol-lang-content');
  tabs.forEach(function(tab) {
    var isActive = tab.getAttribute('data-lang') === lang;
    tab.style.background = isActive ? 'rgba(108,71,255,0.2)' : 'rgba(255,255,255,0.03)';
    tab.style.borderColor = isActive ? 'rgba(108,71,255,0.5)' : 'rgba(255,255,255,0.1)';
    tab.style.color = isActive ? '#a78bfa' : '#94a3b8';
  });
  contents.forEach(function(c) {
    c.style.display = c.getAttribute('data-lang') === lang ? 'block' : 'none';
  });
}

/**
 * Syntax highlight code for best solution display
 * Makes comments grey/italic, keywords blue, strings green, numbers orange
 */
function _pgHighlightCode(code) {
  if (!code) return '';
  // Escape only < and > for safety (not quotes — we need them for display)
  var safe = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Highlight multi-line comments (/* ... */) FIRST
  safe = safe.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6b7280;font-style:italic;">$1</span>');
  // Highlight single-line comments (// ...)
  safe = safe.replace(/(\/\/[^\n]*)/g, '<span style="color:#6b7280;font-style:italic;">$1</span>');
  // Highlight Python/shell comments (# ...) — but not #include/#define
  safe = safe.replace(/^(#(?!include|define|pragma)[^\n]*)/gm, '<span style="color:#6b7280;font-style:italic;">$1</span>');
  // Highlight preprocessor (#include, #define)
  safe = safe.replace(/^(#(?:include|define|pragma)[^\n]*)/gm, '<span style="color:#c084fc;">$1</span>');
  // Highlight strings ("..." and '...')
  safe = safe.replace(/("(?:[^"\\]|\\.)*")/g, '<span style="color:#22c55e;">$1</span>');
  safe = safe.replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#22c55e;">$1</span>');
  // Highlight keywords
  var keywords = 'int|char|float|double|void|return|if|else|for|while|do|switch|case|break|continue|struct|typedef|const|static|import|class|public|private|protected|new|this|extends|implements|try|catch|finally|throw|boolean|long|short|null|true|false|def|print|input|lambda|from|as|in|not|and|or|is|None|True|False|let|var|const|function|require|console|String|Scanner|System|println|printf|scanf|main|sizeof|malloc|free|unsigned';
  safe = safe.replace(new RegExp('\\b(' + keywords + ')\\b', 'g'), '<span style="color:#60a5fa;font-weight:600;">$1</span>');
  // Highlight numbers
  safe = safe.replace(/\b(\d+)\b/g, '<span style="color:#f59e0b;">$1</span>');
  return safe;
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

// ═══════════════════════════════════════════════════════
// AI DROPDOWN + CURSOR WIDGET (Pre-loaded Best Solution based)
// Zero API calls — all derived from _pgPreloadedSolution
// ═══════════════════════════════════════════════════════

/**
 * Pre-load best solution for current problem (called on problem select)
 * Ensures _pgPreloadedSolution is ready for instant AI features
 */
function _pgPreloadBestSolution() {
  if (!_pgActiveProblem) return;
  _pgPreloadedSolution = null;
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/coding-problems/best-solution?problemId=' + _pgActiveProblem.id, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success && d.solution) _pgPreloadedSolution = d.solution;
  }).catch(function() {});
}

/**
 * Get the currently selected language's best solution code
 * Returns the code string or null if not available
 */
function _pgGetCurrentLangSolution() {
  if (!_pgPreloadedSolution) return null;
  var select = document.getElementById('coding-pg-lang');
  var langId = select ? select.value : 'c';
  var sol = _pgPreloadedSolution[langId];
  if (sol && sol.code) return sol.code;
  // Fallback: if solution is in old single-language format
  if (_pgPreloadedSolution.code && _pgPreloadedSolution.language === langId) return _pgPreloadedSolution.code;
  return null;
}

/**
 * Get the currently selected language's solution object (code + TC/SC + explanation)
 */
function _pgGetCurrentLangSolutionObj() {
  if (!_pgPreloadedSolution) return null;
  var select = document.getElementById('coding-pg-lang');
  var langId = select ? select.value : 'c';
  var sol = _pgPreloadedSolution[langId];
  if (sol && sol.code) return sol;
  // Fallback single-language format
  if (_pgPreloadedSolution.code && _pgPreloadedSolution.language === langId) return _pgPreloadedSolution;
  return null;
}

/**
 * Toggle AI dropdown menu visibility
 */
function codingPgToggleAIDropdown() {
  var menu = document.getElementById('coding-pg-ai-dropdown-menu');
  if (!menu) return;
  var isVisible = menu.style.display !== 'none';
  menu.style.display = isVisible ? 'none' : 'block';
  // Close dropdown when clicking outside
  if (!isVisible) {
    setTimeout(function() {
      function closeHandler(e) {
        var wrap = document.getElementById('coding-pg-ai-dropdown-wrap');
        if (wrap && !wrap.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeHandler);
        }
      }
      document.addEventListener('click', closeHandler);
    }, 10);
  }
}

/**
 * AI Dropdown → Hints
 * Extracts key logic points from the pre-loaded optimal solution
 * Shows hints in a popup panel below toolbar (no API call)
 */
function codingPgAIHints() {
  // Close dropdown
  var menu = document.getElementById('coding-pg-ai-dropdown-menu');
  if (menu) menu.style.display = 'none';

  var sol = _pgGetCurrentLangSolutionObj();
  if (!sol) {
    _pgShowAIPanel('💡 Hints', '<div style="color:#f59e0b;">Best solution not loaded yet. Please wait a moment and try again.</div>');
    return;
  }

  // Extract hints from the solution code by analyzing key patterns
  var code = sol.code || '';
  var hints = _pgExtractHints(code);
  var langId = (document.getElementById('coding-pg-lang') || {}).value || 'c';

  var html = '';
  html += '<div style="font-size:0.72rem;color:#94a3b8;margin-bottom:8px;">Based on optimal ' + langId.toUpperCase() + ' solution:</div>';
  hints.forEach(function(hint, i) {
    html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;padding:8px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.15);border-radius:8px;">';
    html += '  <span style="color:#fbbf24;font-weight:800;font-size:0.75rem;min-width:18px;">' + (i + 1) + '.</span>';
    html += '  <span style="color:#e2e8f0;font-size:0.78rem;line-height:1.5;">' + sanitize(hint) + '</span>';
    html += '</div>';
  });

  // Add TC/SC hint
  if (sol.timeComplexity || sol.tc) {
    html += '<div style="margin-top:10px;padding:8px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:8px;font-size:0.75rem;color:#22c55e;font-weight:600;">';
    html += '⏱ Target TC: ' + sanitize(sol.timeComplexity || sol.tc || '?') + ' | 💾 Target SC: ' + sanitize(sol.spaceComplexity || sol.sc || '?');
    html += '</div>';
  }

  _pgShowAIPanel('💡 Hints', html);
}

/**
 * Extract hints from solution code (pattern-based, no API)
 * Analyzes code structure to give useful hints without revealing full solution
 */
function _pgExtractHints(code) {
  if (!code) return ['Think about the problem step by step.'];
  var hints = [];
  var lines = code.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l && !l.startsWith('//') && !l.startsWith('#') && !l.startsWith('/*'); });

  // Detect data structures used
  if (/\bMap\b|\bHashMap\b|\bdict\b|\bunordered_map\b|\bmap\[/.test(code)) hints.push('Consider using a Hash Map/Dictionary for O(1) lookups.');
  if (/\bSet\b|\bHashSet\b|\bset\(\)|\bunordered_set\b/.test(code)) hints.push('A Set can help track unique elements efficiently.');
  if (/\bStack\b|\bstack\b|\bLifoQueue\b|\bpush\b.*\bpop\b/.test(code)) hints.push('A Stack (LIFO) structure might be useful here.');
  if (/\bQueue\b|\bqueue\b|\bdeque\b|\bLinkedList\b/.test(code)) hints.push('Think about using a Queue (FIFO) for processing order.');
  if (/\bPriorityQueue\b|\bheapq\b|\bheap\b/.test(code)) hints.push('A Priority Queue/Heap can optimize finding min/max efficiently.');

  // Detect algorithm patterns
  if (/\bsort\b|\bArrays\.sort\b|\bsorted\b/.test(code)) hints.push('Sorting the input first might simplify the problem.');
  if (/while.*left.*right|while.*lo.*hi|while.*start.*end/.test(code)) hints.push('Two-pointer or Binary Search technique could work here.');
  if (/function.*\(.*\).*\{[\s\S]*function.*\(|def.*:[\s\S]*def.*:|\brecur/.test(code) || /\(.*n\s*-\s*1\)|\(.*n\s*\/\s*2\)/.test(code)) hints.push('This problem might benefit from a recursive/divide-and-conquer approach.');
  if (/\bdp\b|\bmemo\b|\bcache\b|\btabulation\b/.test(code)) hints.push('Dynamic Programming (memoization/tabulation) is key to optimal solution.');
  if (/for.*for|while.*while/.test(code) && !/\bdp\b/.test(code)) hints.push('Nested iteration is used — think about optimizing inner loop.');
  if (/Math\.max|Math\.min|max\(|min\(|fmax|fmin/.test(code)) hints.push('Track running maximum/minimum values as you iterate.');
  if (/\bswap\b|temp\s*=/.test(code)) hints.push('In-place swapping technique is part of the solution.');
  if (/\bXOR\b|\^=|\^\s/.test(code)) hints.push('XOR bitwise operation has a useful property here.');
  if (/\.length|\.size|len\(/.test(code) && /\-\s*1/.test(code)) hints.push('Pay attention to array bounds (length - 1).');

  // If no specific hints detected, give general structural hints
  if (hints.length === 0) {
    var loopCount = (code.match(/\bfor\b|\bwhile\b/g) || []).length;
    if (loopCount === 1) hints.push('A single pass through the data is sufficient.');
    else if (loopCount === 2) hints.push('Two passes (or a nested structure) are needed.');
    hints.push('Break the problem into smaller sub-problems.');
    hints.push('Think about edge cases: empty input, single element, duplicates.');
  }

  // Always add a general approach hint
  if (hints.length < 4) {
    hints.push('Read input carefully and handle edge cases first.');
  }

  return hints.slice(0, 5); // Max 5 hints
}

/**
 * AI Dropdown → Algorithm
 * Identifies and explains the algorithm used in the best solution
 * No API call — pure code analysis of pre-loaded solution
 */
function codingPgAIAlgorithm() {
  // Close dropdown
  var menu = document.getElementById('coding-pg-ai-dropdown-menu');
  if (menu) menu.style.display = 'none';

  var sol = _pgGetCurrentLangSolutionObj();
  if (!sol) {
    _pgShowAIPanel('🔬 Algorithm', '<div style="color:#f59e0b;">Best solution not loaded yet. Please wait a moment and try again.</div>');
    return;
  }

  var code = sol.code || '';
  var algo = _pgDetectAlgorithm(code);
  var langId = (document.getElementById('coding-pg-lang') || {}).value || 'c';

  var html = '';
  html += '<div style="font-size:0.72rem;color:#94a3b8;margin-bottom:10px;">Algorithm used in optimal ' + langId.toUpperCase() + ' solution:</div>';

  // Algorithm name badge
  html += '<div style="display:inline-block;padding:6px 14px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.3);border-radius:8px;color:#60a5fa;font-size:0.85rem;font-weight:700;margin-bottom:12px;">' + sanitize(algo.name) + '</div>';

  // Algorithm explanation
  html += '<div style="padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:10px;">';
  html += '  <div style="color:#e2e8f0;font-size:0.8rem;line-height:1.6;">' + sanitize(algo.explanation) + '</div>';
  html += '</div>';

  // Step-by-step breakdown
  if (algo.steps && algo.steps.length > 0) {
    html += '<div style="font-size:0.72rem;font-weight:700;color:#a78bfa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Step-by-Step:</div>';
    algo.steps.forEach(function(step, i) {
      html += '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;padding:6px 10px;background:rgba(108,71,255,0.05);border-radius:6px;">';
      html += '  <span style="color:#a78bfa;font-weight:800;font-size:0.72rem;min-width:20px;">→</span>';
      html += '  <span style="color:rgba(255,255,255,0.85);font-size:0.76rem;line-height:1.4;">' + sanitize(step) + '</span>';
      html += '</div>';
    });
  }

  // Complexity info
  html += '<div style="margin-top:10px;display:flex;gap:10px;">';
  html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(34,197,94,0.1);color:#22c55e;padding:4px 10px;border-radius:6px;">⏱ ' + sanitize(sol.timeComplexity || sol.tc || '?') + '</span>';
  html += '  <span style="font-size:0.72rem;font-weight:700;background:rgba(96,165,250,0.1);color:#60a5fa;padding:4px 10px;border-radius:6px;">💾 ' + sanitize(sol.spaceComplexity || sol.sc || '?') + '</span>';
  html += '</div>';

  // Explanation from solution
  if (sol.explanation) {
    html += '<div style="margin-top:10px;padding:8px 12px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.12);border-radius:8px;font-size:0.76rem;color:rgba(255,255,255,0.75);line-height:1.5;"><strong style="color:#22c55e;">Summary:</strong> ' + sanitize(sol.explanation) + '</div>';
  }

  _pgShowAIPanel('🔬 Algorithm', html);
}

/**
 * Detect algorithm from code using pattern matching (no API)
 * Returns { name, explanation, steps }
 */
function _pgDetectAlgorithm(code) {
  if (!code) return { name: 'Unknown', explanation: 'Could not analyze.', steps: [] };

  // Two Pointer
  if (/while.*left.*right|while.*lo.*hi|while.*i.*j/.test(code) && /left\+\+|right--|lo\+\+|hi--|i\+\+|j--/.test(code)) {
    return { name: 'Two Pointer Technique', explanation: 'Uses two pointers moving from opposite ends (or same direction) to find a solution in O(n) time without extra space. Avoids brute-force nested loops.', steps: ['Initialize two pointers (left at start, right at end)', 'Compare elements at both pointers', 'Move the pointer that helps approach the target', 'Repeat until pointers meet or condition is satisfied'] };
  }

  // Binary Search
  if (/while.*low.*high|while.*lo.*hi|while.*left.*right/.test(code) && /mid\s*=|mid\s*\+|\/\s*2/.test(code)) {
    return { name: 'Binary Search', explanation: 'Divides the search space in half each iteration, achieving O(log n) time complexity. Works on sorted data or monotonic conditions.', steps: ['Define search boundaries (low, high)', 'Calculate mid point', 'Compare mid with target — narrow search to left or right half', 'Repeat until element found or boundaries cross'] };
  }

  // Dynamic Programming
  if (/\bdp\b|\bmemo\b|\btabulation\b|\bcache\b/.test(code) || (/\bnew\s+(int|Integer|Array)/.test(code) && /\[.*\+\s*1\]/.test(code) && /dp\[|memo\[/.test(code))) {
    return { name: 'Dynamic Programming', explanation: 'Breaks problem into overlapping sub-problems and stores results to avoid recomputation. Builds solution bottom-up (tabulation) or top-down (memoization).', steps: ['Identify the state (what changes between sub-problems)', 'Define recurrence relation (how states relate)', 'Initialize base cases', 'Fill DP table iteratively or recursively with memoization', 'Return final state as answer'] };
  }

  // Recursion / Backtracking
  if (/function\s+\w+.*\(.*\)[\s\S]{0,50}function\s+\w+.*\(/.test(code) || /def\s+\w+.*:[\s\S]{0,200}def\s+\w+/.test(code) || /\bbacktrack\b|\brecurse\b/.test(code)) {
    return { name: 'Recursion / Backtracking', explanation: 'Explores all possible solutions by making choices and undoing them (backtracking) when they lead to dead ends. Useful for combinatorial problems.', steps: ['Define base case (when to stop)', 'Make a choice and recurse on remaining sub-problem', 'If choice leads to invalid state, undo (backtrack)', 'Collect valid solutions'] };
  }

  // Sorting + Greedy
  if (/\bsort\b|\bArrays\.sort\b|\bsorted\b|\bCollections\.sort\b/.test(code)) {
    if (/greedy|max.*min|min.*max/.test(code) || !/for.*for/.test(code)) {
      return { name: 'Sorting + Greedy Approach', explanation: 'Sorts input to establish order, then makes locally optimal choices at each step. Greedy works when local optimum leads to global optimum.', steps: ['Sort the input array/list', 'Iterate through sorted data', 'At each step, make the greedy choice (pick best local option)', 'Build result incrementally'] };
    }
    return { name: 'Sorting-Based Approach', explanation: 'Sorts the input first to simplify the problem. After sorting, patterns become easier to detect (duplicates, pairs, ranges).', steps: ['Sort the input data', 'Use the sorted order to efficiently find answer', 'Handle edge cases (empty array, single element)'] };
  }

  // HashMap/Frequency counting
  if (/\bMap\b|\bHashMap\b|\bdict\b|\bunordered_map\b|\bmap\[|\b{}\b/.test(code) && /\bget\b|\b\[.*\]\s*=/.test(code)) {
    return { name: 'Hash Map / Frequency Counting', explanation: 'Uses a hash map to store values for O(1) lookup. Common for counting frequencies, finding pairs, or tracking seen elements.', steps: ['Create a hash map/dictionary', 'Iterate through input, storing relevant data in map', 'Use O(1) lookup to check conditions or find answers', 'Return result based on map contents'] };
  }

  // Sliding Window
  if (/window|slide|shrink/.test(code) || (/while/.test(code) && /start\+\+|left\+\+|i\+\+/.test(code) && /end|right|j/.test(code) && /sum|count|max|min/.test(code))) {
    return { name: 'Sliding Window', explanation: 'Maintains a window of elements that expands or shrinks based on conditions. Efficiently processes contiguous subarrays/substrings in O(n).', steps: ['Initialize window boundaries (start, end)', 'Expand window by moving end pointer', 'When condition violated, shrink window from start', 'Track best result (max/min) during process'] };
  }

  // Simple iteration
  if ((code.match(/\bfor\b|\bwhile\b/g) || []).length === 1) {
    return { name: 'Single-Pass Linear Scan', explanation: 'Solves the problem in a single pass through the data (O(n)). Maintains running state variables to track the answer.', steps: ['Initialize result/tracking variables', 'Iterate through input once', 'Update tracking variables at each step', 'Return final result after loop'] };
  }

  // Nested loops
  if ((code.match(/\bfor\b/g) || []).length >= 2 || /for.*for/.test(code)) {
    return { name: 'Nested Iteration', explanation: 'Uses nested loops to check all pairs or sub-problems. May be O(n²) but is sometimes the simplest correct approach for the given constraints.', steps: ['Outer loop iterates through each element', 'Inner loop checks against remaining elements', 'Track best result found', 'Optimize if possible with early termination'] };
  }

  // Fallback
  return { name: 'Iterative Approach', explanation: 'Uses straightforward iteration to solve the problem. Focus on handling edge cases correctly.', steps: ['Read and parse input', 'Process data with appropriate logic', 'Handle edge cases', 'Output result'] };
}

/**
 * AI Dropdown → Optimal Solution
 * Inserts the full best solution into Monaco editor (current language)
 */
function codingPgAIOptimalSolution() {
  // Close dropdown
  var menu = document.getElementById('coding-pg-ai-dropdown-menu');
  if (menu) menu.style.display = 'none';

  var code = _pgGetCurrentLangSolution();
  if (!code) {
    _pgShowAIPanel('💻 Optimal Solution', '<div style="color:#f59e0b;">Best solution not loaded yet. Please wait a moment and try again.</div>');
    return;
  }

  // Insert into Monaco editor
  if (_pgEditorInstance) {
    _pgEditorInstance.setValue(code);
    // Save immediately
    var pid = _pgActiveProblem ? _pgActiveProblem.id : '';
    var select = document.getElementById('coding-pg-lang');
    var lid = select ? select.value : 'c';
    if (pid) pgSaveCode(pid, lid, code);
  }

  // Hide AI panel if open
  _pgHideAIPanel();
}

/**
 * Show AI panel (floating panel below toolbar, above editor)
 * Used by Hints and Algorithm features
 */
function _pgShowAIPanel(title, contentHtml) {
  // Remove existing panel if any
  _pgHideAIPanel();

  var panel = document.createElement('div');
  panel.id = 'coding-pg-ai-panel';
  panel.style.cssText = 'position:absolute;top:38px;right:8px;width:380px;max-height:55vh;overflow-y:auto;background:#12101f;border:1px solid rgba(108,71,255,0.3);border-radius:12px;padding:16px;z-index:998;box-shadow:0 12px 40px rgba(0,0,0,0.6);';

  var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '  <span style="font-size:0.88rem;font-weight:700;color:#fff;">' + title + '</span>';
  html += '  <button onclick="_pgHideAIPanel()" style="background:rgba(255,255,255,0.1);border:none;border-radius:50%;width:24px;height:24px;color:#fff;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center;">✕</button>';
  html += '</div>';
  html += '<div>' + contentHtml + '</div>';

  panel.innerHTML = html;

  // Insert into the editor area (relative positioned parent)
  var editorWrap = document.getElementById('coding-pg-editor-area');
  if (editorWrap) {
    editorWrap.style.position = 'relative';
    editorWrap.appendChild(panel);
  }
}

/**
 * Hide AI panel
 */
function _pgHideAIPanel() {
  var panel = document.getElementById('coding-pg-ai-panel');
  if (panel) panel.remove();
}

// ═══════════════════════════════════════════════════════
// CURSOR AI POP-UP WIDGET (shows after 2 sec pause)
// Uses Monaco ContentWidget API
// ═══════════════════════════════════════════════════════

/**
 * Reset the cursor widget timer (called on typing/cursor move)
 * After 2 seconds of inactivity, shows the AI pop-up at cursor position
 * Respects minimized state — if user minimized, re-shows in minimized form
 */
function _pgResetCursorWidgetTimer() {
  // Hide existing widget on any activity
  _pgHideCursorWidget();
  clearTimeout(_pgCursorWidgetTimer);
  _pgCursorWidgetTimer = setTimeout(function() {
    _pgShowCursorWidget();
  }, 2000);
}

/**
 * Show cursor AI pop-up widget at current cursor position
 * Uses Monaco ContentWidget for proper editor integration
 * Features: equal-sized buttons + minimize/maximize controls
 */
function _pgShowCursorWidget() {
  if (!_pgEditorInstance || !window.monaco) return;
  if (!_pgPreloadedSolution) return; // No solution loaded, don't show
  if (_pgCursorWidgetVisible) return; // Already showing

  var position = _pgEditorInstance.getPosition();
  if (!position) return;

  // Don't show if editor is empty or has very little code
  var code = _pgEditorInstance.getValue();
  if (!code || code.trim().length < 3) return;

  _pgCursorWidgetVisible = true;

  // Create ContentWidget
  _pgCursorWidget = {
    getId: function() { return 'pg-ai-cursor-widget'; },
    getDomNode: function() {
      if (!this._domNode) {
        this._domNode = document.createElement('div');
        this._domNode.id = 'pg-ai-cursor-widget-dom';
        this._domNode.style.cssText = 'background:#1a1a2e;border:1px solid rgba(108,71,255,0.4);border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:999;cursor:default;white-space:nowrap;overflow:hidden;';

        // Control bar (minimize/maximize)
        var controlBar = document.createElement('div');
        controlBar.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;padding:3px 6px 0;gap:4px;';

        var minBtn = document.createElement('button');
        minBtn.innerHTML = '−';
        minBtn.title = 'Minimize';
        minBtn.style.cssText = 'background:rgba(255,255,255,0.08);border:none;border-radius:3px;width:16px;height:16px;color:#94a3b8;font-size:0.7rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;transition:background 0.15s;';
        minBtn.onmouseover = function() { minBtn.style.background = 'rgba(239,68,68,0.3)'; minBtn.style.color = '#fca5a5'; };
        minBtn.onmouseout = function() { minBtn.style.background = 'rgba(255,255,255,0.08)'; minBtn.style.color = '#94a3b8'; };
        minBtn.onclick = function(e) { e.stopPropagation(); _pgMinimizeCursorWidget(); };

        controlBar.appendChild(minBtn);

        // Buttons container
        var btnContainer = document.createElement('div');
        btnContainer.id = 'pg-ai-cursor-btns';
        btnContainer.style.cssText = 'display:flex;gap:4px;align-items:center;padding:4px 6px 6px;';

        var btnStyle = 'width:72px;height:26px;border-radius:6px;font-size:0.63rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:3px;transition:background 0.15s;';

        var btn1 = document.createElement('button');
        btn1.innerHTML = '<i class="fas fa-step-forward"></i> Next';
        btn1.style.cssText = btnStyle + 'background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#22c55e;';
        btn1.onmouseover = function() { btn1.style.background = 'rgba(34,197,94,0.25)'; };
        btn1.onmouseout = function() { btn1.style.background = 'rgba(34,197,94,0.12)'; };
        btn1.onclick = function(e) { e.stopPropagation(); codingPgNextStep(); };

        var btn2 = document.createElement('button');
        btn2.innerHTML = '<i class="fas fa-search"></i> Analyze';
        btn2.style.cssText = btnStyle + 'background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;';
        btn2.onmouseover = function() { btn2.style.background = 'rgba(245,158,11,0.25)'; };
        btn2.onmouseout = function() { btn2.style.background = 'rgba(245,158,11,0.12)'; };
        btn2.onclick = function(e) { e.stopPropagation(); codingPgAnalyzeMistake(); };

        var btn3 = document.createElement('button');
        btn3.innerHTML = '<i class="fas fa-code"></i> Solution';
        btn3.style.cssText = btnStyle + 'background:rgba(108,71,255,0.12);border:1px solid rgba(108,71,255,0.3);color:#a78bfa;';
        btn3.onmouseover = function() { btn3.style.background = 'rgba(108,71,255,0.25)'; };
        btn3.onmouseout = function() { btn3.style.background = 'rgba(108,71,255,0.12)'; };
        btn3.onclick = function(e) { e.stopPropagation(); codingPgAIOptimalSolution(); };

        btnContainer.appendChild(btn1);
        btnContainer.appendChild(btn2);
        btnContainer.appendChild(btn3);

        this._domNode.appendChild(controlBar);
        this._domNode.appendChild(btnContainer);

        // If user previously minimized, show in minimized state
        if (_pgCursorWidgetMinimized) {
          btnContainer.style.display = 'none';
          controlBar.style.padding = '4px 6px';
          _pgAddMaximizeBtn(controlBar, btnContainer);
        }
      }
      return this._domNode;
    },
    getPosition: function() {
      return {
        position: position,
        preference: [window.monaco.editor.ContentWidgetPositionPreference.BELOW]
      };
    }
  };

  _pgEditorInstance.addContentWidget(_pgCursorWidget);
}

/**
 * Minimize the cursor widget — hides buttons, shows only a small restore icon
 */
function _pgMinimizeCursorWidget() {
  _pgCursorWidgetMinimized = true;
  var dom = document.getElementById('pg-ai-cursor-widget-dom');
  if (!dom) return;
  var btnContainer = document.getElementById('pg-ai-cursor-btns');
  var controlBar = dom.firstChild;
  if (btnContainer) btnContainer.style.display = 'none';
  if (controlBar) {
    controlBar.style.padding = '4px 6px';
    // Replace minimize btn with maximize btn
    controlBar.innerHTML = '';
    _pgAddMaximizeBtn(controlBar, btnContainer);
  }
}

/**
 * Add maximize (restore) button to control bar
 */
function _pgAddMaximizeBtn(controlBar, btnContainer) {
  var maxBtn = document.createElement('button');
  maxBtn.innerHTML = '<i class="fas fa-robot" style="font-size:0.6rem;margin-right:3px;"></i>□';
  maxBtn.title = 'Restore AI Assist';
  maxBtn.style.cssText = 'background:rgba(108,71,255,0.15);border:1px solid rgba(108,71,255,0.3);border-radius:4px;padding:3px 8px;color:#a78bfa;font-size:0.63rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;';
  maxBtn.onmouseover = function() { maxBtn.style.background = 'rgba(108,71,255,0.3)'; };
  maxBtn.onmouseout = function() { maxBtn.style.background = 'rgba(108,71,255,0.15)'; };
  maxBtn.onclick = function(e) { e.stopPropagation(); _pgMaximizeCursorWidget(); };
  controlBar.appendChild(maxBtn);
}

/**
 * Maximize (restore) the cursor widget — shows all buttons again
 */
function _pgMaximizeCursorWidget() {
  _pgCursorWidgetMinimized = false;
  // Remove and re-add widget to rebuild DOM cleanly
  _pgHideCursorWidget();
  // Show immediately (don't wait 2 sec)
  setTimeout(function() { _pgShowCursorWidget(); }, 10);
}

/**
 * Hide cursor AI pop-up widget
 */
function _pgHideCursorWidget() {
  if (!_pgCursorWidgetVisible || !_pgCursorWidget || !_pgEditorInstance) return;
  try {
    _pgEditorInstance.removeContentWidget(_pgCursorWidget);
  } catch(e) {}
  _pgCursorWidget = null;
  _pgCursorWidgetVisible = false;
}

/**
 * Cursor Pop-up → Next Step
 * Inserts the next solution line AFTER cursor position.
/**
 * Cursor Pop-up → Next Step  (Industry-level, all user scenarios handled)
 *
 * DESIGN:
 * - Normalize all code lines for comparison (removes spacing/brace-style differences)
 * - Walk ALL user code (not just up to cursor) to find how far they've progressed
 * - Use a greedy sequential match: for each solution line, check if user has it
 *   in order — advancing user pointer only on match
 * - "Next" = first solution line NOT yet matched in that sequence
 * - Insert after cursor line, move cursor there so chain Next-Next works
 *
 * NORMALIZATION handles:
 *   "#include<stdio.h>"  ==  "#include <stdio.h>"
 *   "int main(){"        ==  "int main() {"
 *   "scanf("%d",&n);"    ==  "scanf( "%d", &n );"
 *   Tabs vs spaces, trailing whitespace, double spaces
 */
function codingPgNextStep() {
  _pgHideCursorWidget();

  var solutionCode = _pgGetCurrentLangSolution();
  if (!solutionCode) {
    _pgShowAIPanel('➡️ Next Step', '<div style="color:#f59e0b;">Best solution not loaded yet. Please wait a moment.</div>');
    return;
  }
  if (!_pgEditorInstance || !window.monaco) return;

  var userCode = _pgEditorInstance.getValue();
  var position = _pgEditorInstance.getPosition();
  var cursorLine = position ? position.lineNumber : 1;

  /**
   * Normalize a code line for fuzzy comparison:
   * - Lowercase
   * - Collapse all whitespace (tabs, multi-spaces) to single space
   * - Remove spaces around common operators/brackets so style differences vanish
   * - Trim
   */
  function normalize(line) {
    // Strip inline comments (// ...) before comparing — code logic matters, not comments
    var noComment = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    return noComment
      .replace(/\t/g, ' ')          // tabs → space
      .replace(/\s+/g, ' ')         // multi-space → single space
      .replace(/\s*\(\s*/g, '(')    // spaces inside ( )
      .replace(/\s*\)\s*/g, ')')
      .replace(/\s*\{\s*/g, '{')    // spaces before {
      .replace(/\s*\}\s*/g, '}')
      .replace(/\s*,\s*/g, ',')     // spaces around ,
      .replace(/\s*;\s*/g, ';')     // spaces before ;
      .replace(/\s*<\s*/g, '<')     // spaces inside < >
      .replace(/\s*>\s*/g, '>')
      .replace(/\s*=\s*/g, '=')     // spaces around =
      .trim()
      .toLowerCase();
  }

  // Build solution line list (non-blank only, keep original for insertion)
  var solItems = solutionCode.split('\n')
    .map(function(l) { return { original: l, norm: normalize(l) }; })
    .filter(function(item) { return item.norm.length > 0; });

  // Build user line list (ALL lines, non-blank, normalized)
  var userNorms = userCode.split('\n')
    .map(function(l) { return normalize(l); })
    .filter(function(n) { return n.length > 0; });

  // Greedy sequential match:
  // For each solution line in order, check if the user has it (anywhere from
  // current userIdx forward). This is tolerant of extra user lines in between.
  var userIdx = 0;
  var matchedSolCount = 0;

  for (var si = 0; si < solItems.length; si++) {
    // Search for this sol line in user lines starting from userIdx
    var found = false;
    for (var ui = userIdx; ui < userNorms.length; ui++) {
      if (solItems[si].norm === userNorms[ui]) {
        matchedSolCount = si + 1;
        userIdx = ui + 1; // advance user pointer past this match
        found = true;
        break;
      }
    }
    if (!found) {
      // This solution line not found — this is the next step
      break;
    }
  }

  // Next step = solution line at matchedSolCount index
  var nextItem = solItems[matchedSolCount] || null;

  if (!nextItem) {
    _pgShowAIPanel('➡️ Next Step',
      '<div style="color:#22c55e;font-weight:600;font-size:0.82rem;">✅ Your code already covers all steps of the optimal solution! Try running or submitting.</div>');
    return;
  }

  // Insert after cursor line, preserving solution's original indentation
  var nextLine = nextItem.original;
  var insertAfterLine = cursorLine;

  // Always insert at the END of user code (last non-blank line)
  // This prevents mid-code insertions when cursor is in the middle
  var allUserLines = userCode.split('\n');
  var lastNonBlankLine = 0;
  for (var lb = allUserLines.length - 1; lb >= 0; lb--) {
    if (allUserLines[lb].trim().length > 0) { lastNonBlankLine = lb + 1; break; }
  }
  // Insert after the last non-blank line (regardless of cursor position)
  insertAfterLine = lastNonBlankLine;

  // Insert as new line after last code line
  var edit = {
    range: new window.monaco.Range(insertAfterLine + 1, 1, insertAfterLine + 1, 1),
    text: nextLine + '\n',
    forceMoveMarkers: true
  };
  _pgEditorInstance.executeEdits('ai-next-step', [edit]);
  _pgEditorInstance.setPosition({ lineNumber: insertAfterLine + 1, column: nextLine.length + 1 });

  _pgEditorInstance.focus();
  // Scroll inserted line into view
  _pgEditorInstance.revealLineInCenter(insertAfterLine + 1);
}

/**
 * Cursor Pop-up → Analyze Mistake
 * Compares user code with best solution and highlights differences
 */
function codingPgAnalyzeMistake() {
  _pgHideCursorWidget();

  var solutionCode = _pgGetCurrentLangSolution();
  if (!solutionCode) {
    _pgShowAIPanel('🔍 Analyze', '<div style="color:#f59e0b;">Best solution not loaded yet.</div>');
    return;
  }

  if (!_pgEditorInstance) return;
  var userCode = _pgEditorInstance.getValue();

  if (!userCode || userCode.trim().length < 5) {
    _pgShowAIPanel('🔍 Analyze', '<div style="color:#f59e0b;">Write some code first, then analyze.</div>');
    return;
  }

  // Compare user code lines vs solution lines
  var solLines = solutionCode.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
  var userLines = userCode.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });

  // Build set of solution key lines (ignore braces-only lines)
  var solKeyLines = solLines.filter(function(l) { return l.length > 2 && l !== '{' && l !== '}' && l !== '};'; });
  var userKeyLines = userLines.filter(function(l) { return l.length > 2 && l !== '{' && l !== '}' && l !== '};'; });

  // Find missing lines (in solution but not in user code)
  var missing = [];
  solKeyLines.forEach(function(sl) {
    var found = userKeyLines.some(function(ul) {
      return ul === sl || ul.replace(/\s+/g, '') === sl.replace(/\s+/g, '');
    });
    if (!found) missing.push(sl);
  });

  // Find extra lines (in user code but not in solution)
  var extra = [];
  userKeyLines.forEach(function(ul) {
    var found = solKeyLines.some(function(sl) {
      return sl === ul || sl.replace(/\s+/g, '') === ul.replace(/\s+/g, '');
    });
    if (!found) extra.push(ul);
  });

  var html = '';

  if (missing.length === 0 && extra.length === 0) {
    html += '<div style="color:#22c55e;font-weight:600;font-size:0.82rem;">✅ Your code structure matches the optimal solution! Check logic/variable names if output differs.</div>';
  } else {
    // Coverage percentage
    var coverage = Math.round(((solKeyLines.length - missing.length) / Math.max(solKeyLines.length, 1)) * 100);
    html += '<div style="margin-bottom:10px;padding:8px 10px;background:rgba(108,71,255,0.08);border:1px solid rgba(108,71,255,0.2);border-radius:8px;font-size:0.76rem;color:#a78bfa;font-weight:600;">📊 Solution coverage: ' + coverage + '%</div>';

    if (missing.length > 0) {
      html += '<div style="font-size:0.72rem;font-weight:700;color:#ef4444;margin-bottom:6px;text-transform:uppercase;">❌ Missing Logic (' + missing.length + ' lines):</div>';
      missing.slice(0, 6).forEach(function(line) {
        html += '<div style="padding:4px 8px;margin-bottom:3px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);border-radius:6px;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:#fca5a5;white-space:pre-wrap;overflow-x:auto;">' + sanitize(line) + '</div>';
      });
      if (missing.length > 6) html += '<div style="font-size:0.68rem;color:#94a3b8;margin-top:4px;">... and ' + (missing.length - 6) + ' more lines</div>';
    }

    if (extra.length > 0) {
      html += '<div style="font-size:0.72rem;font-weight:700;color:#f59e0b;margin:10px 0 6px;text-transform:uppercase;">⚠️ Extra/Different Lines (' + extra.length + '):</div>';
      extra.slice(0, 4).forEach(function(line) {
        html += '<div style="padding:4px 8px;margin-bottom:3px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);border-radius:6px;font-family:\'JetBrains Mono\',monospace;font-size:0.7rem;color:#fde68a;white-space:pre-wrap;overflow-x:auto;">' + sanitize(line) + '</div>';
      });
      if (extra.length > 4) html += '<div style="font-size:0.68rem;color:#94a3b8;margin-top:4px;">... and ' + (extra.length - 4) + ' more lines</div>';
    }
  }

  _pgShowAIPanel('🔍 Analyze Mistakes', html);
}
