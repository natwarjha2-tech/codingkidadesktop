/**
 * CodingKida — Coding Interface Module
 * 
 * Integrates Monaco Editor (VS Code's editor) for coding exercises.
 * Loads Monaco from CDN (jsdelivr) on first use — lazy loaded.
 * 
 * Flow:
 * 1. Exercise tab renders → if type === "coding" → renderCodingExercise()
 * 2. First coding exercise triggers Monaco CDN load
 * 3. After Monaco loads, textarea is replaced with Monaco editor instance
 * 4. Student writes code → Run/Submit available
 */

// ═══════════════════════════════════════════════════════
// CONSTANTS & STATE
// ═══════════════════════════════════════════════════════

const MONACO_CDN_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min';

const CODING_LANGUAGES = [
  { id: 'java', label: 'Java', monacoId: 'java', judge0Id: 62, extension: '.java', icon: '☕' },
  { id: 'c', label: 'C', monacoId: 'c', judge0Id: 50, extension: '.c', icon: '🇨' },
  { id: 'python', label: 'Python', monacoId: 'python', judge0Id: 71, extension: '.py', icon: '🐍' },
  { id: 'javascript', label: 'JavaScript', monacoId: 'javascript', judge0Id: 63, extension: '.js', icon: '🟨' },
];

// Monaco load state
let _monacoLoaded = false;
let _monacoLoading = false;
let _monacoLoadCallbacks = [];

// Active editor instances (keyed by exIndex)
let _codingEditors = {};

// Selected language per exercise (persists during session)
let _codingSelectedLang = {};

// ═══════════════════════════════════════════════════════
// MONACO LOADER
// ═══════════════════════════════════════════════════════

/**
 * Load Monaco Editor from CDN. Returns a promise that resolves when ready.
 */
function loadMonacoEditor() {
  return new Promise(function(resolve, reject) {
    if (_monacoLoaded && window.monaco) {
      resolve(window.monaco);
      return;
    }

    if (_monacoLoading) {
      _monacoLoadCallbacks.push({ resolve: resolve, reject: reject });
      return;
    }

    _monacoLoading = true;

    // Load the AMD loader (require.js) from Monaco CDN
    var loaderScript = document.createElement('script');
    loaderScript.src = MONACO_CDN_BASE + '/vs/loader.js';
    loaderScript.onload = function() {
      // Configure Monaco AMD paths
      window.require.config({
        paths: { vs: MONACO_CDN_BASE + '/vs' }
      });

      // Load Monaco
      window.require(['vs/editor/editor.main'], function() {
        _monacoLoaded = true;
        _monacoLoading = false;
        resolve(window.monaco);
        // Resolve any queued callbacks
        _monacoLoadCallbacks.forEach(function(cb) { cb.resolve(window.monaco); });
        _monacoLoadCallbacks = [];
      });
    };
    loaderScript.onerror = function() {
      _monacoLoading = false;
      var err = new Error('Failed to load Monaco Editor from CDN');
      reject(err);
      _monacoLoadCallbacks.forEach(function(cb) { cb.reject(err); });
      _monacoLoadCallbacks = [];
    };
    document.head.appendChild(loaderScript);
  });
}

// ═══════════════════════════════════════════════════════
// RENDER CODING EXERCISE
// ═══════════════════════════════════════════════════════

/**
 * Render a coding exercise interface.
 * Called from renderExerciseTab when exercise.type === "coding"
 */
function renderCodingExercise(exercise, exIndex) {
  var defaultLang = exercise.language || _codingSelectedLang[exercise.id] || 'java';
  _codingSelectedLang[exercise.id || exIndex] = defaultLang;

  var difficultyColors = {
    easy: '#22c55e',
    medium: '#f59e0b',
    hard: '#ef4444',
  };
  var difficultyColor = difficultyColors[exercise.difficulty] || '#f59e0b';

  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === defaultLang; }) || CODING_LANGUAGES[0];

  var html = '';

  // Header: Title + Difficulty
  html += '<div class="coding-header">';
  html += '  <div class="coding-title-row">';
  html += '    <span class="coding-title">' + sanitize(exercise.title || 'Coding Exercise') + '</span>';
  html += '    <span class="coding-difficulty" style="background:' + difficultyColor + '20;color:' + difficultyColor + ';border:1px solid ' + difficultyColor + '40;">' + sanitize(exercise.difficulty || 'medium') + '</span>';
  html += '  </div>';
  html += '</div>';

  // Problem Description
  html += '<div class="coding-description">';
  html += '  <div class="coding-description-label"><i class="fas fa-file-alt"></i> Problem Description</div>';
  html += '  <div class="coding-description-text">' + sanitize(exercise.description || '') + '</div>';
  html += '</div>';

  // Hints
  if (exercise.hints && exercise.hints.length > 0) {
    var hintText = Array.isArray(exercise.hints) ? exercise.hints.join(' | ') : String(exercise.hints);
    if (hintText) {
      html += '<div class="coding-hint">';
      html += '  <i class="fas fa-lightbulb"></i>';
      html += '  <span>' + sanitize(hintText) + '</span>';
      html += '</div>';
    }
  }

  // Sample Test Cases (fetched from API — visible ones only)
  html += '<div class="coding-samples" id="coding-samples-' + exIndex + '">';
  html += '  <div class="coding-samples-header"><i class="fas fa-flask"></i> Sample Test Cases</div>';
  html += '  <div class="coding-samples-body" id="coding-samples-body-' + exIndex + '">';
  html += '    <span style="color:var(--muted);font-size:0.8rem;">Loading...</span>';
  html += '  </div>';
  html += '</div>';

  // Toolbar: Language Dropdown + Run/Submit
  html += '<div class="coding-toolbar">';
  html += '  <div class="coding-toolbar-left">';
  html += '    <select id="coding-lang-select-' + exIndex + '" class="coding-lang-select" onchange="codingChangeLanguage(' + exIndex + ', \'' + (exercise.id || '') + '\')">';
  // Exercise from course: lock to single language; otherwise show all
  var exerciseLangs = exercise.language
    ? CODING_LANGUAGES.filter(function(l) { return l.id === exercise.language; })
    : CODING_LANGUAGES;
  if (exerciseLangs.length === 0) exerciseLangs = CODING_LANGUAGES; // fallback safety
  exerciseLangs.forEach(function(lang) {
    var selected = lang.id === defaultLang ? ' selected' : '';
    html += '      <option value="' + lang.id + '"' + selected + '>' + lang.icon + ' ' + lang.label + '</option>';
  });
  html += '    </select>';
  html += '    <span class="coding-lang-badge" id="coding-lang-badge-' + exIndex + '">' + langObj.icon + '</span>';
  html += '  </div>';
  html += '  <div class="coding-toolbar-right">';
  html += '    <button class="coding-btn coding-btn-run" id="coding-run-btn-' + exIndex + '" onclick="codingRun(' + exIndex + ')">';
  html += '      <i class="fas fa-play"></i> Run';
  html += '    </button>';
  html += '    <button class="coding-btn coding-btn-submit" id="coding-submit-btn-' + exIndex + '" onclick="codingSubmit(' + exIndex + ')">';
  html += '      <i class="fas fa-paper-plane"></i> Submit';
  html += '    </button>';
  html += '  </div>';
  html += '</div>';

  // Editor Container (Monaco will mount here)
  html += '<div class="coding-editor-wrap" id="coding-editor-wrap-' + exIndex + '">';
  html += '  <div class="coding-editor-header">';
  html += '    <span class="coding-editor-filename" id="coding-filename-' + exIndex + '"><i class="fas fa-code"></i> solution' + langObj.extension + '</span>';
  html += '    <span class="coding-editor-info" id="coding-cursor-' + exIndex + '">Ln 1, Col 1</span>';
  html += '  </div>';
  html += '  <div id="coding-monaco-' + exIndex + '" class="coding-monaco-container" data-lang="' + defaultLang + '" data-starter="' + encodeURIComponent(exercise.starterCode || '') + '"></div>';
  html += '</div>';

  // Custom Input
  html += '<div class="coding-input-section">';
  html += '  <div class="coding-input-header" onclick="codingToggleInput(' + exIndex + ')">';
  html += '    <span><i class="fas fa-terminal"></i> Custom Input (stdin)</span>';
  html += '    <div class="coding-input-actions">';
  html += '      <button class="coding-input-sample-btn" onclick="event.stopPropagation(); codingUseSampleInput(' + exIndex + ')" title="Use first sample test case input">Use Sample</button>';
  html += '      <span class="coding-input-toggle" id="coding-input-toggle-' + exIndex + '">▶</span>';
  html += '    </div>';
  html += '  </div>';
  html += '  <textarea id="coding-input-' + exIndex + '" class="coding-input-textarea" style="display:none;" placeholder="Enter input here (one value per line)..."></textarea>';
  html += '</div>';

  // Output Console — with tabs for Run Output vs Submit Results
  html += '<div class="coding-output-section">';
  html += '  <div class="coding-output-header">';
  html += '    <div class="coding-output-tabs">';
  html += '      <span class="coding-output-tab active" id="coding-otab-output-' + exIndex + '" onclick="codingSwitchOutputTab(' + exIndex + ', \'output\')">Output</span>';
  html += '      <span class="coding-output-tab" id="coding-otab-results-' + exIndex + '" onclick="codingSwitchOutputTab(' + exIndex + ', \'results\')">Test Results</span>';
  html += '    </div>';
  html += '    <button class="coding-output-clear" onclick="codingClearOutput(' + exIndex + ')">Clear</button>';
  html += '  </div>';
  html += '  <div id="coding-output-' + exIndex + '" class="coding-output-console">';
  html += '    <span class="coding-output-placeholder">Run your code to see output here...</span>';
  html += '  </div>';
  html += '  <div id="coding-results-' + exIndex + '" class="coding-output-console" style="display:none;">';
  html += '    <span class="coding-output-placeholder">Submit your code to see test results here...</span>';
  html += '  </div>';
  html += '</div>';

  // Submission History Section
  html += '<div class="coding-history-section">';
  html += '  <div class="coding-history-header" onclick="codingToggleHistory(' + exIndex + ')">';
  html += '    <span><i class="fas fa-history"></i> Submission History</span>';
  html += '    <span class="coding-history-toggle" id="coding-history-toggle-' + exIndex + '">▶</span>';
  html += '  </div>';
  html += '  <div id="coding-history-body-' + exIndex + '" class="coding-history-body" style="display:none;">';
  html += '    <span class="coding-output-placeholder">Loading...</span>';
  html += '  </div>';
  html += '</div>';

  // After DOM renders, initialize Monaco and load sample test cases + history
  setTimeout(function() {
    initMonacoForExercise(exIndex);
    codingLoadSampleTestCases(exIndex, exercise.id || '');
    codingLoadHistory(exIndex, exercise.id || '');
  }, 50);

  return html;
}

// ═══════════════════════════════════════════════════════
// CODE PERSISTENCE — localStorage auto-save / restore
// ═══════════════════════════════════════════════════════

/**
 * Get storage key for an exercise + language
 */
function _codingStorageKey(exerciseId, langId) {
  var userId = (typeof getCurrentUserId === 'function') ? getCurrentUserId() : 'anon';
  return 'ck_code_' + userId + '_' + exerciseId + '_' + langId;
}

/**
 * Save code to localStorage (called on every editor change, debounced)
 */
var _codingSaveTimers = {};
function codingSaveCode(exerciseId, langId, code) {
  if (!exerciseId) return;
  clearTimeout(_codingSaveTimers[exerciseId]);
  _codingSaveTimers[exerciseId] = setTimeout(function() {
    try {
      localStorage.setItem(_codingStorageKey(exerciseId, langId), code);
    } catch (e) {}
  }, 1500); // 1.5 sec debounce
}

/**
 * Restore saved code for an exercise + language
 * Returns saved code or null if not found
 */
function codingRestoreCode(exerciseId, langId) {
  if (!exerciseId) return null;
  try {
    return localStorage.getItem(_codingStorageKey(exerciseId, langId)) || null;
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// MONACO INITIALIZATION
// ═══════════════════════════════════════════════════════

/**
 * Initialize Monaco editor for a specific exercise index
 */
function initMonacoForExercise(exIndex) {
  var container = document.getElementById('coding-monaco-' + exIndex);
  if (!container) return;

  var langId = container.getAttribute('data-lang') || 'java';
  var starterCode = decodeURIComponent(container.getAttribute('data-starter') || '');
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; }) || CODING_LANGUAGES[0];

  // Show loading state
  container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:0.85rem;gap:8px;"><i class="fas fa-spinner fa-spin"></i> Loading editor...</div>';

  loadMonacoEditor().then(function(monaco) {
    // Clear loading state
    container.innerHTML = '';

    // Define custom themes (only once)
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

    // Restore saved code if available, otherwise use starter
    var exerciseId = (function() {
      var cards = document.querySelectorAll('.exercise-card');
      return cards[exIndex] ? (cards[exIndex].dataset.exerciseid || '') : '';
    })();
    var savedCode = codingRestoreCode(exerciseId, langId);
    var initialCode = savedCode !== null ? savedCode : (starterCode || getDefaultStarter(langId));

    // Create editor instance
    var editor = monaco.editor.create(container, {
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
      roundedSelection: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      tabSize: 4,
      wordWrap: 'on',
      suggestOnTriggerCharacters: true,
      quickSuggestions: true,
      folding: true,
      bracketPairColorization: { enabled: true },
      renderLineHighlight: 'line',
      overviewRulerBorder: false,
      hideCursorInOverviewRuler: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
    });

    // Store editor reference
    _codingEditors[exIndex] = editor;

    // Update cursor position display
    editor.onDidChangeCursorPosition(function(e) {
      var cursorEl = document.getElementById('coding-cursor-' + exIndex);
      if (cursorEl) {
        cursorEl.textContent = 'Ln ' + e.position.lineNumber + ', Col ' + e.position.column;
      }
    });

    // Auto-save code on change
    editor.onDidChangeModelContent(function() {
      var exCards = document.querySelectorAll('.exercise-card');
      var exId = exCards[exIndex] ? (exCards[exIndex].dataset.exerciseid || '') : '';
      if (exId) {
        codingSaveCode(exId, langId, editor.getValue());
      }
    });

  }).catch(function(err) {
    // Fallback to textarea if Monaco fails to load
    container.innerHTML = '<textarea id="coding-fallback-' + exIndex + '" class="coding-editor-textarea" spellcheck="false" placeholder="// Write your code here...">' + sanitize(starterCode || getDefaultStarter(langId)) + '</textarea>';
    console.error('Monaco load failed, using fallback textarea:', err);
  });
}

// ═══════════════════════════════════════════════════════
// DEFAULT STARTER CODE
// ═══════════════════════════════════════════════════════

function getDefaultStarter(langId) {
  var starters = {
    c: '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint main() {\n    // Read input\n    \n    // Write your solution here\n    \n    return 0;\n}\n',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        \n        // Read input\n        \n        // Write your solution here\n        \n        sc.close();\n    }\n}\n',
    python: '# Read input\n\n# Write your solution here\n\n',
    javascript: 'const readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin });\n\nconst lines = [];\nrl.on("line", (line) => lines.push(line.trim()));\nrl.on("close", () => {\n    // Read input from lines[]\n    \n    // Write your solution here\n    \n});\n',
  };
  return starters[langId] || '// Write your code here\n';
}

// ═══════════════════════════════════════════════════════
// EDITOR ACTIONS
// ═══════════════════════════════════════════════════════

/**
 * Get code from Monaco editor (or fallback textarea)
 */
function codingGetCode(exIndex) {
  var editor = _codingEditors[exIndex];
  if (editor) {
    return editor.getValue();
  }
  // Fallback textarea
  var fallback = document.getElementById('coding-fallback-' + exIndex);
  if (fallback) return fallback.value;
  return '';
}

/**
 * Change language in editor
 */
function codingChangeLanguage(exIndex, exerciseId) {
  var select = document.getElementById('coding-lang-select-' + exIndex);
  if (!select) return;

  var langId = select.value;
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === langId; }) || CODING_LANGUAGES[0];

  // Persist language selection
  _codingSelectedLang[exerciseId || exIndex] = langId;

  // Update filename display
  var filenameEl = document.getElementById('coding-filename-' + exIndex);
  if (filenameEl) {
    filenameEl.innerHTML = '<i class="fas fa-code"></i> solution' + langObj.extension;
  }

  // Update language badge icon
  var badgeEl = document.getElementById('coding-lang-badge-' + exIndex);
  if (badgeEl) {
    badgeEl.textContent = langObj.icon;
  }

  // Update Monaco language model and settings
  var editor = _codingEditors[exIndex];
  if (editor && window.monaco) {
    var model = editor.getModel();
    if (model) {
      window.monaco.editor.setModelLanguage(model, langObj.monacoId);
    }

    // Language-specific tab size: Python uses 4 spaces (insertSpaces), C/Java uses 4 tab
    var tabSize = (langId === 'python') ? 4 : 4;
    var insertSpaces = (langId === 'python') ? true : true;
    editor.updateOptions({
      tabSize: tabSize,
      insertSpaces: insertSpaces,
    });

    // If editor is empty or has a default starter, replace with new language starter
    // But first check if user has saved code for this language
    var savedForLang = codingRestoreCode(exerciseId || exIndex, langId);
    var currentCode = editor.getValue().trim();
    var isDefault = false;
    CODING_LANGUAGES.forEach(function(l) {
      if (currentCode === getDefaultStarter(l.id).trim()) isDefault = true;
    });
    if (savedForLang !== null) {
      editor.setValue(savedForLang);
    } else if (!currentCode || isDefault) {
      editor.setValue(getDefaultStarter(langId));
    }
  }
}

/**
 * Run code — sends to /api/code/run with custom stdin
 */
function codingRun(exIndex) {
  var outputEl = document.getElementById('coding-output-' + exIndex);
  if (!outputEl) return;

  var code = codingGetCode(exIndex);
  if (!code.trim()) {
    outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Please write some code before running.</span>';
    return;
  }

  // Get selected language
  var select = document.getElementById('coding-lang-select-' + exIndex);
  var selectedLang = select ? select.value : 'java';
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === selectedLang; }) || CODING_LANGUAGES[0];

  // Get custom input
  var inputEl = document.getElementById('coding-input-' + exIndex);
  var stdin = inputEl ? inputEl.value : '';

  // Show running state
  outputEl.innerHTML = '<span class="coding-output-info"><i class="fas fa-spinner fa-spin"></i> Running...</span>';
  codingSwitchOutputTab(exIndex, 'output');

  // Disable buttons
  var runBtn = document.getElementById('coding-run-btn-' + exIndex);
  var submitBtn = document.getElementById('coding-submit-btn-' + exIndex);
  if (runBtn) { runBtn.disabled = true; runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...'; }
  if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }

  // API call
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/code/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      source_code: code,
      language_id: langObj.judge0Id,
      stdin: stdin,
    }),
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      var html = '';

      // Show compilation error if any
      if (data.status === 'compilation_error' && data.compile_output) {
        html += '<div class="coding-output-status coding-status-error">Compilation Error</div>';
        html += '<pre class="coding-output-pre coding-output-error-text">' + sanitize(data.compile_output) + '</pre>';
      }
      // Show runtime error
      else if (data.status === 'runtime_error' && data.stderr) {
        html += '<div class="coding-output-status coding-status-error">Runtime Error</div>';
        html += '<pre class="coding-output-pre coding-output-error-text">' + sanitize(data.stderr) + '</pre>';
      }
      // Time limit exceeded
      else if (data.status === 'time_limit') {
        html += '<div class="coding-output-status coding-status-warning">Time Limit Exceeded</div>';
        html += '<span class="coding-output-error">Your code took too long to execute (limit: 2 seconds).</span>';
      }
      // Successful execution
      else {
        if (data.stdout) {
          html += '<div class="coding-output-status coding-status-success">Executed Successfully</div>';
          html += '<pre class="coding-output-pre">' + sanitize(data.stdout) + '</pre>';
        } else {
          html += '<div class="coding-output-status coding-status-success">Executed Successfully</div>';
          html += '<span style="color:var(--muted);font-style:italic;">No output produced.</span>';
        }
        // Show stderr warnings (if stdout exists but stderr also has content)
        if (data.stderr && data.stdout) {
          html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">';
          html += '<span style="font-size:0.72rem;color:#f59e0b;font-weight:600;">Warnings:</span>';
          html += '<pre class="coding-output-pre coding-output-error-text" style="margin-top:4px;">' + sanitize(data.stderr) + '</pre>';
          html += '</div>';
        }
      }

      // Execution stats
      if (data.time || data.memory) {
        html += '<div class="coding-output-stats">';
        if (data.time) html += '<span>⏱ ' + data.time + 's</span>';
        if (data.memory) html += '<span>💾 ' + (data.memory / 1024).toFixed(2) + ' MB</span>';
        html += '</div>';
      }

      outputEl.innerHTML = html;
    } else {
      outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> ' + sanitize(data.message || 'Execution failed.') + '</span>';
    }
  })
  .catch(function(err) {
    outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Failed to connect to execution service. Make sure the server is running.</span>';
  })
  .finally(function() {
    // Re-enable buttons
    if (runBtn) { runBtn.disabled = false; runBtn.innerHTML = '<i class="fas fa-play"></i> Run'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
  });
}

/**
 * Submit code — sends to /api/code/submit with test case evaluation
 */
function codingSubmit(exIndex) {
  var code = codingGetCode(exIndex);

  if (!code.trim()) {
    var outputEl = document.getElementById('coding-output-' + exIndex);
    if (outputEl) {
      outputEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Please write your solution before submitting.</span>';
    }
    return;
  }

  // Get selected language
  var select = document.getElementById('coding-lang-select-' + exIndex);
  var selectedLang = select ? select.value : 'java';
  var langObj = CODING_LANGUAGES.find(function(l) { return l.id === selectedLang; }) || CODING_LANGUAGES[0];

  // Get exercise ID
  var exerciseCards = document.querySelectorAll('.exercise-card');
  var exerciseId = exerciseCards[exIndex] ? exerciseCards[exIndex].dataset.exerciseid || '' : '';
  var courseId = (typeof _currentLessonContext !== 'undefined' && _currentLessonContext) ? _currentLessonContext.courseId : '';

  if (!exerciseId || !courseId) {
    // Fallback to legacy submission if IDs not available
    var legacyTextarea = document.getElementById('exercise-code-input-' + exIndex);
    if (legacyTextarea) {
      legacyTextarea.value = code;
      legacyTextarea.setAttribute('data-language', selectedLang);
    }
    if (typeof submitExerciseAnswer === 'function') submitExerciseAnswer(exIndex);
    return;
  }

  // Show submitting state — use "Test Results" tab
  var resultsEl = document.getElementById('coding-results-' + exIndex);
  if (resultsEl) {
    resultsEl.innerHTML = '<span class="coding-output-info"><i class="fas fa-spinner fa-spin"></i> Running against test cases...</span>';
  }
  codingSwitchOutputTab(exIndex, 'results');

  // Disable buttons
  var runBtn = document.getElementById('coding-run-btn-' + exIndex);
  var submitBtn = document.getElementById('coding-submit-btn-' + exIndex);
  if (runBtn) { runBtn.disabled = true; runBtn.style.opacity = '0.5'; }
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; }

  // API call
  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/code/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      exerciseId: exerciseId,
      source_code: code,
      language_id: langObj.judge0Id,
      courseId: courseId,
    }),
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success) {
      var html = '';

      // Overall status banner
      if (data.passed) {
        html += '<div class="coding-output-status coding-status-accepted">✅ Accepted — All Test Cases Passed!</div>';
      } else {
        html += '<div class="coding-output-status coding-status-failed">❌ ' + sanitize(data.message || 'Some test cases failed.') + '</div>';
      }

      // Test case results
      if (data.results && data.results.length > 0) {
        html += '<div class="coding-tc-results">';
        data.results.forEach(function(tc) {
          var icon = tc.passed ? '✅' : '❌';
          var statusClass = tc.passed ? 'coding-tc-pass' : 'coding-tc-fail';
          html += '<div class="coding-tc-item ' + statusClass + '">';
          html += '  <div class="coding-tc-header">' + icon + ' Test Case ' + tc.test_case;
          if (tc.time) html += ' <span class="coding-tc-time">(' + tc.time + 's)</span>';
          html += '</div>';

          if (!tc.is_hidden) {
            if (!tc.passed) {
              html += '<div class="coding-tc-detail">';
              html += '  <div><span class="coding-tc-label">Input:</span> <code>' + sanitize(tc.input) + '</code></div>';
              html += '  <div><span class="coding-tc-label">Expected:</span> <code>' + sanitize(tc.expected) + '</code></div>';
              html += '  <div><span class="coding-tc-label">Got:</span> <code>' + sanitize(tc.actual) + '</code></div>';
              html += '</div>';
            }
          } else {
            if (!tc.passed) {
              html += '<div class="coding-tc-detail"><span class="coding-tc-label">Hidden test case</span></div>';
            }
          }
          html += '</div>';
        });
        html += '</div>';
      }

      // Execution stats
      if (data.time || data.memory) {
        html += '<div class="coding-output-stats">';
        if (data.time) html += '<span>⏱ Total: ' + data.time + '</span>';
        if (data.memory) html += '<span>💾 Peak: ' + data.memory + '</span>';
        html += '</div>';
      }

      resultsEl.innerHTML = html;

      // Also update legacy result div (for exercise rank)
      var resultDiv = document.getElementById('exercise-submit-result-' + exIndex);
      if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.style.color = data.passed ? '#22c55e' : '#f59e0b';
        resultDiv.innerHTML = data.passed
          ? '<i class="fas fa-check-circle"></i> ' + sanitize(data.message)
          : '<i class="fas fa-exclamation-triangle"></i> ' + sanitize(data.message);
      }

      if (typeof fetchAndShowExerciseRank === 'function') fetchAndShowExerciseRank();

      // Refresh submission history
      var exerciseCards2 = document.querySelectorAll('.exercise-card');
      var exId2 = exerciseCards2[exIndex] ? exerciseCards2[exIndex].dataset.exerciseid || '' : '';
      if (exId2) codingLoadHistory(exIndex, exId2);
    } else {
      resultsEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> ' + sanitize(data.message || 'Submission failed.') + '</span>';
    }
  })
  .catch(function(err) {
    resultsEl.innerHTML = '<span class="coding-output-error"><i class="fas fa-exclamation-circle"></i> Failed to connect. Check your internet and try again.</span>';
  })
  .finally(function() {
    // Re-enable buttons
    if (runBtn) { runBtn.disabled = false; runBtn.style.opacity = '1'; }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit'; }
  });
}

/**
 * Toggle custom input visibility
 */
function codingToggleInput(exIndex) {
  var inputEl = document.getElementById('coding-input-' + exIndex);
  var toggleEl = document.getElementById('coding-input-toggle-' + exIndex);
  if (inputEl) {
    var isHidden = inputEl.style.display === 'none';
    inputEl.style.display = isHidden ? 'block' : 'none';
    if (toggleEl) toggleEl.textContent = isHidden ? '▼' : '▶';
  }
}

/**
 * Clear output console
 */
function codingClearOutput(exIndex) {
  var outputEl = document.getElementById('coding-output-' + exIndex);
  var resultsEl = document.getElementById('coding-results-' + exIndex);
  if (outputEl) {
    outputEl.innerHTML = '<span class="coding-output-placeholder">Run your code to see output here...</span>';
  }
  if (resultsEl) {
    resultsEl.innerHTML = '<span class="coding-output-placeholder">Submit your code to see test results here...</span>';
  }
}

/**
 * Switch between Output and Test Results tabs
 */
function codingSwitchOutputTab(exIndex, tab) {
  var outputEl = document.getElementById('coding-output-' + exIndex);
  var resultsEl = document.getElementById('coding-results-' + exIndex);
  var tabOutput = document.getElementById('coding-otab-output-' + exIndex);
  var tabResults = document.getElementById('coding-otab-results-' + exIndex);

  if (tab === 'output') {
    if (outputEl) outputEl.style.display = 'block';
    if (resultsEl) resultsEl.style.display = 'none';
    if (tabOutput) tabOutput.classList.add('active');
    if (tabResults) tabResults.classList.remove('active');
  } else {
    if (outputEl) outputEl.style.display = 'none';
    if (resultsEl) resultsEl.style.display = 'block';
    if (tabOutput) tabOutput.classList.remove('active');
    if (tabResults) tabResults.classList.add('active');
  }
}

/**
 * Load sample test cases from API and display them
 */
function codingLoadSampleTestCases(exIndex, exerciseId) {
  if (!exerciseId) return;

  var container = document.getElementById('coding-samples-body-' + exIndex);
  if (!container) return;

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  fetch(BASE_URL + '/api/exercise/test-cases?exerciseId=' + exerciseId, {
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success && data.testCases && data.testCases.length > 0) {
      var html = '';
      data.testCases.forEach(function(tc, i) {
        html += '<div class="coding-sample-case">';
        html += '  <div class="coding-sample-label">Sample ' + (i + 1) + '</div>';
        html += '  <div class="coding-sample-row">';
        html += '    <div class="coding-sample-col">';
        html += '      <span class="coding-sample-col-label">Input</span>';
        html += '      <pre class="coding-sample-pre">' + sanitize(tc.input) + '</pre>';
        html += '    </div>';
        html += '    <div class="coding-sample-col">';
        html += '      <span class="coding-sample-col-label">Expected Output</span>';
        html += '      <pre class="coding-sample-pre">' + sanitize(tc.expectedOutput) + '</pre>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
      });
      container.innerHTML = html;
      // Store sample data for "Use Sample" button
      container.setAttribute('data-samples', JSON.stringify(data.testCases));
    } else {
      container.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;font-style:italic;">No sample test cases available.</span>';
    }
  })
  .catch(function() {
    container.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;font-style:italic;">Could not load test cases.</span>';
  });
}

/**
 * Use first sample test case input in the custom input textarea
 */
function codingUseSampleInput(exIndex) {
  var container = document.getElementById('coding-samples-body-' + exIndex);
  if (!container) return;

  var samplesJson = container.getAttribute('data-samples');
  if (!samplesJson) return;

  try {
    var samples = JSON.parse(samplesJson);
    if (samples.length > 0) {
      var inputEl = document.getElementById('coding-input-' + exIndex);
      if (inputEl) {
        inputEl.value = samples[0].input;
        // Make sure input is visible
        inputEl.style.display = 'block';
        var toggleEl = document.getElementById('coding-input-toggle-' + exIndex);
        if (toggleEl) toggleEl.textContent = '▼';
      }
    }
  } catch (e) {}
}

/**
 * Toggle submission history panel
 */
function codingToggleHistory(exIndex) {
  var bodyEl = document.getElementById('coding-history-body-' + exIndex);
  var toggleEl = document.getElementById('coding-history-toggle-' + exIndex);
  if (bodyEl) {
    var isHidden = bodyEl.style.display === 'none';
    bodyEl.style.display = isHidden ? 'block' : 'none';
    if (toggleEl) toggleEl.textContent = isHidden ? '▼' : '▶';
  }
}

/**
 * Load submission history from API
 */
function codingLoadHistory(exIndex, exerciseId) {
  if (!exerciseId) return;

  var container = document.getElementById('coding-history-body-' + exIndex);
  if (!container) return;

  var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
  if (!token) {
    container.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;">Login to see submission history.</span>';
    return;
  }

  fetch(BASE_URL + '/api/code/submissions?exerciseId=' + exerciseId, {
    headers: { 'Authorization': 'Bearer ' + token },
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.success && data.submissions && data.submissions.length > 0) {
      var html = '<div class="coding-history-list">';
      data.submissions.forEach(function(sub, i) {
        var statusIcon = '⏳';
        var statusColor = 'var(--muted)';
        var statusText = sub.status || 'submitted';

        if (sub.passed || sub.status === 'accepted') {
          statusIcon = '✅';
          statusColor = '#22c55e';
          statusText = 'Accepted';
        } else if (sub.status === 'wrong_answer') {
          statusIcon = '❌';
          statusColor = '#ef4444';
          statusText = 'Wrong Answer';
        } else if (sub.status === 'time_limit') {
          statusIcon = '⏱';
          statusColor = '#f59e0b';
          statusText = 'Time Limit';
        } else if (sub.status === 'runtime_error') {
          statusIcon = '💥';
          statusColor = '#ef4444';
          statusText = 'Runtime Error';
        } else if (sub.status === 'compilation_error') {
          statusIcon = '🔴';
          statusColor = '#ef4444';
          statusText = 'Compilation Error';
        } else if (sub.status === 'memory_limit') {
          statusIcon = '💾';
          statusColor = '#f59e0b';
          statusText = 'Memory Limit';
        }

        var timeAgo = codingTimeAgo(sub.createdAt);
        var langLabel = (sub.language || 'unknown').toUpperCase();

        html += '<div class="coding-history-item">';
        html += '  <div class="coding-history-status" style="color:' + statusColor + ';">' + statusIcon + ' ' + statusText + '</div>';
        html += '  <div class="coding-history-meta">';
        html += '    <span class="coding-history-lang">' + langLabel + '</span>';
        if (sub.executionTime) html += '<span>⏱ ' + sub.executionTime + 'ms</span>';
        if (sub.memoryUsed) html += '<span>💾 ' + Math.round(sub.memoryUsed / 1024) + ' MB</span>';
        html += '    <span class="coding-history-time">' + timeAgo + '</span>';
        html += '  </div>';
        html += '</div>';
      });
      html += '</div>';
      container.innerHTML = html;
    } else {
      container.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;font-style:italic;">No submissions yet for this exercise.</span>';
    }
  })
  .catch(function() {
    container.innerHTML = '<span style="color:var(--muted);font-size:0.8rem;font-style:italic;">Could not load history.</span>';
  });
}

/**
 * Format timestamp to relative time (e.g., "2 min ago", "1 hour ago")
 */
function codingTimeAgo(dateStr) {
  var now = Date.now();
  var date = new Date(dateStr).getTime();
  var diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hour' + (Math.floor(diff / 3600) > 1 ? 's' : '') + ' ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' day' + (Math.floor(diff / 86400) > 1 ? 's' : '') + ' ago';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Open a specific exercise in the Code Editor page (called from Exercise tab)
 */
function codingPgOpenFromExercise(exerciseId) {
  // Navigate to coding page
  if (typeof navigate === 'function') navigate('coding');

  // Wait for page to render, then find and select the problem
  // The exercise from lesson tab might not be in the playground problems list
  // So we fetch exercise data and create a temporary problem entry
  setTimeout(function() {
    // First check if it already exists in loaded problems
    var found = _pgProblems.find(function(p) { return p.id === exerciseId; });
    if (found) {
      codingPgSelectProblem(found.id);
      return;
    }

    // If not in playground problems, fetch exercise details from API and open directly
    var token = localStorage.getItem('ck_token') || sessionStorage.getItem('ck_token') || '';
    var lessonId = (_currentLessonForTabs && _currentLessonForTabs.lessonId) ? _currentLessonForTabs.lessonId : '';
    if (!lessonId) return;

    fetch(BASE_URL + '/api/exercise?lessonId=' + lessonId, {
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.success && data.exercises) {
        var ex = data.exercises.find(function(e) { return e.id === exerciseId; });
        if (ex) {
          // Convert exercise to playground problem format
          var problem = {
            id: ex.id,
            title: ex.title,
            description: ex.description,
            category: 'Course Exercise',
            difficulty: ex.difficulty || 'medium',
            defaultLanguage: ex.language || 'java',
            inputFormat: ex.inputFormat || '',
            outputFormat: ex.outputFormat || '',
            constraints: ex.constraints || '',
            explanation: ex.explanation || '',
            tags: ex.tags || [],
            timeComplexity: ex.timeComplexity || '',
            spaceComplexity: ex.spaceComplexity || '',
            starterCode: { cpp: ex.starterCode || '', python: ex.starterCode || '', javascript: ex.starterCode || '' },
            testCases: [],
            hints: ex.hints || [],
            bestSolution: ex.bestSolution || null,
          };
          // Load test cases
          fetch(BASE_URL + '/api/exercise/test-cases?exerciseId=' + exerciseId, {
            headers: token ? { 'Authorization': 'Bearer ' + token } : {},
          })
          .then(function(r2) { return r2.json(); })
          .then(function(tcData) {
            if (tcData.success && tcData.testCases) {
              problem.testCases = tcData.testCases.map(function(tc) { return { input: tc.input, expectedOutput: tc.expectedOutput, isHidden: false }; });
            }
            _pgActiveProblem = problem;
            var welcome = document.getElementById('coding-pg-welcome');
            var editorArea = document.getElementById('coding-pg-editor-area');
            if (welcome) welcome.style.display = 'none';
            if (editorArea) editorArea.style.display = 'flex';
            codingPgRenderEditor(problem);
          });
        }
      }
    })
    .catch(function() {});
  }, 300);
}

/**
 * Cleanup: Dispose Monaco editors when switching lessons/tabs
 * Called when user navigates away from video page or switches lesson
 */
function codingCleanupEditors() {
  Object.keys(_codingEditors).forEach(function(key) {
    if (_codingEditors[key] && _codingEditors[key].dispose) {
      _codingEditors[key].dispose();
    }
  });
  _codingEditors = {};
  // Don't clear _codingSelectedLang — keep language preference across lessons
}
