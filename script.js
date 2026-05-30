/**
 * HTML Tester Pro — script.js
 * Full production implementation.
 * Features: Monaco editor (+ mobile textarea fallback), virtual file system,
 * ZIP import/export, live preview engine with blob URLs, device emulator,
 * console capture, file tree, drag-and-drop, session storage, and more.
 */

'use strict';

/* ============================================================
   GLOBAL STATE
============================================================ */
const App = {
  // Virtual file system: { 'path/to/file.html': { name, path, content (string|ArrayBuffer), type, isFolder, blobUrl? } }
  files: {},
  // Currently open file tabs: [ path, ... ]
  openTabs: [],
  activeTab: null,
  // Monaco editor instance
  monacoEditor: null,
  monacoModels: {}, // path -> monaco model
  monacoReady: false,
  isMobile: false,
  // Settings
  settings: {
    fontSize: 14,
    tabSize: 4,
    wordWrap: false,
    autoRefresh: true,
    autoSave: true,
    projectName: 'untitled-project',
  },
  // Preview
  previewBlobUrls: {},
  currentDevice: 'desktop',
  // Context menu target
  ctxTarget: null,
  // Rename target
  renameTarget: null,
  // Console
  consoleLogs: [],
  errorCount: 0,
  warnCount: 0,
  // Swipe
  touchStartX: 0, touchStartY: 0,
  currentView: 'editor',
  // Autosave timer
  autoSaveTimer: null,
  // Resizer
  isResizing: false,
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
  t.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, dur);
}

function isBinaryType(name) {
  return /\.(png|jpg|jpeg|gif|webp|bmp|ico|svg|woff|woff2|ttf|eot|otf|mp4|mp3|ogg|wav|pdf)$/i.test(name);
}
function isImageType(name) {
  return /\.(png|jpg|jpeg|gif|webp|bmp|ico|svg)$/i.test(name);
}
function isFontType(name) {
  return /\.(woff|woff2|ttf|eot|otf)$/i.test(name);
}
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
  setupMobileNav();
  setupSwipe();
  setupContextMenu();
  setupKeyboardShortcuts();
  setupDeviceSwitcher();
  initConsoleCapture();

  // Set initial workspace view
  setWorkspaceView('editor');
  updateFileCountLabel();

  // Init Monaco
  await initMonaco();

  // Fake load progress then show app
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
    });
  }
  $('project-name-display').textContent = App.settings.projectName;
  $('setting-project-name') && ($('setting-project-name').value = App.settings.projectName);
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
      // Binary files are not persisted to localStorage (too large, use IndexedDB for prod)
    }
    localStorage.setItem('htp_session_files', JSON.stringify(serializable));
    localStorage.setItem('htp_session_tabs', JSON.stringify(App.openTabs));
    localStorage.setItem('htp_session_active', App.activeTab || '');
  } catch(e) { /* storage full */ }
}
function loadSession() {
  try {
    const fs = localStorage.getItem('htp_session_files');
    const tabs = localStorage.getItem('htp_session_tabs');
    const active = localStorage.getItem('htp_session_active');
    if (fs) {
      const parsed = JSON.parse(fs);
      for (const [path, f] of Object.entries(parsed)) {
        App.files[path] = f;
      }
    }
    if (tabs) App.openTabs = JSON.parse(tabs) || [];
    // Remove tabs that don't exist in files
    App.openTabs = App.openTabs.filter(p => App.files[p]);
    if (active && App.files[active]) App.activeTab = active;
    else if (App.openTabs.length) App.activeTab = App.openTabs[0];
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
      console.warn('Monaco loader not available, falling back to textarea');
      App.isMobile = true;
      resolve();
      return;
    }
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' }});
    require(['vs/editor/editor.main'], () => {
      // Custom dark theme
      monaco.editor.defineTheme('htp-dark', {
        base: 'vs-dark',
        inherit: true,
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
        value: '',
        language: 'html',
        theme: 'htp-dark',
        fontSize: App.settings.fontSize,
        tabSize: App.settings.tabSize,
        wordWrap: App.settings.wordWrap ? 'on' : 'off',
        minimap: { enabled: window.innerWidth > 900 },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', monospace",
        fontLigatures: true,
        lineNumbers: 'on',
        glyphMargin: false,
        folding: true,
        renderWhitespace: 'selection',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        formatOnPaste: true,
        suggest: { showMethods: true, showFunctions: true, showConstructors: true },
        quickSuggestions: { other: true, comments: false, strings: true },
        bracketPairColorization: { enabled: true },
      });

      App.monacoReady = true;

      // Auto save on content change
      App.monacoEditor.onDidChangeModelContent(() => {
        if (!App.activeTab) return;
        const f = App.files[App.activeTab];
        if (!f) return;
        const val = App.monacoEditor.getValue();
        f.content = val;
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

      // Mobile: fix focus/keyboard issues
      if (App.isMobile || 'ontouchstart' in window) {
        patchMonacoForMobile();
      }

      showEditorEmptyState(!App.activeTab);
      resolve();
    });
  });
}

function patchMonacoForMobile() {
  // On Android, Monaco's own textarea may not trigger keyboard reliably.
  // We intercept tap events on the container and force-focus the hidden textarea Monaco uses.
  const container = $('monaco-container');
  container.addEventListener('touchend', (e) => {
    setTimeout(() => {
      if (App.monacoEditor) {
        App.monacoEditor.focus();
        // Find Monaco's internal textarea and ensure it gets focus
        const ta = container.querySelector('textarea.inputarea');
        if (ta) { ta.focus(); ta.click(); }
      }
    }, 50);
  }, { passive: true });
}

function setEditorContent(path) {
  const f = App.files[path];
  if (!f || f.isFolder) return;

  if (isBinaryType(f.name) && !(typeof f.content === 'string')) {
    // Binary: show placeholder
    showEditorEmptyState(false);
    if (App.monacoEditor) {
      App.monacoEditor.setValue(`// Binary file: ${f.name}\n// Cannot display binary content in editor.`);
    }
    return;
  }

  const content = typeof f.content === 'string' ? f.content : '';

  if (App.monacoReady && App.monacoEditor) {
    showEditorEmptyState(false);
    const lang = getLanguage(f.name);

    // Reuse model if exists, or create new
    if (App.monacoModels[path]) {
      App.monacoEditor.setModel(App.monacoModels[path]);
      const model = App.monacoModels[path];
      if (model.getValue() !== content) model.setValue(content);
    } else {
      const uri = monaco.Uri.parse(`file:///${path}`);
      let model;
      try { model = monaco.editor.getModel(uri); } catch(e) {}
      if (!model) model = monaco.editor.createModel(content, lang, uri);
      App.monacoModels[path] = model;
      App.monacoEditor.setModel(model);
    }

    // On mobile, also sync to textarea fallback
    if (App.isMobile) syncMobileTextarea(content);
  } else {
    // Fallback textarea
    showMobileTextareaFallback(content);
  }
}

function showMobileTextareaFallback(content) {
  showEditorEmptyState(false);
  $('monaco-container').style.display = 'none';
  const ta = $('mobile-textarea');
  ta.style.display = 'block';
  ta.value = content;

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

  // Handle Tab key
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
}

function syncMobileTextarea(content) {
  const ta = $('mobile-textarea');
  if (ta.style.display !== 'none') ta.value = content;
}

/* ============================================================
   VIRTUAL FILE SYSTEM
============================================================ */
function addFile(path, name, content, type) {
  path = normPath(path);
  App.files[path] = { name, path, content, type: type || 'text', isFolder: false };
  // Ensure parent folders exist
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
  // Delete file and all children (if folder)
  const toDelete = Object.keys(App.files).filter(p => p === path || p.startsWith(path + '/'));
  toDelete.forEach(p => {
    revokeBlobUrl(p);
    delete App.files[p];
    // Close tabs
    const ti = App.openTabs.indexOf(p);
    if (ti !== -1) App.openTabs.splice(ti, 1);
    if (App.monacoModels[p]) { App.monacoModels[p].dispose(); delete App.monacoModels[p]; }
  });
  if (App.activeTab && !App.files[App.activeTab]) {
    App.activeTab = App.openTabs[0] || null;
  }
  renderTabs();
  renderFileTree();
  if (App.activeTab) activateTab(App.activeTab, true);
  else showEditorEmptyState(true);
  saveSession();
  updateFileCountLabel();
}

function renameFile(oldPath, newName) {
  const f = App.files[oldPath];
  if (!f) return;
  const dir = getDirname(oldPath);
  const newPath = normPath(dir ? `${dir}/${newName}` : newName);
  if (newPath === oldPath) return;
  if (App.files[newPath]) { toast('A file with that name already exists', 'error'); return; }

  // Move all children
  const oldPrefix = oldPath + '/';
  const entries = Object.entries(App.files);
  for (const [p, file] of entries) {
    if (p === oldPath || p.startsWith(oldPrefix)) {
      const np = p === oldPath ? newPath : newPath + '/' + p.slice(oldPrefix.length);
      App.files[np] = { ...file, name: p === oldPath ? newName : file.name, path: np };
      delete App.files[p];
      // Update models
      if (App.monacoModels[p]) { App.monacoModels[np] = App.monacoModels[p]; delete App.monacoModels[p]; }
      // Update tabs
      const ti = App.openTabs.indexOf(p);
      if (ti !== -1) App.openTabs[ti] = np;
      if (App.activeTab === p) App.activeTab = np;
    }
  }
  renderTabs();
  renderFileTree();
  saveSession();
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
   FILE TREE RENDER
============================================================ */
function renderFileTree() {
  const tree = $('file-tree');
  // Check if any files
  const hasFiles = Object.keys(App.files).length > 0;
  $('drop-zone').style.display = hasFiles ? 'none' : 'block';

  if (!hasFiles) { tree.innerHTML = ''; return; }

  // Build tree structure
  const roots = buildTreeStructure();
  tree.innerHTML = '';
  renderTreeNodes(roots, tree, 0);
}

function buildTreeStructure() {
  // Collect all paths; build hierarchy
  const all = Object.keys(App.files).sort();
  const rootItems = [];
  const added = new Set();

  function getChildren(parentPath) {
    return all.filter(p => {
      const dir = getDirname(p);
      return dir === parentPath && !added.has(p);
    });
  }

  function buildLevel(parentPath) {
    const items = getChildren(parentPath);
    return items.map(p => {
      added.add(p);
      const f = App.files[p];
      const children = f.isFolder ? buildLevel(p) : [];
      return { ...f, children };
    });
  }

  return buildLevel('');
}

function renderTreeNodes(nodes, container, depth) {
  // Sort: folders first, then files
  nodes.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  nodes.forEach(node => {
    const item = document.createElement('div');
    item.className = 'tree-item' + (node.isFolder ? ' folder' : '') + (node.path === App.activeTab ? ' active' : '');
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
      item.appendChild(arrow);
      item.appendChild(icon);
      item.appendChild(label);

      const childContainer = document.createElement('div');
      childContainer.className = 'tree-children';
      const stored = localStorage.getItem(`htp_folder_${node.path}`);
      const isOpen = stored !== 'closed';
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
      item.appendChild(icon);
      item.appendChild(label);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        openFile(node.path);
        if (App.isMobile) setWorkspaceView('editor');
      });
    }

    // Right-click / long-press context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, node.path);
    });
    let longPressTimer;
    item.addEventListener('touchstart', () => { longPressTimer = setTimeout(() => { showContextMenu(item.getBoundingClientRect().right, item.getBoundingClientRect().top, node.path); }, 600); }, { passive: true });
    item.addEventListener('touchend', () => clearTimeout(longPressTimer), { passive: true });
    item.addEventListener('touchmove', () => clearTimeout(longPressTimer), { passive: true });
  });
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
  // Highlight in tree
  qsa('.tree-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === path);
  });
  if (!silent) saveSession();
}

function closeTab(path) {
  const idx = App.openTabs.indexOf(path);
  if (idx === -1) return;
  App.openTabs.splice(idx, 1);
  if (App.activeTab === path) {
    App.activeTab = App.openTabs[Math.min(idx, App.openTabs.length-1)] || null;
  }
  renderTabs();
  if (App.activeTab) activateTab(App.activeTab, true);
  else showEditorEmptyState(true);
  saveSession();
}

function renderTabs() {
  const bar = $('tab-bar');
  bar.innerHTML = '';
  App.openTabs.forEach(path => {
    const f = App.files[path];
    if (!f) return;
    const tab = document.createElement('button');
    tab.className = 'file-tab' + (path === App.activeTab ? ' active' : '');
    tab.dataset.path = path;
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.innerHTML = '×';
    close.title = 'Close';
    close.addEventListener('click', e => { e.stopPropagation(); closeTab(path); });
    const icon = document.createElement('span');
    icon.innerHTML = getFileIconSVG(f.name);
    icon.style.width = '14px';
    icon.style.height = '14px';
    icon.style.flexShrink = '0';
    const name = document.createElement('span');
    name.textContent = f.name;
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    tab.appendChild(icon);
    tab.appendChild(name);
    tab.appendChild(close);
    tab.addEventListener('click', () => activateTab(path));
    bar.appendChild(tab);
  });
}

function markTabModified(path, modified) {
  const tab = $('tab-bar').querySelector(`[data-path="${CSS.escape(path)}"]`);
  if (tab) tab.classList.toggle('modified', modified);
}

function showEditorEmptyState(show) {
  $('editor-empty-state').style.display = show ? 'flex' : 'none';
  $('monaco-container').style.display = show ? 'none' : 'block';
  $('mobile-textarea').style.display = 'none';
}

/* ============================================================
   PREVIEW ENGINE
============================================================ */
function revokeBlobUrl(path) {
  if (App.previewBlobUrls[path]) {
    URL.revokeObjectURL(App.previewBlobUrls[path]);
    delete App.previewBlobUrls[path];
  }
}

function revokeAllBlobUrls() {
  Object.values(App.previewBlobUrls).forEach(u => URL.revokeObjectURL(u));
  App.previewBlobUrls = {};
}

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
  // Create blob URLs for all assets
  for (const [path, f] of Object.entries(App.files)) {
    if (f.isFolder) continue;
    const mime = getMimeType(f.name);
    let blob;
    if (f.content instanceof ArrayBuffer) {
      blob = new Blob([f.content], { type: mime });
    } else if (typeof f.content === 'string') {
      blob = new Blob([f.content], { type: mime });
    } else continue;
    App.previewBlobUrls[path] = URL.createObjectURL(blob);
  }
}

function findEntryFile() {
  // Priority: index.html > any .html file > any file
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

  buildBlobUrls();

  const f = App.files[entryPath];
  let html = typeof f.content === 'string' ? f.content : '';

  // Inject console capture script and rewrite asset paths
  html = rewriteAssetPaths(html, entryPath);
  html = injectConsoleCaptureScript(html);

  const previewBlob = new Blob([html], { type: 'text/html' });
  const previewUrl = URL.createObjectURL(previewBlob);

  const iframe = $('preview-iframe');
  iframe.src = previewUrl;
  $('preview-empty').classList.add('hidden');

  setTimeout(() => URL.revokeObjectURL(previewUrl), 5000);

  // Also update fullscreen if open
  const fsIframe = $('fullscreen-iframe');
  if (!$('fullscreen-overlay').classList.contains('hidden')) {
    fsIframe.src = previewUrl;
  }
}

function rewriteAssetPaths(html, htmlPath) {
  const htmlDir = getDirname(htmlPath);

  // Replace src="..." href="..." url(...) with blob URLs
  html = html.replace(/(src|href)=["']([^"'#?]+)["']/gi, (match, attr, val) => {
    if (val.startsWith('http') || val.startsWith('//') || val.startsWith('data:')) return match;
    const resolved = resolveRelativePath(htmlDir, val);
    const blobUrl = App.previewBlobUrls[resolved];
    if (blobUrl) return `${attr}="${blobUrl}"`;
    return match;
  });

  // CSS url() references
  html = html.replace(/url\(["']?([^"')#?]+)["']?\)/gi, (match, val) => {
    if (val.startsWith('http') || val.startsWith('//') || val.startsWith('data:')) return match;
    const resolved = resolveRelativePath(htmlDir, val);
    const blobUrl = App.previewBlobUrls[resolved];
    if (blobUrl) return `url("${blobUrl}")`;
    return match;
  });

  // Inline CSS files referenced via <link>
  html = html.replace(/<link([^>]+)rel=["']stylesheet["'][^>]*>/gi, (match, attrs) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return match;
    const href = hrefMatch[1];
    if (href.startsWith('http') || href.startsWith('//')) return match;
    const resolved = resolveRelativePath(htmlDir, href);
    const cssFile = App.files[resolved];
    if (cssFile && typeof cssFile.content === 'string') {
      let css = cssFile.content;
      // Rewrite css url() references relative to css file
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

  // Inline JS files
  html = html.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, (match, before, src, after) => {
    if (src.startsWith('http') || src.startsWith('//')) return match;
    const resolved = resolveRelativePath(htmlDir, src);
    const jsFile = App.files[resolved];
    if (jsFile && typeof jsFile.content === 'string') {
      return `<script${before}${after}>${jsFile.content}</script>`;
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
  const script = `
<script>
(function(){
  const _send = function(type, args) {
    try {
      const msg = Array.from(args).map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
        catch(e) { return String(a); }
      }).join(' ');
      window.parent.postMessage({ type: 'htp_console', level: type, message: msg }, '*');
    } catch(e){}
  };
  ['log','info','warn','error','debug'].forEach(m => {
    const orig = console[m].bind(console);
    console[m] = function(...args) { orig(...args); _send(m, args); };
  });
  window.addEventListener('error', function(e) {
    window.parent.postMessage({ type: 'htp_console', level: 'error', message: (e.message||'Unknown error') + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : '') }, '*');
  });
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({ type: 'htp_console', level: 'error', message: 'Unhandled Promise rejection: ' + (e.reason?.message || e.reason || 'Unknown') }, '*');
  });
})();
<\/script>`;

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, script + '</head>');
  if (/<body/i.test(html)) return html.replace(/<body/i, script + '<body');
  return script + html;
}

function initConsoleCapture() {
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'htp_console') return;
    addConsoleEntry(e.data.level, e.data.message);
  });
}

function addConsoleEntry(level, message) {
  const entry = { level, message, time: new Date().toLocaleTimeString() };
  App.consoleLogs.push(entry);
  if (level === 'error') { App.errorCount++; updateConsoleBadge(); }
  if (level === 'warn')  { App.warnCount++;  updateConsoleBadge(); }
  renderConsoleEntry(entry);
}

function updateConsoleBadge() {
  const eb = $('error-badge'), wb = $('warn-badge');
  eb.textContent = App.errorCount;
  wb.textContent = App.warnCount;
  eb.classList.toggle('hidden', App.errorCount === 0);
  wb.classList.toggle('hidden', App.warnCount === 0);
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
  div.innerHTML = (icons[entry.level] || icons.log) + `<span class="entry-time" style="color:var(--text-muted);margin-right:4px;font-size:10px">${entry.time}</span><span>${escapeHtml(entry.message)}</span>`;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function clearConsole() {
  App.consoleLogs = [];
  App.errorCount = 0;
  App.warnCount = 0;
  $('console-output').innerHTML = '';
  updateConsoleBadge();
}

/* ============================================================
   ZIP IMPORT / EXPORT
============================================================ */
async function importZip(file) {
  if (!window.JSZip) { toast('JSZip not loaded', 'error'); return; }
  try {
    toast('Importing ZIP...', 'info');
    const zip = await JSZip.loadAsync(file);
    const projectName = file.name.replace(/\.zip$/i, '');
    App.settings.projectName = projectName;
    $('project-name-display').textContent = projectName;

    const promises = [];
    zip.forEach((relPath, zipEntry) => {
      if (zipEntry.dir) {
        addFolder(normPath(relPath));
        return;
      }
      // Skip macOS metadata
      if (relPath.includes('__MACOSX') || relPath.includes('.DS_Store')) return;

      const p = normPath(relPath);
      const name = getBasename(p);

      if (isBinaryType(name)) {
        promises.push(zipEntry.async('arraybuffer').then(buf => {
          addFile(p, name, buf, 'binary');
        }));
      } else {
        promises.push(zipEntry.async('string').then(content => {
          addFile(p, name, content, 'text');
        }));
      }
    });

    await Promise.all(promises);
    renderFileTree();
    saveSession();
    const entry = findEntryFile();
    if (entry) { openFile(entry); runPreview(); }
    toast(`Imported ${promises.length} files from ${file.name}`, 'success');
  } catch(e) {
    toast('Failed to import ZIP: ' + e.message, 'error');
    console.error(e);
  }
}

async function exportZip() {
  if (!window.JSZip) { toast('JSZip not loaded', 'error'); return; }
  const files = Object.values(App.files).filter(f => !f.isFolder);
  if (!files.length) { toast('No files to export', 'error'); return; }

  try {
    toast('Building ZIP...', 'info');
    const zip = new JSZip();
    for (const f of files) {
      if (f.content instanceof ArrayBuffer) {
        zip.file(f.path, f.content);
      } else if (typeof f.content === 'string') {
        zip.file(f.path, f.content);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (App.settings.projectName || 'project') + '.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${files.length} files`, 'success');
  } catch(e) {
    toast('Failed to export ZIP: ' + e.message, 'error');
    console.error(e);
  }
}

/* ============================================================
   FILE UPLOAD HANDLERS
============================================================ */
async function handleFileUpload(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;

  // Check if it's a zip
  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
    await importZip(files[0]);
    return;
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
  renderFileTree();
  saveSession();
  updateFileCountLabel();
  // Open first HTML file if nothing open
  if (!App.activeTab) {
    const htmlFile = Object.keys(App.files).find(p => /\.html?$/i.test(p));
    if (htmlFile) { openFile(htmlFile); runPreview(); }
  } else if (App.settings.autoRefresh) { runPreview(); }
  toast(`Added ${count} file${count !== 1 ? 's' : ''}`, 'success');
}

/* ============================================================
   SETUP: DROP ZONE
============================================================ */
function setupDropZone() {
  const sidebar = $('sidebar');
  const dz = $('drop-zone');

  ['dragenter','dragover'].forEach(evt => {
    sidebar.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.add('drag-over'); });
  });
  ['dragleave','drop'].forEach(evt => {
    sidebar.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); dz.classList.remove('drag-over'); });
  });
  sidebar.addEventListener('drop', (e) => {
    const items = e.dataTransfer?.items || [];
    const files = e.dataTransfer?.files || [];
    if (items.length > 0) {
      // Try webkitGetAsEntry for folder support
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
      if (entries.length) { processEntries(entries, ''); return; }
    }
    handleFileUpload(files);
  });

  // Whole window drop
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) handleFileUpload(e.dataTransfer.files); });
}

async function processEntries(entries, basePath) {
  for (const entry of entries) {
    if (entry.isFile) {
      await new Promise(res => {
        entry.file(file => {
          const path = normPath(basePath ? `${basePath}/${entry.name}` : entry.name);
          const name = entry.name;
          if (isBinaryType(name)) {
            file.arrayBuffer().then(buf => { addFile(path, name, buf, 'binary'); res(); });
          } else {
            file.text().then(text => { addFile(path, name, text, 'text'); res(); });
          }
        });
      });
    } else if (entry.isDirectory) {
      const dirPath = normPath(basePath ? `${basePath}/${entry.name}` : entry.name);
      addFolder(dirPath);
      await new Promise(res => {
        entry.createReader().readEntries(async childEntries => {
          await processEntries(childEntries, dirPath);
          res();
        });
      });
    }
  }
  renderFileTree();
  saveSession();
  updateFileCountLabel();
  toast('Files imported', 'success');
  if (!App.activeTab) {
    const htmlFile = Object.keys(App.files).find(p => /\.html?$/i.test(p));
    if (htmlFile) { openFile(htmlFile); runPreview(); }
  }
}

/* ============================================================
   SETUP: FILE INPUTS
============================================================ */
function setupFileInputs() {
  const fileInput = $('file-input-upload');
  fileInput.addEventListener('change', () => { handleFileUpload(fileInput.files); fileInput.value = ''; });

  const zipInput = $('file-input-zip');
  zipInput.addEventListener('change', () => { if (zipInput.files[0]) importZip(zipInput.files[0]); zipInput.value = ''; });

  $('btn-drop-upload').addEventListener('click', () => fileInput.click());
}

/* ============================================================
   SETUP: BUTTONS
============================================================ */
function setupButtons() {
  $('sidebar-toggle').addEventListener('click', toggleSidebar);
  $('btn-run').addEventListener('click', () => { runPreview(); if (App.isMobile) setWorkspaceView('preview'); });
  $('btn-import-zip').addEventListener('click', () => $('file-input-zip').click());
  $('btn-export-zip').addEventListener('click', exportZip);
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-new-file').addEventListener('click', () => openNewFileModal());
  $('btn-new-file-sidebar').addEventListener('click', () => openNewFileModal());
  $('btn-new-folder').addEventListener('click', () => openNewFolderModal());
  $('btn-upload-files').addEventListener('click', () => $('file-input-upload').click());
  $('btn-collapse-all').addEventListener('click', collapseAllFolders);

  $('btn-refresh-preview').addEventListener('click', () => { addConsoleEntry('info','↻ Preview refreshed'); clearConsole(); runPreview(); });
  $('btn-fullscreen-preview').addEventListener('click', openFullscreenPreview);
  $('btn-newtab-preview').addEventListener('click', openPreviewInNewTab);

  $('btn-search').addEventListener('click', () => { if (App.monacoEditor) App.monacoEditor.getAction('actions.find')?.run(); });
  $('btn-format').addEventListener('click', () => { if (App.monacoEditor) App.monacoEditor.getAction('editor.action.formatDocument')?.run(); });
  $('btn-word-wrap').addEventListener('click', toggleWordWrap);

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
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.closest('.modal-overlay').querySelector('.action-btn:last-child')?.click(); } });
  });

  // Settings
  const fs = $('setting-fontsize');
  fs.addEventListener('input', () => { $('setting-fontsize-val').textContent = fs.value; });
}

function toggleSidebar() {
  const s = $('sidebar');
  if (App.isMobile) {
    s.classList.toggle('mobile-open');
  } else {
    s.classList.toggle('collapsed');
  }
}

function toggleWordWrap() {
  App.settings.wordWrap = !App.settings.wordWrap;
  if (App.monacoEditor) App.monacoEditor.updateOptions({ wordWrap: App.settings.wordWrap ? 'on' : 'off' });
  saveSettings();
  toast('Word wrap ' + (App.settings.wordWrap ? 'on' : 'off'), 'info', 1500);
}

function toggleConsole() {
  $('console-panel').classList.toggle('collapsed');
  const btn = $('btn-toggle-console');
  const isCollapsed = $('console-panel').classList.contains('collapsed');
  btn.querySelector('svg').style.transform = isCollapsed ? 'rotate(180deg)' : '';
}

function filterConsole(tab) {
  const entries = qsa('.console-entry', $('console-output'));
  entries.forEach(e => {
    if (tab === 'console') e.style.display = '';
    else if (tab === 'errors') e.style.display = e.classList.contains('console-error') ? '' : 'none';
    else if (tab === 'warnings') e.style.display = e.classList.contains('console-warn') ? '' : 'none';
  });
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
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ============================================================
   MODALS: New File / Folder / Rename
============================================================ */
function getFolderOptions() {
  const folders = ['(root)', ...Object.keys(App.files).filter(p => App.files[p].isFolder)];
  return folders;
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
  const modal = $('modal-new-folder');
  modal.classList.remove('hidden');
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
  const defaultContents = {
    html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World</h1>\n  <script src="script.js"><\/script>\n</body>\n</html>`,
    css: `/* Styles */\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: sans-serif;\n}\n`,
    js: `// JavaScript\nconsole.log('Hello World!');\n`,
    json: `{\n  "name": "project",\n  "version": "1.0.0"\n}\n`,
  };
  const ext = (name.split('.').pop()||'').toLowerCase();
  const content = defaultContents[ext] || '';
  addFile(path, name, content, 'text');
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

/* ============================================================
   SETTINGS MODAL
============================================================ */
function openSettings() {
  const s = App.settings;
  $('setting-fontsize').value = s.fontSize;
  $('setting-fontsize-val').textContent = s.fontSize;
  $('setting-tabsize').value = s.tabSize;
  $('setting-wordwrap').checked = s.wordWrap;
  $('setting-autorefresh').checked = s.autoRefresh;
  $('setting-autosave').checked = s.autoSave;
  $('setting-project-name').value = s.projectName;
  $('modal-settings').classList.remove('hidden');
}

function applyAndSaveSettings() {
  App.settings.fontSize = parseInt($('setting-fontsize').value);
  App.settings.tabSize = parseInt($('setting-tabsize').value);
  App.settings.wordWrap = $('setting-wordwrap').checked;
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.classList.add('hidden'); });

  qsa('.ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      if (!App.ctxTarget) return;
      const action = item.dataset.action;
      if (action === 'open') openFile(App.ctxTarget);
      else if (action === 'rename') openRenameModal(App.ctxTarget);
      else if (action === 'duplicate') duplicateFile(App.ctxTarget);
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

  // Position within viewport
  const mw = 150, mh = 140;
  let fx = Math.min(x, window.innerWidth - mw - 4);
  let fy = Math.min(y, window.innerHeight - mh - 4);
  menu.style.left = fx + 'px';
  menu.style.top = fy + 'px';
}

/* ============================================================
   DEVICE EMULATOR
============================================================ */
function setupDeviceSwitcher() {
  qsa('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.device-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const device = btn.dataset.device;
      App.currentDevice = device;
      applyDevice(device);
    });
  });
  applyDevice('desktop');
}

function applyDevice(device) {
  const frame = $('device-frame');
  frame.className = 'device-' + device;
  const vp = $('preview-viewport');
  vp.style.background = device === 'desktop' ? 'transparent' : '#555';
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
    const editorArea = $('editor-area');
    const totalW = editorArea.getBoundingClientRect().width - resizer.offsetWidth;
    const newEditorW = Math.max(200, Math.min(totalW - 200, startEditorW + diff));
    const newPreviewW = totalW - newEditorW;
    editorPanel.style.flex = 'none';
    editorPanel.style.width = newEditorW + 'px';
    previewPanel.style.flex = 'none';
    previewPanel.style.width = newPreviewW + 'px';
  }

  function onMouseUp() {
    App.isResizing = false;
    document.body.classList.remove('resizing');
    resizer.classList.remove('dragging');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // Touch resize
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
  qsa('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setWorkspaceView(btn.dataset.view);
    });
  });
  checkMobile();
  window.addEventListener('resize', checkMobile);
}

function checkMobile() {
  App.isMobile = window.innerWidth < 700;
  $('mobile-nav').style.display = App.isMobile ? 'flex' : 'none';
  // Hide sidebar on mobile unless explicitly opened
  if (App.isMobile) {
    $('sidebar').classList.remove('collapsed');
    if (!$('sidebar').classList.contains('mobile-open')) {
      // sidebar is overlaid on mobile, don't shift layout
    }
  }
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
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return; // Not a horizontal swipe

    const views = ['editor', 'preview'];
    const ci = views.indexOf(App.currentView);
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

    if (e.key === 's') { e.preventDefault(); saveCurrentFile(); }
    else if (e.key === 'Enter') { e.preventDefault(); runPreview(); }
    else if (e.key === 'n') { e.preventDefault(); openNewFileModal(); }
    else if (e.key === 'b') { e.preventDefault(); toggleSidebar(); }
    else if (e.key === 'j') { e.preventDefault(); toggleConsole(); }
    else if (e.key === 'e') { e.preventDefault(); exportZip(); }
    else if (e.key === 'Tab') { e.preventDefault(); cycleTab(e.shiftKey ? -1 : 1); }
  });
}

function saveCurrentFile() {
  if (!App.activeTab) return;
  const f = App.files[App.activeTab];
  if (!f) return;
  if (App.monacoReady && App.monacoEditor) f.content = App.monacoEditor.getValue();
  markTabModified(App.activeTab, false);
  saveSession();
  toast('Saved', 'success', 1500);
  if (App.settings.autoRefresh) runPreview();
}

function cycleTab(dir) {
  if (!App.openTabs.length) return;
  const ci = App.openTabs.indexOf(App.activeTab);
  const ni = (ci + dir + App.openTabs.length) % App.openTabs.length;
  activateTab(App.openTabs[ni]);
}

/* ============================================================
   ORIENTATION / RESIZE HANDLING
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
  // Update minimap visibility
  if (App.monacoEditor) {
    App.monacoEditor.updateOptions({ minimap: { enabled: window.innerWidth > 900 } });
  }
});

/* ============================================================
   STARTER TEMPLATE (shown if no session)
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

  const cssContent = `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

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

p {
  color: rgba(255,255,255,0.7);
  margin-bottom: 24px;
  line-height: 1.6;
}

button {
  padding: 12px 28px;
  background: linear-gradient(135deg, #4f9eff, #b07eff);
  border: none;
  border-radius: 30px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(79,158,255,0.4);
}

#output {
  margin-top: 20px;
  color: #4edf8c;
  font-size: 18px;
  font-weight: 600;
}`;

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

// Run starter template after Monaco loads
window.addEventListener('load', () => {
  setTimeout(initStarterTemplate, 1600);
});
