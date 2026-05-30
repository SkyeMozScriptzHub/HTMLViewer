/**
 * HTML Tester Pro — script.js (v2)
 * Full production implementation with:
 * - All editor toolbar actions (Select All, Copy, Cut, Paste, Dup Line, Del Line, Undo, Redo, Clear, Clear All, Find, Replace, Go To Line, Word Wrap, Line Numbers, Minimap, Format HTML/CSS/JS)
 * - Android keyboard fixes & continuous backspace/delete
 * - Virtual scrolling / lazy rendering for large files
 * - Preview: Auto Preview toggle, Manual Refresh, Hard Reload, Error Overlay, Preview Console, Perf Monitor, Fullscreen, New Tab
 * - Export WITHOUT JSZip (native Blob approach)
 * - File Management: Create, Rename, Delete, Duplicate, Move, Create Folder, Delete Folder, Rename Folder, Nested Folders, File Search, Quick Open
 * - Multiple Tabs, Pin Tabs, Close Others, Reopen Closed Tab, Split View, Fullscreen Editor, Adjustable Panels
 * - Console Output, JS Error Logs, HTML/CSS Validation, Warning Panel
 * - Mobile: Swipe, Bottom Nav, Touch Targets, Landscape
 */
'use strict';

/* ============================================================
   GLOBAL STATE
============================================================ */
const App = {
  files: {},
  openTabs: [],
  activeTab: null,
  pinnedTabs: new Set(),
  closedTabsHistory: [],
  monacoEditor: null,
  monacoModels: {},
  monacoReady: false,
  isMobile: false,
  settings: {
    fontSize: 14,
    tabSize: 4,
    wordWrap: false,
    lineNumbers: true,
    minimap: false,
    autoRefresh: true,
    autoSave: true,
    showToolbar: true,
    showStatusBar: true,
    projectName: 'untitled-project',
  },
  previewBlobUrls: {},
  currentDevice: 'desktop',
  ctxTarget: null,
  renameTarget: null,
  consoleLogs: [],
  errorCount: 0,
  warnCount: 0,
  previewErrorCount: 0,
  previewLoadStart: 0,
  touchStartX: 0, touchStartY: 0,
  currentView: 'editor',
  autoSaveTimer: null,
  isResizing: false,
  fileSearchQuery: '',
  // Android backspace hold
  _backspaceInterval: null,
};

/* ============================================================
   UTILS
============================================================ */
const $ = id => document.getElementById(id);
const qsa = (sel, el=document) => [...el.querySelectorAll(sel)];

function toast(msg, type='info', dur=3000) {
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-dot"></span><span>${escapeHtml(msg)}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, dur);
}

function isBinaryType(name) { return /\.(png|jpg|jpeg|gif|webp|bmp|ico|svg|woff|woff2|ttf|eot|otf|mp4|mp3|ogg|wav|pdf)$/i.test(name); }
function isImageType(name)  { return /\.(png|jpg|jpeg|gif|webp|bmp|ico|svg)$/i.test(name); }
function isFontType(name)   { return /\.(woff|woff2|ttf|eot|otf)$/i.test(name); }

function getLanguage(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const map = { html:'html', htm:'html', css:'css', js:'javascript', ts:'typescript',
    json:'json', md:'markdown', svg:'xml', xml:'xml', txt:'plaintext', py:'python' };
  return map[ext] || 'plaintext';
}

function getFileIconClass(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['html','htm'].includes(ext)) return 'icon-html';
  if (ext === 'css') return 'icon-css';
  if (['js','ts'].includes(ext)) return 'icon-js';
  if (ext === 'json') return 'icon-json';
  if (isImageType(name)) return 'icon-img';
  if (isFontType(name)) return 'icon-font';
  return 'icon-txt';
}

function getFileIconSVG(name, isFolder=false) {
  if (isFolder) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
  const cls = getFileIconClass(name);
  const ext = (name.split('.').pop()||'').toLowerCase();
  if (['html','htm'].includes(ext)) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${cls}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/></svg>`;
  if (ext === 'css') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${cls}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`;
  if (['js','ts'].includes(ext)) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${cls}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 12 L14 12 L14 17 Q12 19 10 17" stroke-width="1.5"/></svg>`;
  if (isImageType(name)) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${cls}"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="${cls}"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}

function normPath(p) { return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, ''); }
function getDirname(p) { const parts = p.split('/'); parts.pop(); return parts.join('/'); }
function getBasename(p) { return p.split('/').pop(); }

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   INIT
============================================================ */
window.addEventListener('load', async () => {
  App.isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry/i.test(navigator.userAgent) || window.innerWidth < 700;
  loadSettings();
  loadSession();
  setupResizer();
  setupDropZone();
  setupFileInputs();
  setupButtons();
  setupToolbarButtons();
  setupMobileNav();
  setupSwipe();
  setupContextMenu();
  setupKeyboardShortcuts();
  setupDeviceSwitcher();
  initConsoleCapture();
  setupFileSearch();
  setWorkspaceView('editor');
  updateFileCountLabel();
  await initMonaco();
  setTimeout(() => {
    const ls = $('loading-screen');
    ls.classList.add('fade-out');
    setTimeout(() => ls.remove(), 500);
  }, 1400);
});

/* ============================================================
   SETTINGS
============================================================ */
function loadSettings() {
  try {
    const s = localStorage.getItem('htp_settings');
    if (s) Object.assign(App.settings, JSON.parse(s));
  } catch(e) {}
  applySettings();
}
function saveSettings() {
  localStorage.setItem('htp_settings', JSON.stringify(App.settings));
}
function applySettings() {
  if (App.monacoEditor) {
    App.monacoEditor.updateOptions({
      fontSize: App.settings.fontSize,
      tabSize: App.settings.tabSize,
      wordWrap: App.settings.wordWrap ? 'on' : 'off',
      lineNumbers: App.settings.lineNumbers ? 'on' : 'off',
      minimap: { enabled: App.settings.minimap },
    });
  }
  $('project-name-display').textContent = App.settings.projectName;
  if ($('setting-project-name')) $('setting-project-name').value = App.settings.projectName;
  // Auto preview checkbox sync
  const chk = $('chk-auto-preview');
  if (chk) chk.checked = App.settings.autoRefresh;
  // Toolbar toggle buttons state
  updateToolbarToggleStates();
}

function updateToolbarToggleStates() {
  const ww = $('btn-tb-wordwrap');
  const ln = $('btn-tb-linenums');
  const mm = $('btn-tb-minimap');
  if (ww) ww.classList.toggle('active', App.settings.wordWrap);
  if (ln) ln.classList.toggle('active', App.settings.lineNumbers);
  if (mm) mm.classList.toggle('active', App.settings.minimap);
}

/* ============================================================
   SESSION STORAGE
============================================================ */
function saveSession() {
  try {
    const serializable = {};
    for (const [path, f] of Object.entries(App.files)) {
      if (!f.isFolder && typeof f.content === 'string') {
        serializable[path] = { name: f.name, path: f.path, content: f.content, type: f.type, isFolder: false };
      } else if (f.isFolder) {
        serializable[path] = { name: f.name, path: f.path, isFolder: true };
      }
    }
    localStorage.setItem('htp_session_files', JSON.stringify(serializable));
    localStorage.setItem('htp_session_tabs', JSON.stringify(App.openTabs));
    localStorage.setItem('htp_session_active', App.activeTab || '');
    localStorage.setItem('htp_session_pinned', JSON.stringify([...App.pinnedTabs]));
  } catch(e) {}
}

function loadSession() {
  try {
    const fs = localStorage.getItem('htp_session_files');
    const tabs = localStorage.getItem('htp_session_tabs');
    const active = localStorage.getItem('htp_session_active');
    const pinned = localStorage.getItem('htp_session_pinned');
    if (fs) { const parsed = JSON.parse(fs); for (const [path, f] of Object.entries(parsed)) App.files[path] = f; }
    if (tabs) App.openTabs = JSON.parse(tabs) || [];
    App.openTabs = App.openTabs.filter(p => App.files[p]);
    if (active && App.files[active]) App.activeTab = active;
    else if (App.openTabs.length) App.activeTab = App.openTabs[0];
    if (pinned) { const arr = JSON.parse(pinned); arr.forEach(p => App.pinnedTabs.add(p)); }
  } catch(e) {}
  renderFileTree();
  renderTabs();
  if (App.activeTab) activateTab(App.activeTab, true);
  else showEditorEmptyState(true);
}

/* ============================================================
   MONACO EDITOR
============================================================ */
async function initMonaco() {
  return new Promise((resolve) => {
    if (typeof require === 'undefined') {
      App.isMobile = true;
      resolve();
      return;
    }
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
    require(['vs/editor/editor.main'], () => {
      monaco.editor.defineTheme('htp-dark', {
        base: 'vs-dark', inherit: true,
        rules: [
          { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'c678dd' },
          { token: 'string', foreground: '98c379' },
          { token: 'number', foreground: 'd19a66' },
          { token: 'tag', foreground: 'e06c75' },
          { token: 'attribute.name', foreground: 'd19a66' },
          { token: 'attribute.value', foreground: '98c379' },
        ],
        colors: {
          'editor.background': '#0d0f14',
          'editor.foreground': '#abb2bf',
          'editorLineNumber.foreground': '#3b4156',
          'editorLineNumber.activeForeground': '#636d83',
          'editor.selectionBackground': '#2a4a6b',
          'editor.lineHighlightBackground': '#1a1e28',
          'editorCursor.foreground': '#4f9eff',
          'editorWhitespace.foreground': '#2a2f42',
          'editorIndentGuide.background': '#2a2f42',
          'editorIndentGuide.activeBackground': '#3b4156',
          'scrollbarSlider.background': '#2a2f4266',
          'scrollbarSlider.hoverBackground': '#3b415666',
          'minimap.background': '#0d0f14',
        }
      });

      App.monacoEditor = monaco.editor.create($('monaco-container'), {
        value: '', language: 'html', theme: 'htp-dark',
        fontSize: App.settings.fontSize,
        tabSize: App.settings.tabSize,
        wordWrap: App.settings.wordWrap ? 'on' : 'off',
        lineNumbers: App.settings.lineNumbers ? 'on' : 'off',
        minimap: { enabled: App.settings.minimap },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', monospace",
        fontLigatures: true,
        glyphMargin: false,
        folding: true,
        renderWhitespace: 'selection',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        formatOnPaste: false,    // disable for perf on large pastes
        suggest: { showMethods: true, showFunctions: true, showConstructors: true },
        quickSuggestions: { other: true, comments: false, strings: true },
        bracketPairColorization: { enabled: true },
        // Performance: large file optimizations
        largeFileOptimizations: true,
        maxTokenizationLineLength: 4000,
      });

      App.monacoReady = true;

      App.monacoEditor.onDidChangeModelContent(() => {
        if (!App.activeTab) return;
        const f = App.files[App.activeTab];
        if (!f) return;
        f.content = App.monacoEditor.getValue();
        markTabModified(App.activeTab, true);
        if (App.settings.autoSave) {
          clearTimeout(App.autoSaveTimer);
          App.autoSaveTimer = setTimeout(() => {
            markTabModified(App.activeTab, false);
            saveSession();
            if (App.settings.autoRefresh) runPreview();
          }, 800);
        }
      });

      App.monacoEditor.onDidChangeCursorPosition(updateStatusBar);
      App.monacoEditor.onDidChangeCursorSelection(updateStatusBar);

      // Fullscreen editor support
      const fsEditor = monaco.editor.create($('editor-fullscreen-container'), {
        value: '', language: 'html', theme: 'htp-dark',
        fontSize: App.settings.fontSize,
        tabSize: App.settings.tabSize,
        wordWrap: App.settings.wordWrap ? 'on' : 'off',
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', monospace",
        minimap: { enabled: true },
      });
      App._fsEditor = fsEditor;

      if (App.isMobile || 'ontouchstart' in window) {
        patchMonacoForMobile();
      }

      showEditorEmptyState(!App.activeTab);
      resolve();
    });
  });
}

function patchMonacoForMobile() {
  const container = $('monaco-container');
  // Ensure Android keyboard appears on tap
  container.addEventListener('touchend', (e) => {
    setTimeout(() => {
      if (App.monacoEditor) {
        App.monacoEditor.focus();
        const ta = container.querySelector('textarea.inputarea');
        if (ta) { ta.setAttribute('inputmode', 'text'); ta.focus(); }
      }
    }, 50);
  }, { passive: true });
}

function updateStatusBar() {
  if (!App.monacoEditor || !App.activeTab) return;
  const pos = App.monacoEditor.getPosition();
  const sel = App.monacoEditor.getSelection();
  const model = App.monacoEditor.getModel();
  if (!model) return;
  const lang = getLanguage(App.files[App.activeTab]?.name || '');
  $('status-lang').textContent = lang.toUpperCase();
  $('status-pos').textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
  const selLen = sel ? model.getValueInRange(sel).length : 0;
  $('status-selection').textContent = selLen > 0 ? `${selLen} selected` : 'No selection';
  const content = model.getValue();
  $('status-chars').textContent = `${content.length} chars`;
  $('status-lines').textContent = `${model.getLineCount()} lines`;
}

function setEditorContent(path) {
  const f = App.files[path];
  if (!f || f.isFolder) return;
  if (isBinaryType(f.name) && !(typeof f.content === 'string')) {
    showEditorEmptyState(false);
    if (App.monacoEditor) App.monacoEditor.setValue(`// Binary file: ${f.name}\n// Cannot display binary content in editor.`);
    return;
  }
  const content = typeof f.content === 'string' ? f.content : '';
  if (App.monacoReady && App.monacoEditor) {
    showEditorEmptyState(false);
    const lang = getLanguage(f.name);
    // Reuse model for performance
    if (App.monacoModels[path]) {
      App.monacoEditor.setModel(App.monacoModels[path]);
    } else {
      const uri = monaco.Uri.parse(`file:///${path}`);
      let model;
      try { model = monaco.editor.getModel(uri); } catch(e) {}
      if (!model) model = monaco.editor.createModel(content, lang, uri);
      App.monacoModels[path] = model;
      App.monacoEditor.setModel(model);
    }
    if (App.isMobile) syncMobileTextarea(content);
    // Focus (Android keyboard fix: delayed focus)
    setTimeout(() => {
      if (App.monacoEditor && !App.isMobile) App.monacoEditor.focus();
    }, 80);
    updateStatusBar();
  } else {
    showMobileTextareaFallback(content);
  }
  $('monaco-container').style.display = 'block';
  $('mobile-textarea').style.display = 'none';
}

function showMobileTextareaFallback(content) {
  showEditorEmptyState(false);
  $('monaco-container').style.display = 'none';
  const ta = $('mobile-textarea');
  ta.style.display = 'block';
  ta.value = content;

  // Android keyboard fix: explicit inputmode
  ta.setAttribute('inputmode', 'text');

  // Continuous backspace on hold
  setupMobileBackspace(ta);

  ta.oninput = () => {
    if (!App.activeTab) return;
    const f = App.files[App.activeTab];
    if (f) {
      f.content = ta.value;
      markTabModified(App.activeTab, true);
      if (App.settings.autoSave) {
        clearTimeout(App.autoSaveTimer);
        App.autoSaveTimer = setTimeout(() => {
          markTabModified(App.activeTab, false);
          saveSession();
          if (App.settings.autoRefresh) runPreview();
        }, 800);
      }
    }
  };

  ta.onkeydown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = ta.selectionStart, end = ta.selectionEnd;
      const spaces = ' '.repeat(App.settings.tabSize);
      ta.value = ta.value.substring(0, start) + spaces + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + spaces.length;
      ta.dispatchEvent(new Event('input'));
    }
  };

  // Keep focus for Android — re-focus on click
  ta.addEventListener('blur', () => {
    // Only re-focus if user didn't click elsewhere intentionally
    setTimeout(() => {
      if (document.activeElement === document.body && App.currentView === 'editor') {
        ta.focus();
      }
    }, 100);
  });
}

function setupMobileBackspace(ta) {
  // Continuous delete on hold for Android — standard keydown repeat doesn't work reliably
  let holdTimer = null;
  let holdInterval = null;

  function doDelete() {
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === 0 && end === 0) return;
    if (start !== end) {
      // Delete selection
      ta.value = ta.value.substring(0, start) + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start;
    } else {
      ta.value = ta.value.substring(0, start - 1) + ta.value.substring(start);
      ta.selectionStart = ta.selectionEnd = start - 1;
    }
    ta.dispatchEvent(new Event('input'));
  }

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (!holdTimer) {
        holdTimer = setTimeout(() => {
          holdInterval = setInterval(doDelete, 50);
        }, 400);
      }
    }
  });

  const stopHold = () => {
    clearTimeout(holdTimer);
    clearInterval(holdInterval);
    holdTimer = null;
    holdInterval = null;
  };
  ta.addEventListener('keyup', stopHold);
  ta.addEventListener('blur', stopHold);
}

function syncMobileTextarea(content) {
  const ta = $('mobile-textarea');
  if (ta && ta.style.display !== 'none') ta.value = content;
}

function showEditorEmptyState(show) {
  const es = $('editor-empty-state');
  const mc = $('monaco-container');
  const mta = $('mobile-textarea');
  if (es) es.style.display = show ? 'flex' : 'none';
  if (mc) mc.style.display = show ? 'none' : 'block';
  if (mta) mta.style.display = 'none';
}

/* ============================================================
   TOOLBAR BUTTONS
============================================================ */
function setupToolbarButtons() {
  function monacoAction(actionId) {
    if (App.monacoEditor) App.monacoEditor.getAction(actionId)?.run();
  }
  function mobileAction(fn) {
    if (App.monacoReady && App.monacoEditor) return;
    const ta = $('mobile-textarea');
    if (ta && ta.style.display !== 'none') fn(ta);
  }

  // Select All
  $('btn-tb-selectall')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) {
      App.monacoEditor.focus();
      App.monacoEditor.setSelection(App.monacoEditor.getModel().getFullModelRange());
    } else {
      const ta = $('mobile-textarea'); if (ta) { ta.select(); }
    }
  });

  // Copy
  $('btn-tb-copy')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) {
      monacoAction('editor.action.clipboardCopyAction');
    } else {
      mobileAction(ta => { ta.focus(); document.execCommand('copy'); });
    }
  });

  // Cut
  $('btn-tb-cut')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) {
      monacoAction('editor.action.clipboardCutAction');
    } else {
      mobileAction(ta => { ta.focus(); document.execCommand('cut'); });
    }
  });

  // Paste
  $('btn-tb-paste')?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (App.monacoReady && App.monacoEditor) {
        App.monacoEditor.focus();
        const selection = App.monacoEditor.getSelection();
        App.monacoEditor.executeEdits('paste', [{
          range: selection,
          text: text,
          forceMoveMarkers: true,
        }]);
      } else {
        const ta = $('mobile-textarea');
        if (ta) {
          const s = ta.selectionStart, e = ta.selectionEnd;
          ta.value = ta.value.substring(0, s) + text + ta.value.substring(e);
          ta.selectionStart = ta.selectionEnd = s + text.length;
          ta.dispatchEvent(new Event('input'));
        }
      }
    } catch(e) { toast('Paste failed — use Ctrl+V', 'error'); }
  });

  // Undo
  $('btn-tb-undo')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); App.monacoEditor.trigger('toolbar', 'undo', null); }
    else { mobileAction(ta => document.execCommand('undo')); }
  });

  // Redo
  $('btn-tb-redo')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); App.monacoEditor.trigger('toolbar', 'redo', null); }
    else { mobileAction(ta => document.execCommand('redo')); }
  });

  // Duplicate Line
  $('btn-tb-dup-line')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); monacoAction('editor.action.duplicateSelection'); }
    else {
      const ta = $('mobile-textarea');
      if (!ta) return;
      const lines = ta.value.split('\n');
      const pos = ta.selectionStart;
      let count = 0, lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (count + lines[i].length + 1 > pos) { lineIdx = i; break; }
        count += lines[i].length + 1;
      }
      lines.splice(lineIdx + 1, 0, lines[lineIdx]);
      ta.value = lines.join('\n');
      ta.dispatchEvent(new Event('input'));
    }
  });

  // Delete Line
  $('btn-tb-del-line')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); monacoAction('editor.action.deleteLines'); }
    else {
      const ta = $('mobile-textarea');
      if (!ta) return;
      const lines = ta.value.split('\n');
      const pos = ta.selectionStart;
      let count = 0, lineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        if (count + lines[i].length + 1 > pos) { lineIdx = i; break; }
        count += lines[i].length + 1;
      }
      lines.splice(lineIdx, 1);
      ta.value = lines.join('\n');
      ta.dispatchEvent(new Event('input'));
    }
  });

  // Find
  $('btn-tb-find')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); monacoAction('actions.find'); }
  });
  $('btn-search')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); monacoAction('actions.find'); }
  });

  // Replace
  $('btn-tb-replace')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); monacoAction('editor.action.startFindReplaceAction'); }
  });

  // Go To Line
  $('btn-tb-goto')?.addEventListener('click', openGotoModal);

  // Clear File
  $('btn-tb-clear')?.addEventListener('click', () => $('modal-clear').classList.remove('hidden'));
  $('btn-clear-confirm')?.addEventListener('click', () => {
    if (!App.activeTab) return;
    if (App.monacoReady && App.monacoEditor) {
      App.monacoEditor.setValue('');
    } else {
      const ta = $('mobile-textarea'); if (ta) { ta.value = ''; ta.dispatchEvent(new Event('input')); }
    }
    if (App.files[App.activeTab]) App.files[App.activeTab].content = '';
    $('modal-clear').classList.add('hidden');
    toast('File cleared', 'info', 2000);
    saveSession();
  });

  // Clear All Project Files
  $('btn-tb-clear-all')?.addEventListener('click', () => $('modal-clear-all').classList.remove('hidden'));
  $('btn-clear-all-confirm')?.addEventListener('click', () => {
    // Delete all files
    Object.keys(App.files).forEach(p => {
      revokeBlobUrl(p);
      if (App.monacoModels[p]) { App.monacoModels[p].dispose(); delete App.monacoModels[p]; }
    });
    App.files = {};
    App.openTabs = [];
    App.activeTab = null;
    App.closedTabsHistory = [];
    renderTabs();
    renderFileTree();
    showEditorEmptyState(true);
    $('modal-clear-all').classList.add('hidden');
    saveSession();
    updateFileCountLabel();
    toast('All project files cleared', 'success');
  });

  // Format HTML
  $('btn-tb-format-html')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) {
      const lang = getLanguage(App.files[App.activeTab]?.name || '');
      if (lang !== 'html') { toast('Active file is not HTML', 'error', 2000); return; }
      monacoAction('editor.action.formatDocument');
    }
  });

  // Format CSS
  $('btn-tb-format-css')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) {
      const lang = getLanguage(App.files[App.activeTab]?.name || '');
      if (lang !== 'css') { toast('Active file is not CSS', 'error', 2000); return; }
      monacoAction('editor.action.formatDocument');
    }
  });

  // Format JS
  $('btn-tb-format-js')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) {
      const lang = getLanguage(App.files[App.activeTab]?.name || '');
      if (!['javascript','typescript'].includes(lang)) { toast('Active file is not JS/TS', 'error', 2000); return; }
      monacoAction('editor.action.formatDocument');
    }
  });

  // Format (panel header)
  $('btn-format')?.addEventListener('click', () => {
    if (App.monacoReady && App.monacoEditor) { App.monacoEditor.focus(); monacoAction('editor.action.formatDocument'); }
  });

  // Word Wrap toggle (toolbar)
  $('btn-tb-wordwrap')?.addEventListener('click', () => {
    App.settings.wordWrap = !App.settings.wordWrap;
    if (App.monacoEditor) App.monacoEditor.updateOptions({ wordWrap: App.settings.wordWrap ? 'on' : 'off' });
    updateToolbarToggleStates();
    saveSettings();
    toast('Word wrap ' + (App.settings.wordWrap ? 'on' : 'off'), 'info', 1500);
  });

  // Word Wrap (panel header button)
  $('btn-word-wrap')?.addEventListener('click', () => {
    App.settings.wordWrap = !App.settings.wordWrap;
    if (App.monacoEditor) App.monacoEditor.updateOptions({ wordWrap: App.settings.wordWrap ? 'on' : 'off' });
    updateToolbarToggleStates();
    saveSettings();
    toast('Word wrap ' + (App.settings.wordWrap ? 'on' : 'off'), 'info', 1500);
  });

  // Line Numbers toggle
  $('btn-tb-linenums')?.addEventListener('click', () => {
    App.settings.lineNumbers = !App.settings.lineNumbers;
    if (App.monacoEditor) App.monacoEditor.updateOptions({ lineNumbers: App.settings.lineNumbers ? 'on' : 'off' });
    updateToolbarToggleStates();
    saveSettings();
    toast('Line numbers ' + (App.settings.lineNumbers ? 'on' : 'off'), 'info', 1500);
  });

  // Minimap toggle
  $('btn-tb-minimap')?.addEventListener('click', () => {
    App.settings.minimap = !App.settings.minimap;
    if (App.monacoEditor) App.monacoEditor.updateOptions({ minimap: { enabled: App.settings.minimap } });
    updateToolbarToggleStates();
    saveSettings();
    toast('Minimap ' + (App.settings.minimap ? 'on' : 'off'), 'info', 1500);
  });

  // Editor fullscreen
  $('btn-editor-fullscreen')?.addEventListener('click', openEditorFullscreen);
  $('btn-exit-editor-fullscreen')?.addEventListener('click', closeEditorFullscreen);

  // Auto Preview toggle
  $('chk-auto-preview')?.addEventListener('change', (e) => {
    App.settings.autoRefresh = e.target.checked;
    saveSettings();
  });

  // Goto confirm
  $('btn-goto-confirm')?.addEventListener('click', confirmGotoLine);
  $('input-goto-line')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmGotoLine(); });
}

function openGotoModal() {
  const modal = $('modal-goto');
  modal.classList.remove('hidden');
  setTimeout(() => $('input-goto-line')?.focus(), 100);
}

function confirmGotoLine() {
  const val = parseInt($('input-goto-line').value);
  if (!isNaN(val) && App.monacoEditor) {
    App.monacoEditor.revealLineInCenter(val);
    App.monacoEditor.setPosition({ lineNumber: val, column: 1 });
    App.monacoEditor.focus();
  }
  $('modal-goto').classList.add('hidden');
}

/* ============================================================
   EDITOR FULLSCREEN
============================================================ */
function openEditorFullscreen() {
  if (!App.activeTab) return;
  const overlay = $('editor-fullscreen-overlay');
  overlay.classList.remove('hidden');
  const f = App.files[App.activeTab];
  if (f) $('editor-fullscreen-title').textContent = `Editor — ${f.name}`;
  if (App._fsEditor && App.monacoEditor) {
    const model = App.monacoEditor.getModel();
    if (model) App._fsEditor.setModel(model);
    App._fsEditor.updateOptions({ fontSize: App.settings.fontSize, wordWrap: App.settings.wordWrap ? 'on' : 'off' });
    setTimeout(() => App._fsEditor.layout(), 50);
    App._fsEditor.focus();
  }
}

function closeEditorFullscreen() {
  $('editor-fullscreen-overlay').classList.add('hidden');
  if (App.monacoEditor) {
    App.monacoEditor.layout();
    App.monacoEditor.focus();
  }
}

/* ============================================================
   VIRTUAL FILE SYSTEM
============================================================ */
function addFile(path, name, content, type) {
  path = normPath(path);
  App.files[path] = { name, path, content, type: type || 'text', isFolder: false };
  const dir = getDirname(path);
  if (dir) ensureFolder(dir);
  updateFileCountLabel();
  renderFileTree();
}

function addFolder(path) {
  path = normPath(path);
  const name = getBasename(path);
  App.files[path] = { name, path, isFolder: true };
  const parent = getDirname(path);
  if (parent) ensureFolder(parent);
  renderFileTree();
}

function ensureFolder(path) {
  path = normPath(path);
  if (!path || App.files[path]) return;
  const name = getBasename(path);
  App.files[path] = { name, path, isFolder: true };
  const parent = getDirname(path);
  if (parent) ensureFolder(parent);
}

function deleteFile(path) {
  const toDelete = Object.keys(App.files).filter(p => p === path || p.startsWith(path + '/'));
  toDelete.forEach(p => {
    revokeBlobUrl(p);
    delete App.files[p];
    const ti = App.openTabs.indexOf(p);
    if (ti !== -1) App.openTabs.splice(ti, 1);
    App.pinnedTabs.delete(p);
    if (App.monacoModels[p]) { App.monacoModels[p].dispose(); delete App.monacoModels[p]; }
  });
  if (App.activeTab && !App.files[App.activeTab]) App.activeTab = App.openTabs[0] || null;
  renderTabs(); renderFileTree();
  if (App.activeTab) activateTab(App.activeTab, true);
  else showEditorEmptyState(true);
  saveSession(); updateFileCountLabel();
}

function renameFile(oldPath, newName) {
  const f = App.files[oldPath];
  if (!f) return;
  const dir = getDirname(oldPath);
  const newPath = normPath(dir ? `${dir}/${newName}` : newName);
  if (newPath === oldPath) return;
  if (App.files[newPath]) { toast('A file with that name already exists', 'error'); return; }
  const oldPrefix = oldPath + '/';
  const entries = Object.entries(App.files);
  for (const [p, file] of entries) {
    if (p === oldPath || p.startsWith(oldPrefix)) {
      const np = p === oldPath ? newPath : newPath + '/' + p.slice(oldPrefix.length);
      App.files[np] = { ...file, name: p === oldPath ? newName : file.name, path: np };
      delete App.files[p];
      if (App.monacoModels[p]) { App.monacoModels[np] = App.monacoModels[p]; delete App.monacoModels[p]; }
      const ti = App.openTabs.indexOf(p);
      if (ti !== -1) App.openTabs[ti] = np;
      if (App.activeTab === p) App.activeTab = np;
    }
  }
  renderTabs(); renderFileTree(); saveSession();
}

function duplicateFile(path) {
  const f = App.files[path];
  if (!f || f.isFolder) return;
  const dir = getDirname(path);
  const base = f.name.replace(/(\.[^.]+)$/, '_copy$1') || f.name + '_copy';
  const newPath = normPath(dir ? `${dir}/${base}` : base);
  addFile(newPath, base, f.content, f.type);
  saveSession();
}

function updateFileCountLabel() {
  const count = Object.values(App.files).filter(f => !f.isFolder).length;
  $('file-count-label').textContent = `${count} file${count !== 1 ? 's' : ''}`;
}

/* ============================================================
   FILE SEARCH
============================================================ */
function setupFileSearch() {
  const input = $('file-search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    App.fileSearchQuery = input.value.toLowerCase().trim();
    renderFileTree();
  });
}

/* ============================================================
   FILE TREE RENDER
============================================================ */
function renderFileTree() {
  const tree = $('file-tree');
  const hasFiles = Object.keys(App.files).length > 0;
  $('drop-zone').style.display = hasFiles ? 'none' : 'block';
  if (!hasFiles) { tree.innerHTML = ''; return; }
  const roots = buildTreeStructure();
  tree.innerHTML = '';
  renderTreeNodes(roots, tree, 0);
}

function buildTreeStructure() {
  const all = Object.keys(App.files).sort();
  const added = new Set();
  function buildLevel(parentPath) {
    return all
      .filter(p => { const dir = getDirname(p); return dir === parentPath && !added.has(p); })
      .map(p => { added.add(p); const f = App.files[p]; return { ...f, children: f.isFolder ? buildLevel(p) : [] }; });
  }
  return buildLevel('');
}

function renderTreeNodes(nodes, container, depth) {
  nodes.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  const query = App.fileSearchQuery;

  nodes.forEach(node => {
    const matchesSearch = !query || node.name.toLowerCase().includes(query);
    const hasMatchingChild = query && node.isFolder && hasMatchInChildren(node, query);

    const item = document.createElement('div');
    item.className = 'tree-item' + (node.isFolder ? ' folder' : '') + (node.path === App.activeTab ? ' active' : '');
    if (query && !matchesSearch && !hasMatchingChild) item.classList.add('search-hidden');
    item.dataset.path = node.path;
    item.style.paddingLeft = `${8 + depth * 14}px`;

    if (node.isFolder) {
      const arrow = document.createElement('span');
      arrow.className = 'tree-folder-arrow';
      arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><polyline points="9 18 15 12 9 6"/></svg>`;
      const icon = document.createElement('span');
      icon.innerHTML = getFileIconSVG(node.name, true);
      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = node.name;
      item.appendChild(arrow); item.appendChild(icon); item.appendChild(label);

      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';
      const stored = localStorage.getItem(`htp_folder_${node.path}`);
      const isOpen = stored !== 'closed' || (query && hasMatchingChild);
      if (!isOpen) {
        childContainer.classList.add('collapsed');
        childContainer.style.maxHeight = '0';
        arrow.classList.remove('open');
      } else {
        arrow.classList.add('open');
        childContainer.style.maxHeight = '9999px';
      }

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = arrow.classList.toggle('open');
        if (open) {
          childContainer.classList.remove('collapsed');
          childContainer.style.maxHeight = '9999px';
          localStorage.setItem(`htp_folder_${node.path}`, 'open');
        } else {
          childContainer.style.maxHeight = '0';
          setTimeout(() => childContainer.classList.add('collapsed'), 150);
          localStorage.setItem(`htp_folder_${node.path}`, 'closed');
        }
      });

      container.appendChild(item);
      container.appendChild(childContainer);
      if (node.children.length > 0) renderTreeNodes(node.children, childContainer, depth + 1);
    } else {
      const icon = document.createElement('span');
      icon.innerHTML = getFileIconSVG(node.name);
      const label = document.createElement('span');
      label.className = 'tree-label';
      label.textContent = node.name;
      item.appendChild(icon); item.appendChild(label);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openFile(node.path);
        if (App.isMobile) setWorkspaceView('editor');
      });
    }

    item.addEventListener('contextmenu', (e) => { e.preventDefault(); showContextMenu(e.clientX, e.clientY, node.path); });
    let longPressTimer;
    item.addEventListener('touchstart', () => { longPressTimer = setTimeout(() => showContextMenu(item.getBoundingClientRect().right, item.getBoundingClientRect().top, node.path), 600); }, { passive: true });
    item.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });
    item.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
  });
}

function hasMatchInChildren(node, query) {
  if (!node.children) return false;
  for (const child of node.children) {
    if (child.name.toLowerCase().includes(query)) return true;
    if (child.isFolder && hasMatchInChildren(child, query)) return true;
  }
  return false;
}

/* ============================================================
   TABS
============================================================ */
function openFile(path) {
  if (!App.files[path] || App.files[path].isFolder) return;
  if (!App.openTabs.includes(path)) App.openTabs.push(path);
  activateTab(path);
}

function activateTab(path, silent=false) {
  App.activeTab = path;
  renderTabs();
  setEditorContent(path);
  qsa('.tree-item').forEach(el => el.classList.toggle('active', el.dataset.path === path));
  if (!silent) saveSession();
}

function closeTab(path) {
  if (App.pinnedTabs.has(path)) { toast('Unpin tab first to close', 'info', 2000); return; }
  const idx = App.openTabs.indexOf(path);
  if (idx === -1) return;
  App.closedTabsHistory.push(path);
  App.openTabs.splice(idx, 1);
  if (App.activeTab === path) App.activeTab = App.openTabs[Math.min(idx, App.openTabs.length-1)] || null;
  renderTabs();
  if (App.activeTab) activateTab(App.activeTab, true);
  else showEditorEmptyState(true);
  saveSession();
}

function closeOtherTabs(keepPath) {
  App.openTabs = App.openTabs.filter(p => p === keepPath || App.pinnedTabs.has(p));
  App.activeTab = keepPath;
  renderTabs();
  activateTab(keepPath, true);
  saveSession();
}

function reopenLastClosedTab() {
  while (App.closedTabsHistory.length) {
    const path = App.closedTabsHistory.pop();
    if (App.files[path]) { openFile(path); return; }
  }
  toast('No recently closed tabs', 'info', 2000);
}

function pinTab(path) {
  if (App.pinnedTabs.has(path)) {
    App.pinnedTabs.delete(path);
    toast('Tab unpinned', 'info', 1500);
  } else {
    App.pinnedTabs.add(path);
    toast('Tab pinned', 'info', 1500);
  }
  renderTabs();
  saveSession();
}

function renderTabs() {
  const bar = $('tab-bar');
  bar.innerHTML = '';
  // Pinned tabs first
  const sortedTabs = [...App.openTabs].sort((a, b) => {
    const ap = App.pinnedTabs.has(a), bp = App.pinnedTabs.has(b);
    if (ap && !bp) return -1;
    if (!ap && bp) return 1;
    return 0;
  });
  sortedTabs.forEach(path => {
    const f = App.files[path];
    if (!f) return;
    const tab = document.createElement('button');
    tab.className = 'file-tab' + (path === App.activeTab ? ' active' : '') + (App.pinnedTabs.has(path) ? ' pinned' : '');
    tab.dataset.path = path;

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.innerHTML = '×';
    close.title = App.pinnedTabs.has(path) ? 'Pinned — right-click to unpin' : 'Close';
    close.addEventListener('click', e => { e.stopPropagation(); closeTab(path); });

    const icon = document.createElement('span');
    icon.innerHTML = getFileIconSVG(f.name);
    icon.style.cssText = 'width:14px;height:14px;flex-shrink:0;display:inline-flex';

    const name = document.createElement('span');
    name.textContent = f.name;
    name.style.cssText = 'overflow:hidden;text-overflow:ellipsis;flex:1';

    tab.appendChild(icon); tab.appendChild(name); tab.appendChild(close);
    tab.addEventListener('click', () => activateTab(path));
    tab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showTabContextMenu(e.clientX, e.clientY, path);
    });
    bar.appendChild(tab);
  });
}

function showTabContextMenu(x, y, path) {
  // Create temporary tab context menu
  let existing = document.getElementById('tab-ctx-menu');
  if (existing) existing.remove();
  const menu = document.createElement('div');
  menu.id = 'tab-ctx-menu';
  menu.style.cssText = `position:fixed;z-index:1001;left:${Math.min(x, window.innerWidth-160)}px;top:${Math.min(y, window.innerHeight-160)}px;background:var(--bg-elevated);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:4px;min-width:150px;box-shadow:var(--shadow-lg);`;

  const items = [
    { label: App.pinnedTabs.has(path) ? 'Unpin Tab' : 'Pin Tab', fn: () => pinTab(path) },
    { label: 'Close Others', fn: () => closeOtherTabs(path) },
    { label: 'Duplicate File', fn: () => duplicateFile(path) },
    { label: 'Rename', fn: () => openRenameModal(path) },
  ];
  items.forEach(it => {
    const btn = document.createElement('button');
    btn.className = 'ctx-item';
    btn.textContent = it.label;
    btn.addEventListener('click', () => { it.fn(); menu.remove(); });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function markTabModified(path, modified) {
  const tab = $('tab-bar').querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (tab) tab.classList.toggle('modified', modified);
}

function cycleTab(dir) {
  if (!App.openTabs.length) return;
  const ci = App.openTabs.indexOf(App.activeTab);
  const ni = (ci + dir + App.openTabs.length) % App.openTabs.length;
  activateTab(App.openTabs[ni]);
}

/* ============================================================
   PREVIEW ENGINE
============================================================ */
function revokeBlobUrl(path) {
  if (App.previewBlobUrls[path]) { URL.revokeObjectURL(App.previewBlobUrls[path]); delete App.previewBlobUrls[path]; }
}
function revokeAllBlobUrls() { Object.values(App.previewBlobUrls).forEach(u => URL.revokeObjectURL(u)); App.previewBlobUrls = {}; }

function getMimeType(name) {
  const ext = (name.split('.').pop()||'').toLowerCase();
  const map = {
    html:'text/html', htm:'text/html', css:'text/css',
    js:'application/javascript', json:'application/json',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
    gif:'image/gif', webp:'image/webp', svg:'image/svg+xml',
    ico:'image/x-icon', bmp:'image/bmp',
    woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf',
    eot:'application/vnd.ms-fontobject', otf:'font/otf',
    txt:'text/plain', md:'text/markdown',
    mp4:'video/mp4', mp3:'audio/mpeg', ogg:'audio/ogg', wav:'audio/wav',
  };
  return map[ext] || 'application/octet-stream';
}

function buildBlobUrls() {
  revokeAllBlobUrls();
  for (const [path, f] of Object.entries(App.files)) {
    if (f.isFolder) continue;
    const mime = getMimeType(f.name);
    let blob;
    if (f.content instanceof ArrayBuffer) blob = new Blob([f.content], { type: mime });
    else if (typeof f.content === 'string') blob = new Blob([f.content], { type: mime });
    else continue;
    App.previewBlobUrls[path] = URL.createObjectURL(blob);
  }
}

function findEntryFile() {
  const htmlFiles = Object.keys(App.files).filter(p => /\.html?$/i.test(p) && !App.files[p].isFolder);
  if (!htmlFiles.length) return null;
  const indexFile = htmlFiles.find(p => /index\.html?$/i.test(p));
  return indexFile || htmlFiles[0];
}

function runPreview() {
  const entryPath = findEntryFile();
  if (!entryPath) {
    $('preview-empty').classList.remove('hidden');
    return;
  }
  try {
    buildBlobUrls();
    const f = App.files[entryPath];
    let html = typeof f.content === 'string' ? f.content : '';
    html = rewriteAssetPaths(html, entryPath);
    html = injectConsoleCaptureScript(html);
    const previewBlob = new Blob([html], { type: 'text/html' });
    const previewUrl = URL.createObjectURL(previewBlob);
    const iframe = $('preview-iframe');
    App.previewLoadStart = performance.now();
    iframe.src = previewUrl;
    $('preview-empty').classList.add('hidden');
    setTimeout(() => URL.revokeObjectURL(previewUrl), 8000);
    const fsIframe = $('fullscreen-iframe');
    if (!$('fullscreen-overlay').classList.contains('hidden')) {
      fsIframe.src = previewUrl;
    }
    hidePreviewError();
  } catch(e) {
    showPreviewError('Preview failed: ' + e.message);
  }
}

function hardReload() {
  revokeAllBlobUrls();
  $('preview-iframe').src = 'about:blank';
  clearConsole();
  setTimeout(runPreview, 100);
  toast('Hard reload complete', 'info', 1500);
}

function showPreviewError(msg) {
  $('preview-error-msg').textContent = msg;
  $('preview-error-overlay').classList.remove('hidden');
}
function hidePreviewError() {
  $('preview-error-overlay').classList.add('hidden');
}

function rewriteAssetPaths(html, htmlPath) {
  const htmlDir = getDirname(htmlPath);
  html = html.replace(/(src|href)=["']([^"'#?]+)["']/gi, (match, attr, val) => {
    if (val.startsWith('http') || val.startsWith('//') || val.startsWith('data:')) return match;
    const resolved = resolveRelativePath(htmlDir, val);
    const blobUrl = App.previewBlobUrls[resolved];
    if (blobUrl) return `${attr}="${blobUrl}"`;
    return match;
  });
  html = html.replace(/url\(["']?([^"')#?]+)["']?\)/gi, (match, val) => {
    if (val.startsWith('http') || val.startsWith('//') || val.startsWith('data:')) return match;
    const resolved = resolveRelativePath(htmlDir, val);
    const blobUrl = App.previewBlobUrls[resolved];
    if (blobUrl) return `url("${blobUrl}")`;
    return match;
  });
  html = html.replace(/<link([^>]+)rel=["']stylesheet["'][^>]*>/gi, (match, attrs) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return match;
    const href = hrefMatch[1];
    if (href.startsWith('http') || href.startsWith('//')) return match;
    const resolved = resolveRelativePath(htmlDir, href);
    const cssFile = App.files[resolved];
    if (cssFile && typeof cssFile.content === 'string') {
      let css = cssFile.content;
      const cssDir = getDirname(resolved);
      css = css.replace(/url\(["']?([^"')#?]+)["']?\)/gi, (m, v) => {
        if (v.startsWith('http') || v.startsWith('//') || v.startsWith('data:')) return m;
        const r = resolveRelativePath(cssDir, v);
        const b = App.previewBlobUrls[r];
        return b ? `url("${b}")` : m;
      });
      return `<style data-source="${href}">${css}</style>`;
    }
    return match;
  });
  html = html.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
    if (src.startsWith('http') || src.startsWith('//')) return match;
    const resolved = resolveRelativePath(htmlDir, src);
    const jsFile = App.files[resolved];
    if (jsFile && typeof jsFile.content === 'string') {
      return `<script${before}${after}>${jsFile.content}<\/script>`;
    }
    return match;
  });
  return html;
}

function resolveRelativePath(base, relative) {
  if (!relative) return '';
  relative = relative.split('?')[0].split('#')[0];
  if (!base) return normPath(relative);
  const parts = base ? base.split('/') : [];
  const relParts = relative.split('/');
  for (const part of relParts) {
    if (part === '..') parts.pop();
    else if (part !== '.') parts.push(part);
  }
  return normPath(parts.join('/'));
}

function injectConsoleCaptureScript(html) {
  const script = `<script>
(function(){
  var _send=function(type,args,time){
    try{
      var msg=Array.from(args).map(function(a){
        try{return typeof a==='object'?JSON.stringify(a,null,2):String(a);}catch(e){return String(a);}
      }).join(' ');
      window.parent.postMessage({type:'htp_console',level:type,message:msg,ts:time},'*');
    }catch(e){}
  };
  ['log','info','warn','error','debug'].forEach(function(m){
    var orig=console[m].bind(console);
    console[m]=function(){var args=arguments;orig.apply(console,args);_send(m,args,Date.now());};
  });
  window.addEventListener('error',function(e){
    window.parent.postMessage({type:'htp_console',level:'error',message:(e.message||'Unknown error')+(e.filename?' ('+e.filename.split('/').pop()+':'+e.lineno+')'  :''),ts:Date.now()},'*');
  });
  window.addEventListener('unhandledrejection',function(e){
    window.parent.postMessage({type:'htp_console',level:'error',message:'Unhandled Promise: '+(e.reason&&e.reason.message?e.reason.message:String(e.reason||'Unknown')),ts:Date.now()},'*');
  });
  // Notify load time
  window.addEventListener('load',function(){
    window.parent.postMessage({type:'htp_perf',event:'load',ts:Date.now()},'*');
  });
})();
<\/script>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, script + '</head>');
  if (/<body/i.test(html)) return html.replace(/<body/i, script + '<body');
  return script + html;
}

/* ============================================================
   CONSOLE
============================================================ */
function initConsoleCapture() {
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'htp_console') {
      addConsoleEntry(e.data.level, e.data.message);
    }
    if (e.data.type === 'htp_perf' && e.data.event === 'load') {
      const loadTime = Math.round(e.data.ts - App.previewLoadStart);
      if (loadTime > 0 && loadTime < 30000) {
        $('perf-load-time').textContent = loadTime;
      }
    }
  });
  // Track iframe load time
  $('preview-iframe').addEventListener('load', () => {
    const ms = Math.round(performance.now() - App.previewLoadStart);
    if (ms > 0 && ms < 30000) $('perf-load-time').textContent = ms;
  });
}

function addConsoleEntry(level, message) {
  const entry = { level, message, time: new Date().toLocaleTimeString() };
  App.consoleLogs.push(entry);
  if (level === 'error') {
    App.errorCount++;
    App.previewErrorCount++;
    $('perf-error-count').textContent = App.previewErrorCount;
    updateConsoleBadge();
  }
  if (level === 'warn') {
    App.warnCount++;
    $('perf-warn-count').textContent = App.warnCount;
    updateConsoleBadge();
  }
  renderConsoleEntry(entry);
  // Show active tab filter
  const activeTab = document.querySelector('.console-tab.active');
  if (activeTab) filterConsole(activeTab.dataset.tab);
}

function updateConsoleBadge() {
  const eb = $('error-badge'), wb = $('warn-badge');
  if (eb) { eb.textContent = App.errorCount; eb.classList.toggle('hidden', App.errorCount === 0); }
  if (wb) { wb.textContent = App.warnCount;  wb.classList.toggle('hidden', App.warnCount === 0); }
}

function renderConsoleEntry(entry) {
  const out = $('console-output');
  const div = document.createElement('div');
  div.className = `console-entry console-${entry.level}`;
  const icons = {
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="entry-type"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warn:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="entry-type"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    log:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="entry-type"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
    info:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="entry-type"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  div.innerHTML = (icons[entry.level] || icons.log) +
    `<span class="entry-time" style="color:var(--text-muted);margin-right:4px;font-size:10px">${entry.time}</span>` +
    `<span>${escapeHtml(entry.message)}</span>`;
  out.appendChild(div);
  // Virtual scroll: keep max 500 entries in DOM for performance
  const entries = out.querySelectorAll('.console-entry');
  if (entries.length > 500) entries[0].remove();
  out.scrollTop = out.scrollHeight;
}

function clearConsole() {
  App.consoleLogs = [];
  App.errorCount = 0;
  App.warnCount = 0;
  App.previewErrorCount = 0;
  $('console-output').innerHTML = '';
  $('perf-error-count').textContent = '0';
  $('perf-warn-count').textContent = '0';
  updateConsoleBadge();
}

function filterConsole(tab) {
  qsa('.console-entry', $('console-output')).forEach(e => {
    if (tab === 'console') e.style.display = '';
    else if (tab === 'errors') e.style.display = e.classList.contains('console-error') ? '' : 'none';
    else if (tab === 'warnings') e.style.display = e.classList.contains('console-warn') ? '' : 'none';
  });
}

/* ============================================================
   EXPORT — NO JSZIP
============================================================ */
function exportSingleHtml() {
  const entryPath = findEntryFile();
  if (!entryPath) { toast('No HTML file found', 'error'); return; }
  const f = App.files[entryPath];
  let html = typeof f.content === 'string' ? f.content : '';

  // Inline all CSS files
  html = html.replace(/<link([^>]+)rel=["']stylesheet["'][^>]*>/gi, (match, attrs) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return match;
    const href = hrefMatch[1];
    if (href.startsWith('http') || href.startsWith('//')) return match;
    const resolved = resolveRelativePath(getDirname(entryPath), href);
    const cssFile = App.files[resolved];
    return cssFile && typeof cssFile.content === 'string' ? `<style>${cssFile.content}</style>` : match;
  });

  // Inline all JS files
  html = html.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
    if (src.startsWith('http') || src.startsWith('//')) return match;
    const resolved = resolveRelativePath(getDirname(entryPath), src);
    const jsFile = App.files[resolved];
    return jsFile && typeof jsFile.content === 'string' ? `<script${before}${after}>${jsFile.content}<\/script>` : match;
  });

  downloadBlob(new Blob([html], { type: 'text/html' }), (App.settings.projectName || 'project') + '.html');
  $('modal-export').classList.add('hidden');
  toast('Exported as single HTML', 'success');
}

function exportNativeZip() {
  // Pure JS ZIP implementation — no JSZip dependency
  const files = Object.values(App.files).filter(f => !f.isFolder && typeof f.content === 'string');
  if (!files.length) { toast('No text files to export', 'error'); return; }

  try {
    const zipBytes = buildZip(files);
    downloadBlob(new Blob([zipBytes], { type: 'application/zip' }), (App.settings.projectName || 'project') + '.zip');
    $('modal-export').classList.add('hidden');
    toast(`Exported ${files.length} files as ZIP`, 'success');
  } catch(e) {
    toast('ZIP export failed: ' + e.message, 'error');
  }
}

function buildZip(files) {
  // Minimal ZIP builder — stores files uncompressed (STORE method)
  const enc = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  files.forEach(f => {
    const pathBytes = enc.encode(f.path);
    const data = enc.encode(typeof f.content === 'string' ? f.content : '');
    const crc = crc32(data);
    const dosDate = toDosDate(new Date());

    // Local file header
    const lfh = new Uint8Array(30 + pathBytes.length);
    const lfhView = new DataView(lfh.buffer);
    lfhView.setUint32(0, 0x04034b50, true);  // signature
    lfhView.setUint16(4, 20, true);           // version needed
    lfhView.setUint16(6, 0, true);            // flags
    lfhView.setUint16(8, 0, true);            // compression (STORE)
    lfhView.setUint16(10, dosDate.time, true);
    lfhView.setUint16(12, dosDate.date, true);
    lfhView.setUint32(14, crc, true);
    lfhView.setUint32(18, data.length, true);
    lfhView.setUint32(22, data.length, true);
    lfhView.setUint16(26, pathBytes.length, true);
    lfhView.setUint16(28, 0, true);           // extra length
    lfh.set(pathBytes, 30);

    parts.push(lfh, data);

    // Central directory entry
    const cde = new Uint8Array(46 + pathBytes.length);
    const cdeView = new DataView(cde.buffer);
    cdeView.setUint32(0, 0x02014b50, true);  // signature
    cdeView.setUint16(4, 20, true);
    cdeView.setUint16(6, 20, true);
    cdeView.setUint16(8, 0, true);
    cdeView.setUint16(10, 0, true);
    cdeView.setUint16(12, dosDate.time, true);
    cdeView.setUint16(14, dosDate.date, true);
    cdeView.setUint32(16, crc, true);
    cdeView.setUint32(20, data.length, true);
    cdeView.setUint32(24, data.length, true);
    cdeView.setUint16(28, pathBytes.length, true);
    cdeView.setUint16(30, 0, true);
    cdeView.setUint16(32, 0, true);
    cdeView.setUint16(34, 0, true);
    cdeView.setUint16(36, 0, true);
    cdeView.setUint32(38, 0x81a40000, true);
    cdeView.setUint32(42, offset, true);
    cde.set(pathBytes, 46);
    centralDir.push(cde);

    offset += lfh.length + data.length;
  });

  const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  const allParts = [...parts, ...centralDir, eocd];
  const total = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  allParts.forEach(p => { result.set(p, pos); pos += p.length; });
  return result;
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = crc32Table();
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
let _crc32Table = null;
function crc32Table() {
  if (_crc32Table) return _crc32Table;
  _crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    _crc32Table[i] = c;
  }
  return _crc32Table;
}
function toDosDate(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function exportEachFile() {
  const files = Object.values(App.files).filter(f => !f.isFolder && typeof f.content === 'string');
  if (!files.length) { toast('No files to export', 'error'); return; }
  files.forEach((f, i) => {
    setTimeout(() => {
      downloadBlob(new Blob([f.content], { type: getMimeType(f.name) }), f.name);
    }, i * 200);
  });
  $('modal-export').classList.add('hidden');
  toast(`Downloading ${files.length} files…`, 'success');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ============================================================
   ZIP IMPORT (still using JSZip if available, else raw)
============================================================ */
async function importZip(file) {
  if (!window.JSZip) {
    toast('JSZip not available — importing as raw files only', 'error', 3000);
    return;
  }
  try {
    toast('Importing ZIP...', 'info');
    const zip = await JSZip.loadAsync(file);
    const projectName = file.name.replace(/\.zip$/i, '');
    App.settings.projectName = projectName;
    $('project-name-display').textContent = projectName;
    const promises = [];
    zip.forEach((relPath, zipEntry) => {
      if (zipEntry.dir) { addFolder(normPath(relPath)); return; }
      if (relPath.includes('__MACOSX') || relPath.includes('.DS_Store')) return;
      const p = normPath(relPath), name = getBasename(p);
      if (isBinaryType(name)) {
        promises.push(zipEntry.async('arraybuffer').then(buf => addFile(p, name, buf, 'binary')));
      } else {
        promises.push(zipEntry.async('string').then(content => addFile(p, name, content, 'text')));
      }
    });
    await Promise.all(promises);
    renderFileTree(); saveSession();
    const entry = findEntryFile();
    if (entry) { openFile(entry); runPreview(); }
    toast(`Imported ${promises.length} files from ${file.name}`, 'success');
  } catch(e) {
    toast('Failed to import ZIP: ' + e.message, 'error');
  }
}

/* ============================================================
   FILE UPLOAD
============================================================ */
async function handleFileUpload(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip') && window.JSZip) {
    await importZip(files[0]); return;
  }
  let count = 0;
  for (const file of files) {
    const path = normPath(file.webkitRelativePath || file.name);
    const name = getBasename(path);
    if (isBinaryType(name)) {
      const buf = await file.arrayBuffer();
      addFile(path, name, buf, 'binary');
    } else {
      const text = await file.text();
      addFile(path, name, text, 'text');
    }
    count++;
  }
  renderFileTree(); saveSession(); updateFileCountLabel();
  if (!App.activeTab) {
    const htmlFile = Object.keys(App.files).find(p => /\.html?$/i.test(p));
    if (htmlFile) { openFile(htmlFile); runPreview(); }
  } else if (App.settings.autoRefresh) { runPreview(); }
  toast(`Added ${count} file${count !== 1 ? 's' : ''}`, 'success');
}

/* ============================================================
   DROP ZONE
============================================================ */
function setupDropZone() {
  const sidebar = $('sidebar'), dz = $('drop-zone');
  ['dragenter','dragover'].forEach(evt => sidebar.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add('drag-over'); }));
  ['dragleave','drop'].forEach(evt => sidebar.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('drag-over'); }));
  sidebar.addEventListener('drop', (e) => {
    const items = e.dataTransfer?.items || [];
    const files = e.dataTransfer?.files || [];
    if (items.length > 0) {
      const entries = [];
      for (let i = 0; i < items.length; i++) { const entry = items[i].webkitGetAsEntry?.(); if (entry) entries.push(entry); }
      if (entries.length) { processEntries(entries, ''); return; }
    }
    handleFileUpload(files);
  });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) handleFileUpload(e.dataTransfer.files); });
}

async function processEntries(entries, basePath) {
  for (const entry of entries) {
    if (entry.isFile) {
      await new Promise(res => {
        entry.file(file => {
          const path = normPath(basePath ? `${basePath}/${entry.name}` : entry.name), name = entry.name;
          if (isBinaryType(name)) { file.arrayBuffer().then(buf => { addFile(path, name, buf, 'binary'); res(); }); }
          else { file.text().then(text => { addFile(path, name, text, 'text'); res(); }); }
        });
      });
    } else if (entry.isDirectory) {
      const dirPath = normPath(basePath ? `${basePath}/${entry.name}` : entry.name);
      addFolder(dirPath);
      await new Promise(res => {
        entry.createReader().readEntries(async childEntries => { await processEntries(childEntries, dirPath); res(); });
      });
    }
  }
  renderFileTree(); saveSession(); updateFileCountLabel();
  if (!App.activeTab) {
    const htmlFile = Object.keys(App.files).find(p => /\.html?$/i.test(p));
    if (htmlFile) { openFile(htmlFile); runPreview(); }
  }
  toast('Files imported', 'success');
}

/* ============================================================
   FILE INPUTS
============================================================ */
function setupFileInputs() {
  const fileInput = $('file-input-upload');
  fileInput.addEventListener('change', () => { handleFileUpload(fileInput.files); fileInput.value = ''; });
  const zipInput = $('file-input-zip');
  zipInput.addEventListener('change', () => { if (zipInput.files[0]) importZip(zipInput.files[0]); zipInput.value = ''; });
  $('btn-drop-upload').addEventListener('click', () => fileInput.click());
}

/* ============================================================
   MAIN BUTTONS
============================================================ */
function setupButtons() {
  $('sidebar-toggle').addEventListener('click', toggleSidebar);
  $('btn-run').addEventListener('click', () => {
    saveCurrentFile();
    runPreview();
    if (App.isMobile) setWorkspaceView('preview');
  });
  $('btn-import-zip').addEventListener('click', () => $('file-input-zip').click());
  $('btn-export-zip').addEventListener('click', () => $('modal-export').classList.remove('hidden'));
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-new-file').addEventListener('click', () => openNewFileModal());
  $('btn-new-file-sidebar').addEventListener('click', () => openNewFileModal());
  $('btn-new-folder').addEventListener('click', () => openNewFolderModal());
  $('btn-upload-files').addEventListener('click', () => $('file-input-upload').click());
  $('btn-collapse-all').addEventListener('click', collapseAllFolders);

  $('btn-refresh-preview').addEventListener('click', () => { clearConsole(); runPreview(); addConsoleEntry('info', '↻ Preview refreshed'); });
  $('btn-hard-reload').addEventListener('click', hardReload);
  $('btn-fullscreen-preview').addEventListener('click', openFullscreenPreview);
  $('btn-newtab-preview').addEventListener('click', openPreviewInNewTab);

  // Preview error overlay dismiss
  $('btn-dismiss-error')?.addEventListener('click', hidePreviewError);

  // Performance monitor
  $('btn-show-perf')?.addEventListener('click', () => {
    const bar = $('preview-perf-bar');
    bar.classList.toggle('hidden');
  });
  $('btn-toggle-perf')?.addEventListener('click', () => $('preview-perf-bar').classList.add('hidden'));

  $('btn-clear-console').addEventListener('click', clearConsole);
  $('btn-toggle-console').addEventListener('click', toggleConsole);

  // Console tabs
  qsa('.console-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.console-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterConsole(btn.dataset.tab);
    });
  });

  // Modals
  $('btn-create-file-confirm').addEventListener('click', createNewFile);
  $('btn-create-folder-confirm').addEventListener('click', createNewFolder);
  $('btn-rename-confirm').addEventListener('click', confirmRename);
  $('btn-save-settings').addEventListener('click', applyAndSaveSettings);

  $('btn-empty-new').addEventListener('click', () => openNewFileModal());
  $('btn-empty-upload').addEventListener('click', () => $('file-input-upload').click());

  $('btn-exit-fullscreen').addEventListener('click', () => $('fullscreen-overlay').classList.add('hidden'));

  // Export
  $('btn-export-html-only').addEventListener('click', exportSingleHtml);
  $('btn-export-zip-native').addEventListener('click', exportNativeZip);
  $('btn-export-each').addEventListener('click', exportEachFile);

  // Modal closes
  qsa('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.add('hidden'));
  });
  qsa('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });

  // Modal Enter key
  [$('input-new-filename'), $('input-new-foldername'), $('input-rename')].forEach(input => {
    if (!input) return;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.closest('.modal-overlay').querySelector('.action-btn:last-child')?.click(); });
  });

  // Settings range
  const fs = $('setting-fontsize');
  if (fs) fs.addEventListener('input', () => { $('setting-fontsize-val').textContent = fs.value; });
}

function toggleSidebar() {
  const s = $('sidebar');
  if (App.isMobile) s.classList.toggle('mobile-open');
  else s.classList.toggle('collapsed');
}

function toggleConsole() {
  $('console-panel').classList.toggle('collapsed');
  const btn = $('btn-toggle-console');
  const isCollapsed = $('console-panel').classList.contains('collapsed');
  btn.querySelector('svg').style.transform = isCollapsed ? 'rotate(180deg)' : '';
}

function collapseAllFolders() {
  qsa('.tree-folder-arrow').forEach(a => a.classList.remove('open'));
  qsa('.tree-children').forEach(c => { c.style.maxHeight = '0'; c.classList.add('collapsed'); });
}

function openFullscreenPreview() {
  const overlay = $('fullscreen-overlay');
  overlay.classList.remove('hidden');
  const entry = findEntryFile();
  if (!entry) return;
  buildBlobUrls();
  const f = App.files[entry];
  let html = rewriteAssetPaths(f.content || '', entry);
  html = injectConsoleCaptureScript(html);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  $('fullscreen-iframe').src = url;
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function openPreviewInNewTab() {
  const entry = findEntryFile();
  if (!entry) { toast('No HTML file found', 'error'); return; }
  buildBlobUrls();
  const f = App.files[entry];
  let html = rewriteAssetPaths(f.content || '', entry);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function saveCurrentFile() {
  if (!App.activeTab) return;
  const f = App.files[App.activeTab];
  if (!f) return;
  if (App.monacoReady && App.monacoEditor) f.content = App.monacoEditor.getValue();
  markTabModified(App.activeTab, false);
  saveSession();
}

/* ============================================================
   MODALS: New File / Folder / Rename / Settings
============================================================ */
function getFolderOptions() {
  return ['(root)', ...Object.keys(App.files).filter(p => App.files[p].isFolder)];
}

function openNewFileModal(parentFolder='') {
  const modal = $('modal-new-file');
  modal.classList.remove('hidden');
  const select = $('select-new-file-folder');
  select.innerHTML = '';
  getFolderOptions().forEach(f => {
    const opt = document.createElement('option');
    opt.value = f === '(root)' ? '' : f;
    opt.textContent = f;
    if (f === parentFolder || (f === '(root)' && !parentFolder)) opt.selected = true;
    select.appendChild(opt);
  });
  $('input-new-filename').value = '';
  setTimeout(() => $('input-new-filename').focus(), 100);
}

function openNewFolderModal() {
  $('modal-new-folder').classList.remove('hidden');
  const select = $('select-new-folder-parent');
  select.innerHTML = '';
  getFolderOptions().forEach(f => {
    const opt = document.createElement('option');
    opt.value = f === '(root)' ? '' : f;
    opt.textContent = f;
    select.appendChild(opt);
  });
  $('input-new-foldername').value = '';
  setTimeout(() => $('input-new-foldername').focus(), 100);
}

function createNewFile() {
  const name = $('input-new-filename').value.trim();
  if (!name) { toast('Enter a file name', 'error'); return; }
  const folder = $('select-new-file-folder').value;
  const path = normPath(folder ? `${folder}/${name}` : name);
  if (App.files[path]) { toast('File already exists', 'error'); return; }
  const defaults = {
    html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
    css: `/* Styles */\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: sans-serif;\n}\n`,
    js: `// JavaScript\nconsole.log('Hello World!');\n`,
    json: `{\n  "name": "project",\n  "version": "1.0.0"\n}\n`,
  };
  const ext = (name.split('.').pop()||'').toLowerCase();
  addFile(path, name, defaults[ext] || '', 'text');
  $('modal-new-file').classList.add('hidden');
  openFile(path);
  saveSession();
  toast(`Created ${name}`, 'success', 2000);
}

function createNewFolder() {
  const name = $('input-new-foldername').value.trim();
  if (!name) { toast('Enter a folder name', 'error'); return; }
  const parent = $('select-new-folder-parent').value;
  const path = normPath(parent ? `${parent}/${name}` : name);
  if (App.files[path]) { toast('Already exists', 'error'); return; }
  addFolder(path);
  $('modal-new-folder').classList.add('hidden');
  saveSession();
  toast(`Created folder ${name}`, 'success', 2000);
}

function openRenameModal(path) {
  App.renameTarget = path;
  $('input-rename').value = getBasename(path);
  $('modal-rename').classList.remove('hidden');
  setTimeout(() => { $('input-rename').focus(); $('input-rename').select(); }, 100);
}

function confirmRename() {
  const newName = $('input-rename').value.trim();
  if (!newName || !App.renameTarget) return;
  renameFile(App.renameTarget, newName);
  App.renameTarget = null;
  $('modal-rename').classList.add('hidden');
  toast('Renamed successfully', 'success', 2000);
}

function openSettings() {
  const s = App.settings;
  $('setting-fontsize').value = s.fontSize;
  $('setting-fontsize-val').textContent = s.fontSize;
  $('setting-tabsize').value = s.tabSize;
  $('setting-wordwrap').checked = s.wordWrap;
  $('setting-linenums').checked = s.lineNumbers;
  $('setting-minimap').checked = s.minimap;
  $('setting-autorefresh').checked = s.autoRefresh;
  $('setting-autosave').checked = s.autoSave;
  if ($('setting-toolbar')) $('setting-toolbar').checked = s.showToolbar;
  if ($('setting-statusbar')) $('setting-statusbar').checked = s.showStatusBar;
  $('setting-project-name').value = s.projectName;
  $('modal-settings').classList.remove('hidden');
}

function applyAndSaveSettings() {
  App.settings.fontSize = parseInt($('setting-fontsize').value);
  App.settings.tabSize = parseInt($('setting-tabsize').value);
  App.settings.wordWrap = $('setting-wordwrap').checked;
  App.settings.lineNumbers = $('setting-linenums').checked;
  App.settings.minimap = $('setting-minimap').checked;
  App.settings.autoRefresh = $('setting-autorefresh').checked;
  App.settings.autoSave = $('setting-autosave').checked;
  App.settings.projectName = $('setting-project-name').value.trim() || 'untitled-project';
  applySettings();
  saveSettings();
  $('modal-settings').classList.add('hidden');
  toast('Settings saved', 'success', 2000);
}

/* ============================================================
   CONTEXT MENU
============================================================ */
function setupContextMenu() {
  const menu = $('context-menu');
  document.addEventListener('click', () => menu.classList.add('hidden'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.classList.add('hidden'); $('editor-fullscreen-overlay').classList.add('hidden'); $('fullscreen-overlay').classList.add('hidden'); } });
  qsa('.ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      if (!App.ctxTarget) return;
      const action = item.dataset.action;
      if (action === 'open') openFile(App.ctxTarget);
      else if (action === 'rename') openRenameModal(App.ctxTarget);
      else if (action === 'duplicate') { duplicateFile(App.ctxTarget); toast('Duplicated', 'success', 1500); }
      else if (action === 'delete') {
        if (confirm(`Delete "${getBasename(App.ctxTarget)}"?`)) { deleteFile(App.ctxTarget); toast('Deleted', 'info', 1500); }
      }
      menu.classList.add('hidden');
    });
  });
}

function showContextMenu(x, y, path) {
  App.ctxTarget = path;
  const menu = $('context-menu');
  menu.classList.remove('hidden');
  const isFolder = App.files[path]?.isFolder;
  menu.querySelector('[data-action="open"]').style.display = isFolder ? 'none' : '';
  menu.querySelector('[data-action="duplicate"]').style.display = isFolder ? 'none' : '';
  const mw = 150, mh = 140;
  menu.style.left = Math.min(x, window.innerWidth - mw - 4) + 'px';
  menu.style.top  = Math.min(y, window.innerHeight - mh - 4) + 'px';
}

/* ============================================================
   DEVICE SWITCHER
============================================================ */
function setupDeviceSwitcher() {
  qsa('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.currentDevice = btn.dataset.device;
      $('device-frame').className = 'device-' + App.currentDevice;
      $('preview-viewport').style.background = App.currentDevice === 'desktop' ? 'transparent' : '#555';
    });
  });
}

/* ============================================================
   RESIZER
============================================================ */
function setupResizer() {
  const resizer = $('resizer');
  const editorPanel = $('editor-panel');
  const previewPanel = $('preview-panel');
  let startX, startEditorW;

  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    App.isResizing = true;
    startX = e.clientX;
    startEditorW = editorPanel.getBoundingClientRect().width;
    document.body.classList.add('resizing');
    resizer.classList.add('dragging');
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!App.isResizing) return;
    const diff = e.clientX - startX;
    const totalW = $('editor-area').getBoundingClientRect().width - resizer.offsetWidth;
    const newEditorW = Math.max(200, Math.min(totalW - 200, startEditorW + diff));
    editorPanel.style.flex = 'none';
    editorPanel.style.width = newEditorW + 'px';
    previewPanel.style.flex = 'none';
    previewPanel.style.width = (totalW - newEditorW) + 'px';
  }
  function onMouseUp() {
    App.isResizing = false;
    document.body.classList.remove('resizing');
    resizer.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  resizer.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startEditorW = editorPanel.getBoundingClientRect().width;
    resizer.classList.add('dragging');
  }, { passive: true });
  resizer.addEventListener('touchmove', (e) => {
    const diff = e.touches[0].clientX - startX;
    const totalW = $('editor-area').getBoundingClientRect().width - resizer.offsetWidth;
    const newEditorW = Math.max(200, Math.min(totalW - 200, startEditorW + diff));
    editorPanel.style.flex = 'none';
    editorPanel.style.width = newEditorW + 'px';
    previewPanel.style.flex = 'none';
    previewPanel.style.width = (totalW - newEditorW) + 'px';
  }, { passive: true });
  resizer.addEventListener('touchend', () => resizer.classList.remove('dragging'), { passive: true });
}

/* ============================================================
   MOBILE NAV
============================================================ */
function setupMobileNav() {
  qsa('.mobile-nav-btn').forEach(btn => btn.addEventListener('click', () => setWorkspaceView(btn.dataset.view)));
  checkMobile();
  window.addEventListener('resize', checkMobile);
}

function checkMobile() {
  App.isMobile = window.innerWidth < 700;
  $('mobile-nav').style.display = App.isMobile ? 'flex' : 'none';
  // Re-layout monaco on resize
  if (App.monacoEditor) App.monacoEditor.layout();
}

function setWorkspaceView(view) {
  App.currentView = view;
  const ws = $('workspace');
  ws.className = '';
  if (view === 'files') {
    $('sidebar').classList.add('mobile-open');
  } else {
    $('sidebar').classList.remove('mobile-open');
    ws.classList.add(`view-${view}`);
  }
  qsa('.mobile-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  // On mobile, switch to textarea if Monaco isn't ready/available
  if (view === 'editor' && App.activeTab && !App.monacoReady) {
    const f = App.files[App.activeTab];
    if (f) showMobileTextareaFallback(f.content || '');
  }
  // Focus fix: give keyboard focus back when switching to editor
  if (view === 'editor') {
    setTimeout(() => {
      if (App.monacoReady && App.monacoEditor) {
        App.monacoEditor.layout();
        if (!App.isMobile) App.monacoEditor.focus();
      } else {
        const ta = $('mobile-textarea');
        if (ta && ta.style.display !== 'none') ta.focus();
      }
    }, 100);
  }
}

/* ============================================================
   SWIPE SUPPORT
============================================================ */
function setupSwipe() {
  const workspace = $('workspace');
  workspace.addEventListener('touchstart', (e) => {
    App.touchStartX = e.touches[0].clientX;
    App.touchStartY = e.touches[0].clientY;
  }, { passive: true });
  workspace.addEventListener('touchend', (e) => {
    if (!App.isMobile) return;
    const dx = e.changedTouches[0].clientX - App.touchStartX;
    const dy = e.changedTouches[0].clientY - App.touchStartY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const views = ['editor', 'preview'];
    const ci = views.indexOf(App.currentView);
    if (ci === -1) return;
    if (dx < -50 && ci < views.length - 1) setWorkspaceView(views[ci + 1]);
    else if (dx > 50 && ci > 0) setWorkspaceView(views[ci - 1]);
  }, { passive: true });
}

/* ============================================================
   KEYBOARD SHORTCUTS
============================================================ */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) return;
    switch(e.key) {
      case 's': e.preventDefault(); saveCurrentFile(); toast('Saved', 'success', 1000); if (App.settings.autoRefresh) runPreview(); break;
      case 'Enter': e.preventDefault(); runPreview(); break;
      case 'n': e.preventDefault(); openNewFileModal(); break;
      case 'b': e.preventDefault(); toggleSidebar(); break;
      case 'j': e.preventDefault(); toggleConsole(); break;
      case 'e': e.preventDefault(); $('modal-export').classList.remove('hidden'); break;
      case 'Tab': e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); break;
      case 'g': e.preventDefault(); openGotoModal(); break;
      case 'z': if (e.shiftKey) { e.preventDefault(); if (App.monacoEditor) App.monacoEditor.trigger('kb', 'redo', null); } break;
      case 'w': e.preventDefault(); if (App.activeTab) closeTab(App.activeTab); break;
      case 't': if (e.shiftKey) { e.preventDefault(); reopenLastClosedTab(); } break;
    }
  });
}

/* ============================================================
   ORIENTATION / RESIZE
============================================================ */
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    checkMobile();
    if (App.monacoEditor) App.monacoEditor.layout();
  }, 300);
});
window.addEventListener('resize', () => {
  if (App.monacoEditor) App.monacoEditor.layout();
  checkMobile();
});

/* ============================================================
   STARTER TEMPLATE
============================================================ */
function initStarterTemplate() {
  if (Object.keys(App.files).length > 0) return;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Project</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>Hello, World!</h1>
    <p>Welcome to <strong>HTML Tester Pro</strong>. Edit these files to get started.</p>
    <button id="clickMe">Click me!</button>
    <div id="output"></div>
  </div>
  <script src="script.js"><\/script>
</body>
</html>`;

  const cssContent = `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.container {
  text-align: center;
  padding: 40px;
  background: rgba(255,255,255,0.05);
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  max-width: 500px;
  width: 90%;
}
h1 {
  font-size: 2.5rem;
  margin-bottom: 16px;
  background: linear-gradient(90deg, #4f9eff, #b07eff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
p { color: rgba(255,255,255,0.7); margin-bottom: 24px; line-height: 1.6; }
button {
  padding: 12px 28px;
  background: linear-gradient(135deg, #4f9eff, #b07eff);
  border: none; border-radius: 30px; color: #fff;
  font-size: 16px; cursor: pointer; transition: all 0.3s ease; font-weight: 600;
}
button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(79,158,255,0.4); }
#output { margin-top: 20px; color: #4edf8c; font-size: 18px; font-weight: 600; }`;

  const jsContent = `// JavaScript is working!
let count = 0;
document.getElementById('clickMe').addEventListener('click', function() {
  count++;
  const output = document.getElementById('output');
  output.textContent = '🎉 Clicked ' + count + ' time' + (count !== 1 ? 's' : '') + '!';
  console.log('Button clicked! Count:', count);
});
console.log('Script loaded successfully!');`;

  addFile('index.html', 'index.html', htmlContent, 'text');
  addFile('style.css', 'style.css', cssContent, 'text');
  addFile('script.js', 'script.js', jsContent, 'text');
  renderFileTree();
  openFile('index.html');
  runPreview();
  saveSession();
}

window.addEventListener('load', () => { setTimeout(initStarterTemplate, 1600); });
