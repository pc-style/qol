// ==UserScript==
// @name         Custom Shortcuts Manager
// @namespace    custom-shortcuts-manager
// @version      1.1.0
// @description  Full macro system with recording, common actions, custom JS, and per-site shortcuts
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_openInTab
// @require      https://raw.githubusercontent.com/pc-style/qol/main/dist/qol-framework.user.js
// @updateURL    https://raw.githubusercontent.com/pc-style/qol/main/scripts/custom-shortcuts-manager.user.js
// @downloadURL  https://raw.githubusercontent.com/pc-style/qol/main/scripts/custom-shortcuts-manager.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // wait for QoL framework
  if (typeof QoL === 'undefined') {
    console.error('[custom-shortcuts-manager] QoL framework not loaded');
    return;
  }

  const SCRIPT_ID = 'custom-shortcuts-manager';

  /************************************************************
   * Constants / Config
   ************************************************************/

  const STORAGE_KEY = 'csm:data:v1';
  const SETTINGS_KEY = 'csm:settings:v1';

  const THEME = {
    bg: '#0b1220',
    bgSoft: '#111827',
    bgSofter: '#020817',
    text: '#e5e7eb',
    textSoft: '#9ca3af',
    border: '#1f2937',
    borderSoft: '#374151',
    accent: '#6366f1',
    accentSoft: 'rgba(99,102,241,0.35)',
    danger: '#ef4444',
    success: '#22c55e',
    radiusLg: '14px',
    radiusMd: '10px',
    radiusSm: '6px',
    zBase: 2147483000
  };

  const IDS = {
    toolbar: 'csm-toolbar',
    toolbarCount: 'csm-toolbar-count',
    recordBtn: 'csm-toolbar-record',
    managerBtn: 'csm-toolbar-manager',
    settingsBtn: 'csm-toolbar-settings',
    recordIndicator: 'csm-record-indicator',
    managerModal: 'csm-manager-modal',
    macroModal: 'csm-macro-modal',
    mask: 'csm-mask',
    toastContainer: 'csm-toast-container'
  };

  const DEFAULT_DATA = {
    shortcuts: [
      {
        id: 'builtin-scroll-top',
        name: 'Scroll to top',
        keys: 'g g',
        action: 'scroll',
        params: { direction: 'top', smooth: true },
        scope: 'global',
        enabled: true,
        category: 'navigation',
        builtin: true
      },
      {
        id: 'builtin-scroll-bottom',
        name: 'Scroll to bottom',
        keys: 'G',
        action: 'scroll',
        params: { direction: 'bottom', smooth: true },
        scope: 'global',
        enabled: true,
        category: 'navigation',
        builtin: true
      }
    ],
    settings: {
      managerHotkey: 'Alt+K',
      recordHotkey: 'Alt+Shift+R',
      captureMouse: false,
      autoPauseIdle: 2000,
      maxRecordingLength: 300000,
      conflictStrategy: 'warn', // 'warn' | 'override' | 'disable'
      showToolbar: true,
      sequenceTimeout: 500,
      maxSequenceLength: 4
    }
  };

  /************************************************************
   * State
   ************************************************************/

  const state = {
    data: null,
    ready: false,

    // key handling
    activeKeys: new Set(),
    sequenceBuffer: [],
    lastKeyTime: 0,

    // UI
    toolbar: null,
    managerModal: null,
    macroModal: null,
    mask: null,

    // recording
    recording: false,
    recordStart: 0,
    recordedSteps: [],
    lastEventTime: 0,
    recordConfig: {
      speedMultiplier: 1,
      loop: 1
    },
    recordExclusionRoot: null,

    // playback
    playing: false
  };

  /************************************************************
   * Utilities
   ************************************************************/

  function now() {
    return performance.now();
  }

  function getDomainScope() {
    return window.location.hostname;
  }

  function cloneData(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeParse(json, fallback) {
    try {
      return JSON.parse(json);
    } catch {
      return fallback;
    }
  }

  function normalizeKeyEvent(e) {
    const key = (e.key || '').length === 1 ? e.key.toLowerCase() : e.key;
    return {
      ctrl: !!e.ctrlKey,
      alt: !!e.altKey,
      shift: !!e.shiftKey,
      meta: !!e.metaKey,
      key
    };
  }

  function parseKeyPattern(pattern) {
    // Supports:
    // - "Ctrl+Shift+K"
    // - "g g" sequences (space-separated)
    // - Single keys like "G"
    if (!pattern) return [];
    return pattern
      .split(' ')
      .filter(p => p)
      .map(part => {
        const bits = part.split('+').map(s => s.trim());
        const spec = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
        for (const b of bits) {
          const l = b.toLowerCase();
          if (l === 'ctrl' || l === 'control') spec.ctrl = true;
          else if (l === 'alt' || l === 'option') spec.alt = true;
          else if (l === 'shift') spec.shift = true;
          else if (l === 'meta' || l === 'cmd' || l === 'command') spec.meta = true;
          else spec.key = l.length === 1 ? l : b;
        }
        return spec;
      });
  }

  function keySpecMatchesEvent(spec, e) {
    const n = normalizeKeyEvent(e);
    const specKey = (spec.key || '').toLowerCase();
    const eventKey = (n.key || '').toLowerCase();
    return (
      n.ctrl === spec.ctrl &&
      n.alt === spec.alt &&
      n.shift === spec.shift &&
      n.meta === spec.meta &&
      (specKey === eventKey ||
        (specKey.length === 1 && specKey === eventKey))
    );
  }

  function matchSequence(specs, buffer) {
    if (buffer.length < specs.length) return false;
    const start = buffer.length - specs.length;
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const ev = buffer[start + i];
      if (
        spec.ctrl !== ev.ctrl ||
        spec.alt !== ev.alt ||
        spec.shift !== ev.shift ||
        spec.meta !== ev.meta
      ) {
        return false;
      }
      const specKey = (spec.key || '').toLowerCase();
      const evKey = (ev.key || '').toLowerCase();
      if (!(specKey === evKey || (specKey.length === 1 && specKey === evKey))) {
        return false;
      }
    }
    return true;
  }

  function keyPatternToDisplay(pattern) {
    return pattern || '';
  }

  function matchesScope(shortcutScope, urlHost) {
    if (!shortcutScope || shortcutScope === 'global') return true;
    if (shortcutScope === urlHost) return true;
    // basic wildcard support: *.example.com
    if (shortcutScope.startsWith('*.')) {
      const suf = shortcutScope.slice(1); // ".example.com"
      return urlHost.endsWith(suf);
    }
    return false;
  }

  /************************************************************
   * Storage
   ************************************************************/

  function loadAll() {
    // use QoL.store instead of direct GM_getValue
    const stored = safeParse(QoL.store.get(SCRIPT_ID, 'data', null), null);
    const storedSettings = safeParse(QoL.store.get(SCRIPT_ID, 'settings', null), null);

    const base = cloneData(DEFAULT_DATA);

    if (stored && Array.isArray(stored.shortcuts)) {
      base.shortcuts = mergeShortcuts(base.shortcuts, stored.shortcuts);
    }
    if (storedSettings && typeof storedSettings === 'object') {
      base.settings = { ...base.settings, ...storedSettings };
    }

    state.data = base;
    state.ready = true;
  }

  function mergeShortcuts(defaults, stored) {
    const map = new Map();
    for (const s of defaults) map.set(s.id, s);
    for (const s of stored) map.set(s.id, s);
    return Array.from(map.values());
  }

  function persist() {
    if (!state.data) return;
    const { settings, ...rest } = state.data;
    // use QoL.store instead of direct GM_setValue
    QoL.store.set(SCRIPT_ID, 'data', rest);
    QoL.store.set(SCRIPT_ID, 'settings', settings);
  }

  function getShortcutsForThisPage() {
    const host = getDomainScope();
    return state.data.shortcuts.filter(s => s.enabled && matchesScope(s.scope, host));
  }

  function findConflicts(targetShortcut) {
    const host = getDomainScope();
    const conflicts = [];
    for (const s of state.data.shortcuts) {
      if (!s.enabled || s.id === targetShortcut.id) continue;
      if (!matchesScope(s.scope, host) && targetShortcut.scope !== 'global') continue;
      if (normalizePattern(s.keys) === normalizePattern(targetShortcut.keys)) {
        conflicts.push(s);
      }
    }
    return conflicts;
  }

  function normalizePattern(p) {
    return (p || '').trim().toLowerCase();
  }

  /************************************************************
   * Toasts & Visuals
   ************************************************************/

  function ensureBaseStyles() {
    GM_addStyle(`
      :root {
        --csm-bg: ${THEME.bg};
        --csm-bg-soft: ${THEME.bgSoft};
        --csm-bg-softer: ${THEME.bgSofter};
        --csm-text: ${THEME.text};
        --csm-text-soft: ${THEME.textSoft};
        --csm-border: ${THEME.border};
        --csm-border-soft: ${THEME.borderSoft};
        --csm-accent: ${THEME.accent};
        --csm-accent-soft: ${THEME.accentSoft};
        --csm-danger: ${THEME.danger};
        --csm-success: ${THEME.success};
        --csm-radius-lg: ${THEME.radiusLg};
        --csm-radius-md: ${THEME.radiusMd};
        --csm-radius-sm: ${THEME.radiusSm};
        --csm-z: ${THEME.zBase};
      }

      #${IDS.toastContainer} {
        position: fixed;
        bottom: 18px;
        right: 18px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        z-index: var(--csm-z);
        pointer-events: none;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", -system-ui;
      }

      .csm-toast {
        min-width: 220px;
        max-width: min(360px, 70vw);
        padding: 8px 10px;
        border-radius: var(--csm-radius-md);
        background: rgba(15,23,42,0.98);
        color: var(--csm-text);
        border: 1px solid rgba(148,163,184,0.24);
        box-shadow: 0 12px 35px rgba(15,23,42,0.75);
        font-size: 12px;
        display: flex;
        align-items: flex-start;
        gap: 6px;
        opacity: 0;
        transform: translateY(8px);
        transition: all 150ms ease;
        pointer-events: auto;
      }

      .csm-toast.show {
        opacity: 1;
        transform: translateY(0);
      }

      .csm-toast span.csm-toast-label {
        font-weight: 600;
        color: var(--csm-accent);
      }

      .csm-toast.csm-error span.csm-toast-label {
        color: var(--csm-danger);
      }

      .csm-toast.csm-success span.csm-toast-label {
        color: var(--csm-success);
      }

      /* Recording indicator (pulsing red dot top-right) */
      #${IDS.recordIndicator} {
        position: fixed;
        top: 14px;
        right: 16px;
        width: 14px;
        height: 14px;
        border-radius: 999px;
        background: #ef4444;
        box-shadow: 0 0 0 0 rgba(239,68,68,0.85);
        transform-origin: center;
        animation: csm-pulse 1.1s infinite;
        z-index: var(--csm-z);
        display: none;
      }

      #${IDS.recordIndicator}.active {
        display: block;
      }

      @keyframes csm-pulse {
        0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.9); transform: scale(1); }
        70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); transform: scale(1.08); }
        100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); transform: scale(1); }
      }

      /* Floating toolbar bottom-left */
      #${IDS.toolbar} {
        position: fixed;
        bottom: 16px;
        left: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        background: rgba(11,17,32,0.96);
        border-radius: var(--csm-radius-lg);
        border: 1px solid rgba(148,163,184,0.24);
        box-shadow: 0 14px 40px rgba(15,23,42,0.9);
        backdrop-filter: blur(8px);
        z-index: var(--csm-z);
      }

      #${IDS.toolbar} button {
        appearance: none;
        border: 1px solid rgba(75,85,99,0.9);
        background: rgba(17,24,39,0.96);
        color: var(--csm-text);
        border-radius: var(--csm-radius-md);
        padding: 5px 9px;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
        transition: all 130ms ease;
      }

      #${IDS.toolbar} button span.csm-badge {
        min-width: 14px;
        padding: 0 4px;
        border-radius: 999px;
        background: var(--csm-accent);
        color: #0b1020;
        font-size: 10px;
        font-weight: 600;
        text-align: center;
      }

      #${IDS.toolbar} button:hover {
        border-color: var(--csm-accent);
        background: #020817;
        box-shadow: 0 4px 14px rgba(15,23,42,0.7);
        transform: translateY(-1px);
      }

      #${IDS.toolbar} button.csm-recording {
        background: rgba(127,29,29,0.95);
        border-color: #ef4444;
        color: #fee2e2;
      }

      #${IDS.toolbar} button.csm-recording span.csm-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #fee2e2;
      }

      /* Shared modal mask */
      #${IDS.mask} {
        position: fixed;
        inset: 0;
        background: radial-gradient(circle at top left, rgba(99,102,241,0.06), transparent),
                    radial-gradient(circle at bottom right, rgba(15,23,42,0.96), rgba(2,6,23,0.98));
        backdrop-filter: blur(6px);
        z-index: calc(var(--csm-z) - 1);
        opacity: 0;
        pointer-events: none;
        transition: opacity 160ms ease;
      }

      #${IDS.mask}.show {
        opacity: 1;
        pointer-events: auto;
      }

      /* Manager modal */
      #${IDS.managerModal},
      #${IDS.macroModal} {
        position: fixed;
        inset: 8% auto auto 50%;
        transform: translateX(-50%) translateY(12px);
        width: min(960px, 96vw);
        max-height: 84vh;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px 14px 10px;
        background: radial-gradient(circle at top, rgba(148,163,253,0.04), transparent) fixed,
                    var(--csm-bg);
        border-radius: 16px;
        border: 1px solid rgba(99,102,241,0.38);
        box-shadow: 0 30px 90px rgba(0,0,0,0.82);
        color: var(--csm-text);
        font-family: ui-sans-serif, system-ui, -apple-system;
        z-index: var(--csm-z);
        opacity: 0;
        pointer-events: none;
        transition: all 170ms cubic-bezier(.21,.8,.24,1);
      }

      #${IDS.managerModal}.show,
      #${IDS.macroModal}.show {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0);
      }

      .csm-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .csm-modal-title {
        font-weight: 600;
        font-size: 15px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .csm-modal-sub {
        font-size: 11px;
        color: var(--csm-text-soft);
      }

      .csm-pill {
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 9px;
        border: 1px solid rgba(99,102,241,0.7);
        color: rgba(196,181,253,0.96);
      }

      .csm-close-btn {
        border: none;
        background: transparent;
        color: var(--csm-text-soft);
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 120ms ease;
      }

      .csm-close-btn:hover {
        background: rgba(15,23,42,0.96);
        color: var(--csm-accent);
      }

      .csm-manager-layout {
        display: grid;
        grid-template-columns: 230px 1fr;
        gap: 10px;
        align-items: stretch;
        flex: 1;
        min-height: 0;
      }

      .csm-sidebar {
        padding: 8px;
        border-radius: var(--csm-radius-md);
        background: radial-gradient(circle at top left, rgba(79,70,229,0.14), transparent),
                    rgba(9,9,17,0.98);
        border: 1px solid rgba(75,85,99,0.9);
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 11px;
      }

      .csm-sidebar-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--csm-text-soft);
      }

      .csm-sidebar-badge {
        padding: 3px 6px;
        border-radius: 7px;
        font-size: 10px;
        border: 1px solid rgba(99,102,241,0.7);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--csm-accent);
      }

      .csm-sidebar-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 2px;
      }

      .csm-sidebar-pill {
        padding: 4px 6px;
        border-radius: 7px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4px;
        border: 1px solid transparent;
        color: var(--csm-text-soft);
        transition: all 110ms ease;
      }

      .csm-sidebar-pill span {
        font-size: 10px;
      }

      .csm-sidebar-pill.active {
        background: rgba(17,24,39,0.98);
        border-color: rgba(99,102,241,0.85);
        color: var(--csm-accent);
      }

      .csm-sidebar-pill:hover {
        background: rgba(15,23,42,1);
        border-color: rgba(75,85,99,0.95);
      }

      .csm-main {
        padding: 8px 9px;
        border-radius: var(--csm-radius-md);
        background: radial-gradient(circle at top right, rgba(99,102,241,0.12), transparent),
                    rgba(6,8,16,0.99);
        border: 1px solid rgba(55,65,81,0.96);
        display: flex;
        flex-direction: column;
        gap: 7px;
        font-size: 11px;
        min-height: 0;
      }

      .csm-search-row {
        display: flex;
        gap: 6px;
      }

      .csm-input {
        flex: 1;
        padding: 5px 7px;
        border-radius: 8px;
        border: 1px solid rgba(55,65,81,0.95);
        background: rgba(6,8,16,0.99);
        color: var(--csm-text);
        font-size: 11px;
      }

      .csm-input::placeholder {
        color: var(--csm-text-soft);
      }

      .csm-input:focus {
        outline: none;
        border-color: var(--csm-accent);
        box-shadow: 0 0 0 1px rgba(99,102,241,0.2);
      }

      .csm-btn-soft {
        padding: 5px 7px;
        border-radius: 8px;
        border: 1px solid rgba(75,85,99,0.95);
        background: rgba(9,9,17,0.98);
        color: var(--csm-text-soft);
        font-size: 10px;
        cursor: pointer;
        display: inline-flex;
        gap: 4px;
        align-items: center;
        transition: all 110ms ease;
      }

      .csm-btn-soft:hover {
        background: rgba(15,23,42,0.98);
        color: var(--csm-accent);
        border-color: rgba(99,102,241,0.8);
      }

      .csm-shortcut-list {
        margin-top: 4px;
        padding: 4px;
        border-radius: 8px;
        background: rgba(8,10,18,0.99);
        border: 1px solid rgba(31,41,55,0.98);
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
      }

      .csm-shortcut-item {
        display: grid;
        grid-template-columns: minmax(90px, 140px) minmax(80px, 110px) minmax(90px, 140px) 1fr auto;
        gap: 4px;
        align-items: center;
        padding: 4px 5px;
        border-radius: 7px;
        background: rgba(9,9,17,0.98);
        border: 1px solid transparent;
        transition: all 110ms ease;
      }

      .csm-shortcut-item:hover {
        border-color: rgba(75,85,99,0.92);
        background: rgba(6,8,16,0.99);
      }

      .csm-shortcut-name {
        font-size: 10px;
        color: var(--csm-text);
      }

      .csm-shortcut-keys {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 5px;
        border: 1px solid rgba(75,85,99,0.9);
        color: var(--csm-accent);
        background: rgba(6,8,16,0.98);
      }

      .csm-shortcut-action {
        font-size: 10px;
        color: var(--csm-text-soft);
      }

      .csm-shortcut-scope {
        font-size: 9px;
        color: var(--csm-text-soft);
      }

      .csm-shortcut-tags {
        display: inline-flex;
        gap: 4px;
        align-items: center;
        font-size: 8px;
      }

      .csm-tag {
        padding: 1px 4px;
        border-radius: 999px;
        border: 1px solid rgba(55,65,81,0.9);
        color: var(--csm-text-soft);
      }

      .csm-tag-conflict {
        border-color: rgba(239,68,68,0.9);
        color: #fecaca;
      }

      .csm-toggle {
        width: 20px;
        height: 12px;
        border-radius: 999px;
        background: rgba(55,65,81,0.96);
        position: relative;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        padding: 1px;
        transition: all 110ms ease;
      }

      .csm-toggle-knob {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: rgba(148,163,253,0.96);
        transform: translateX(0);
        transition: all 110ms ease;
      }

      .csm-toggle.on {
        background: rgba(79,70,229,0.98);
      }

      .csm-toggle.on .csm-toggle-knob {
        transform: translateX(8px);
        background: #e5e7ff;
      }

      .csm-chip-btn {
        padding: 1px 5px;
        border-radius: 7px;
        border: 1px solid rgba(75,85,99,0.9);
        background: transparent;
        font-size: 9px;
        color: var(--csm-text-soft);
        display: inline-flex;
        gap: 3px;
        align-items: center;
        cursor: pointer;
        transition: all 110ms ease;
      }

      .csm-chip-btn:hover {
        border-color: rgba(99,102,241,0.86);
        color: var(--csm-accent);
        background: rgba(9,9,17,0.98);
      }

      /* Macro editor basic styling */
      .csm-steps {
        margin-top: 4px;
        padding: 4px;
        border-radius: 8px;
        background: rgba(5,6,13,0.99);
        border: 1px solid rgba(31,41,55,0.98);
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow-y: auto;
      }

      .csm-step {
        display: grid;
        grid-template-columns: 16px minmax(80px,110px) 1fr minmax(60px,80px) 18px;
        gap: 4px;
        align-items: center;
        padding: 3px 4px;
        border-radius: 6px;
        background: rgba(9,9,17,0.98);
        border: 1px solid transparent;
        font-size: 9px;
      }

      .csm-step:hover {
        border-color: rgba(75,85,99,0.9);
      }

      .csm-step-index {
        color: var(--csm-text-soft);
        text-align: right;
      }

      .csm-step-type {
        color: var(--csm-accent);
      }

      .csm-step-delay {
        color: var(--csm-text-soft);
        text-align: right;
      }

      .csm-step-remove {
        border: none;
        background: transparent;
        color: rgba(148,163,253,0.7);
        cursor: pointer;
        padding: 0;
      }

      .csm-step-remove:hover {
        color: #fca5a5;
      }
    `);
  }

  function ensureToastContainer() {
    let c = document.getElementById(IDS.toastContainer);
    if (!c) {
      c = document.createElement('div');
      c.id = IDS.toastContainer;
      document.documentElement.appendChild(c);
    }
    return c;
  }

  function showToast(message, type = 'info', label) {
    // use QoL.ui.Toast instead of custom toast
    const labelText = label || (type === 'error' ? 'Conflict' : type === 'success' ? 'Done' : 'Shortcuts');
    const fullMessage = `${labelText}: ${message}`;
    QoL.ui.Toast.show(fullMessage);
  }

  function ensureRecordIndicator() {
    let el = document.getElementById(IDS.recordIndicator);
    if (!el) {
      el = document.createElement('div');
      el.id = IDS.recordIndicator;
      document.documentElement.appendChild(el);
    }
    return el;
  }

  function setRecordingIndicator(active) {
    const el = ensureRecordIndicator();
    if (active) el.classList.add('active');
    else el.classList.remove('active');
  }

  /************************************************************
   * Toolbar
   ************************************************************/

  function ensureToolbar() {
    if (state.toolbar) return state.toolbar;
    const t = document.createElement('div');
    t.id = IDS.toolbar;

    const managerBtn = document.createElement('button');
    managerBtn.id = IDS.managerBtn;
    managerBtn.innerHTML = `
      <span>⌘</span>
      <span>Shortcuts</span>
      <span class="csm-badge" id="${IDS.toolbarCount}">0</span>
    `;
    managerBtn.addEventListener('click', openManagerModal);

    const recordBtn = document.createElement('button');
    recordBtn.id = IDS.recordBtn;
    recordBtn.innerHTML = `
      <span class="csm-dot"></span>
      <span>Record</span>
      <span class="csm-hk">Alt+Shift+R</span>
    `;
    recordBtn.addEventListener('click', toggleRecording);

    const settingsBtn = document.createElement('button');
    settingsBtn.id = IDS.settingsBtn;
    settingsBtn.innerHTML = `
      <span>⚙</span>
      <span>Settings</span>
    `;
    settingsBtn.addEventListener('click', () => openManagerModal('settings'));

    t.appendChild(managerBtn);
    t.appendChild(recordBtn);
    t.appendChild(settingsBtn);

    document.documentElement.appendChild(t);
    state.toolbar = t;
    updateToolbarCount();
    updateToolbarVisibility();

    return t;
  }

  function updateToolbarCount() {
    const el = document.getElementById(IDS.toolbarCount);
    if (!el || !state.data) return;
    const list = getShortcutsForThisPage();
    el.textContent = String(list.length);
  }

  function updateToolbarVisibility() {
    if (!state.toolbar || !state.data) return;
    state.toolbar.style.display = state.data.settings.showToolbar ? 'flex' : 'none';
  }

  /************************************************************
   * Manager Modal / Macro Editor (UI Skeleton)
   ************************************************************/

  function ensureMask() {
    if (state.mask) return state.mask;
    const m = document.createElement('div');
    m.id = IDS.mask;
    m.addEventListener('click', closeAllModals);
    document.documentElement.appendChild(m);
    state.mask = m;
    return m;
  }

  function openMask() {
    ensureMask().classList.add('show');
  }

  function closeMask() {
    if (state.mask) state.mask.classList.remove('show');
  }

  function closeAllModals() {
    if (state.managerModal) state.managerModal.classList.remove('show');
    if (state.macroModal) state.macroModal.classList.remove('show');
    closeMask();
  }

  function openManagerModal(initialTab) {
    ensureToolbar(); // ensure exists, used as UI root marker
    const m = ensureManagerModal();
    if (initialTab) {
      const pill = m.querySelector(`[data-tab="${initialTab}"]`);
      if (pill) switchManagerTab(pill, initialTab);
    }
    openMask();
    m.classList.add('show');
    refreshManagerList();
  }

  function ensureManagerModal() {
    if (state.managerModal) return state.managerModal;
    const modal = document.createElement('div');
    modal.id = IDS.managerModal;
    modal.innerHTML = buildManagerHTML();
    hookManagerEvents(modal);
    document.documentElement.appendChild(modal);
    state.managerModal = modal;
    return modal;
  }

  function buildManagerHTML() {
    const host = getDomainScope();
    const hk = state.data?.settings?.managerHotkey || DEFAULT_DATA.settings.managerHotkey;
    return `
      <div class="csm-modal-header">
        <div>
          <div class="csm-modal-title">
            <span>Custom Shortcuts Manager</span>
            <span class="csm-pill">Macro · JS · Navigation</span>
          </div>
          <div class="csm-modal-sub">
            Host: <code>${host}</code> · Manager: ${hk}
          </div>
        </div>
        <button class="csm-close-btn" data-csm-close>✕</button>
      </div>
      <div class="csm-manager-layout">
        <aside class="csm-sidebar">
          <div class="csm-sidebar-label">Views</div>
          <div class="csm-sidebar-list">
            <div class="csm-sidebar-pill active" data-tab="shortcuts">
              <span>All Shortcuts</span>
            </div>
            <div class="csm-sidebar-pill" data-tab="per-site">
              <span>Per-site</span>
            </div>
            <div class="csm-sidebar-pill" data-tab="macros">
              <span>Macros</span>
            </div>
            <div class="csm-sidebar-pill" data-tab="settings">
              <span>Settings</span>
            </div>
          </div>
          <div class="csm-sidebar-label" style="margin-top:6px;">Status</div>
          <div class="csm-sidebar-badge">
            <span>⚡</span>
            <span id="csm-count-label">0 shortcuts</span>
          </div>
          <div class="csm-sidebar-badge">
            <span>⏺</span>
            <span id="csm-record-label">Idle</span>
          </div>
        </aside>
        <section class="csm-main">
          <div class="csm-search-row">
            <input class="csm-input" id="csm-search" placeholder="Search by name, keys, action, site..." />
            <button class="csm-btn-soft" id="csm-add">
              <span>＋</span><span>New Shortcut</span>
            </button>
            <button class="csm-btn-soft" id="csm-export">
              <span>⇣</span><span>Export</span>
            </button>
            <button class="csm-btn-soft" id="csm-import">
              <span>⇡</span><span>Import</span>
            </button>
          </div>
          <div id="csm-view-shortcuts" class="csm-view">
            <div class="csm-shortcut-list" id="csm-shortcut-list"></div>
          </div>
          <div id="csm-view-per-site" class="csm-view" style="display:none;">
            <div class="csm-shortcut-list" id="csm-site-list"></div>
          </div>
          <div id="csm-view-macros" class="csm-view" style="display:none;">
            <div class="csm-shortcut-list" id="csm-macro-list"></div>
          </div>
          <div id="csm-view-settings" class="csm-view" style="display:none;">
            ${buildSettingsViewHTML()}
          </div>
        </section>
      </div>
    `;
  }

  function buildSettingsViewHTML() {
    const s = state.data?.settings || DEFAULT_DATA.settings;
    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;font-size:10px;">
        <div>
          <div>Manager Hotkey</div>
          <input class="csm-input" id="csm-settings-manager-hotkey" value="${s.managerHotkey}" />
        </div>
        <div>
          <div>Record Hotkey</div>
          <input class="csm-input" id="csm-settings-record-hotkey" value="${s.recordHotkey}" />
        </div>
        <div>
          <div>Sequence Timeout (ms)</div>
          <input class="csm-input" id="csm-settings-seq-timeout" type="number" value="${s.sequenceTimeout}" />
        </div>
        <div>
          <div>Max Recording Length (ms)</div>
          <input class="csm-input" id="csm-settings-max-rec" type="number" value="${s.maxRecordingLength}" />
        </div>
        <div>
          <div>Conflict Strategy</div>
          <select class="csm-input" id="csm-settings-conflict">
            <option value="warn" ${s.conflictStrategy === 'warn' ? 'selected' : ''}>Warn</option>
            <option value="override" ${s.conflictStrategy === 'override' ? 'selected' : ''}>Override existing</option>
            <option value="disable" ${s.conflictStrategy === 'disable' ? 'selected' : ''}>Disable new</option>
          </select>
        </div>
        <div style="display:flex;align-items:flex-end;gap:6px;">
          <label style="display:flex;align-items:center;gap:5px;">
            <div class="csm-toggle ${s.showToolbar ? 'on' : ''}" id="csm-settings-toolbar-toggle">
              <div class="csm-toggle-knob"></div>
            </div>
            <span>Show toolbar</span>
          </label>
        </div>
      </div>
      <div style="margin-top:6px;font-size:9px;color:var(--csm-text-soft);">
        Settings are global across sites. Shortcuts can be scoped per domain pattern.
      </div>
    `;
  }

  function hookManagerEvents(modal) {
    modal.querySelector('[data-csm-close]').addEventListener('click', closeAllModals);
    modal.querySelectorAll('.csm-sidebar-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const tab = pill.getAttribute('data-tab');
        switchManagerTab(pill, tab);
      });
    });

    modal.querySelector('#csm-search').addEventListener('input', refreshManagerList);
    modal.querySelector('#csm-add').addEventListener('click', () => createOrEditShortcut());
    modal.querySelector('#csm-export').addEventListener('click', exportShortcuts);
    modal.querySelector('#csm-import').addEventListener('click', importShortcuts);

    modal.addEventListener('click', (e) => {
      const toggle = e.target.closest('.csm-toggle');
      if (toggle && toggle.id === 'csm-settings-toolbar-toggle') {
        toggle.classList.toggle('on');
        state.data.settings.showToolbar = toggle.classList.contains('on');
        persist();
        updateToolbarVisibility();
      }
    });

    modal.addEventListener('change', (e) => {
      const id = e.target.id;
      const val = e.target.value;
      const s = state.data.settings;
      if (id === 'csm-settings-manager-hotkey') s.managerHotkey = val || DEFAULT_DATA.settings.managerHotkey;
      if (id === 'csm-settings-record-hotkey') s.recordHotkey = val || DEFAULT_DATA.settings.recordHotkey;
      if (id === 'csm-settings-seq-timeout') s.sequenceTimeout = Math.max(100, Number(val) || DEFAULT_DATA.settings.sequenceTimeout);
      if (id === 'csm-settings-max-rec') s.maxRecordingLength = Math.max(1000, Number(val) || DEFAULT_DATA.settings.maxRecordingLength);
      if (id === 'csm-settings-conflict') s.conflictStrategy = val || 'warn';
      persist();
    });
  }

  function switchManagerTab(activePill, tab) {
    const modal = state.managerModal;
    if (!modal) return;
    modal.querySelectorAll('.csm-sidebar-pill').forEach(p => p.classList.remove('active'));
    activePill.classList.add('active');
    modal.querySelectorAll('.csm-view').forEach(v => (v.style.display = 'none'));
    const view = modal.querySelector(`#csm-view-${tab}`);
    if (view) view.style.display = '';
    refreshManagerList();
  }

  function refreshManagerList() {
    if (!state.managerModal || !state.data) return;
    const search = (state.managerModal.querySelector('#csm-search')?.value || '').toLowerCase();
    const host = getDomainScope();
    const shortcuts = state.data.shortcuts;
    const listEl = state.managerModal.querySelector('#csm-shortcut-list');
    const siteEl = state.managerModal.querySelector('#csm-site-list');
    const macroEl = state.managerModal.querySelector('#csm-macro-list');
    const countLabel = state.managerModal.querySelector('#csm-count-label');

    const filtered = shortcuts.filter(s => {
      if (search) {
        const hay = `${s.name} ${s.keys} ${s.action} ${s.scope || ''} ${s.category || ''}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    if (listEl) {
      listEl.innerHTML = '';
      for (const s of filtered) {
        const conflicts = findConflicts(s);
        const row = document.createElement('div');
        row.className = 'csm-shortcut-item';
        row.dataset.id = s.id;
        row.innerHTML = `
          <div class="csm-shortcut-name">${s.name || '(unnamed)'}</div>
          <div class="csm-shortcut-keys">${keyPatternToDisplay(s.keys)}</div>
          <div class="csm-shortcut-action">${s.action}</div>
          <div>
            <div class="csm-shortcut-scope">${s.scope || 'global'}</div>
            <div class="csm-shortcut-tags">
              ${s.category ? `<span class="csm-tag">${s.category}</span>` : ''}
              ${s.action === 'macro' ? `<span class="csm-tag">macro</span>` : ''}
              ${conflicts.length ? `<span class="csm-tag csm-tag-conflict">${conflicts.length} conflict</span>` : ''}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <div class="csm-toggle ${s.enabled ? 'on' : ''}" data-csm-toggle="${s.id}">
              <div class="csm-toggle-knob"></div>
            </div>
            <button class="csm-chip-btn" data-csm-edit="${s.id}">✎</button>
            <button class="csm-chip-btn" data-csm-test="${s.id}">⚡</button>
            ${s.builtin ? '' : '<button class="csm-chip-btn" data-csm-del="' + s.id + '">🗑</button>'}
          </div>
        `;
        listEl.appendChild(row);
      }

      listEl.onclick = (e) => {
        const t = e.target;
        const toggle = t.closest('[data-csm-toggle]');
        const edit = t.closest('[data-csm-edit]');
        const del = t.closest('[data-csm-del]');
        const test = t.closest('[data-csm-test]');
        if (toggle) {
          const id = toggle.getAttribute('data-csm-toggle');
          const s = shortcuts.find(x => x.id === id);
          if (!s) return;
          s.enabled = !s.enabled;
          toggle.classList.toggle('on', s.enabled);
          persist();
          updateToolbarCount();
        }
        if (edit) {
          const id = edit.getAttribute('data-csm-edit');
          const s = shortcuts.find(x => x.id === id);
          if (s) createOrEditShortcut(s);
        }
        if (del) {
          const id = del.getAttribute('data-csm-del');
          const idx = shortcuts.findIndex(x => x.id === id && !x.builtin);
          if (idx !== -1) {
            shortcuts.splice(idx, 1);
            persist();
            refreshManagerList();
            updateToolbarCount();
          }
        }
        if (test) {
          const id = test.getAttribute('data-csm-test');
          const s = shortcuts.find(x => x.id === id);
          if (s) {
            const conflicts = findConflicts(s);
            if (conflicts.length) {
              showToast(`Shortcut conflicts with ${conflicts.map(c => c.name).join(', ')}`, 'error', 'Conflict');
            } else {
              showToast('No conflicts detected for this shortcut', 'success', 'OK');
            }
          }
        }
      };
    }

    if (siteEl) {
      siteEl.innerHTML = '';
      const siteShortcuts = shortcuts.filter(s => s.scope && s.scope !== 'global');
      if (!siteShortcuts.length) {
        siteEl.innerHTML = `<div style="padding:4px;color:var(--csm-text-soft);">No per-site shortcuts defined.</div>`;
      } else {
        for (const s of siteShortcuts) {
          const row = document.createElement('div');
          row.className = 'csm-shortcut-item';
          row.innerHTML = `
            <div class="csm-shortcut-name">${s.name}</div>
            <div class="csm-shortcut-keys">${s.keys}</div>
            <div class="csm-shortcut-action">${s.action}</div>
            <div class="csm-shortcut-scope">${s.scope}</div>
            <div></div>
          `;
          siteEl.appendChild(row);
        }
      }
    }

    if (macroEl) {
      macroEl.innerHTML = '';
      const macros = shortcuts.filter(s => s.action === 'macro');
      if (!macros.length) {
        macroEl.innerHTML = `<div style="padding:4px;color:var(--csm-text-soft);">No macros recorded yet. Use the Record button or add a macro shortcut.</div>`;
      } else {
        for (const s of macros) {
          const steps = (s.params && Array.isArray(s.params.steps)) ? s.params.steps.length : 0;
          const row = document.createElement('div');
          row.className = 'csm-shortcut-item';
          row.innerHTML = `
            <div class="csm-shortcut-name">${s.name}</div>
            <div class="csm-shortcut-keys">${s.keys}</div>
            <div class="csm-shortcut-action">macro · ${steps} steps</div>
            <div class="csm-shortcut-scope">${s.scope || 'global'}</div>
            <div>
              <button class="csm-chip-btn" data-csm-edit="${s.id}">Edit</button>
              <button class="csm-chip-btn" data-csm-play="${s.id}">▶</button>
            </div>
          `;
          macroEl.appendChild(row);
        }
        macroEl.onclick = (e) => {
          const play = e.target.closest('[data-csm-play]');
          const edit = e.target.closest('[data-csm-edit]');
          if (play) {
            const id = play.getAttribute('data-csm-play');
            const s = shortcuts.find(x => x.id === id);
            if (s) executeShortcut(s);
          }
          if (edit) {
            const id = edit.getAttribute('data-csm-edit');
            const s = shortcuts.find(x => x.id === id);
            if (s) createOrEditShortcut(s);
          }
        };
      }
    }

    if (countLabel) {
      countLabel.textContent = `${shortcuts.length} shortcuts`;
    }

    updateToolbarCount();
    const recLabel = state.managerModal.querySelector('#csm-record-label');
    if (recLabel) {
      recLabel.textContent = state.recording ? 'Recording' : 'Idle';
    }
  }

  /************************************************************
   * Shortcut Creation / Editing (simple prompt-based)
   ************************************************************/

  function createOrEditShortcut(existing) {
    const name = prompt('Shortcut name:', existing?.name || '');
    if (!name) return;
    const keys = prompt('Key / sequence (e.g. "Ctrl+Shift+K" or "g g"):', existing?.keys || '');
    if (!keys) return;
    const action = prompt(
      'Action type: scroll, nav, clickSelector, fillInput, macro, javascript',
      existing?.action || 'javascript'
    ) || 'javascript';
    const scope = prompt(
      'Scope (global or domain/wildcard, e.g. "global", "example.com", "*.example.com"):',
      existing?.scope || 'global'
    ) || 'global';

    const shortcut = existing || {
      id: existing?.id || `csm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      params: {}
    };
    shortcut.name = name;
    shortcut.keys = keys.trim();
    shortcut.action = action.trim();
    shortcut.scope = scope.trim();
    shortcut.enabled = existing?.enabled ?? true;
    shortcut.category = inferCategory(shortcut);

    if (shortcut.action === 'javascript') {
      const code = prompt('JavaScript code to run:', existing?.params?.code || 'console.log("Hello from CSM");');
      shortcut.params = { code };
    } else if (shortcut.action === 'scroll') {
      const dir = prompt('Scroll direction (top,bottom,up,down,pageUp,pageDown):', existing?.params?.direction || 'down') || 'down';
      shortcut.params = { direction: dir, smooth: true };
    } else if (shortcut.action === 'nav') {
      const nav = prompt('Navigation (back,forward,reload):', existing?.params?.type || 'back') || 'back';
      shortcut.params = { type: nav };
    } else if (shortcut.action === 'clickSelector') {
      const sel = prompt('CSS selector to click:', existing?.params?.selector || '');
      shortcut.params = { selector: sel };
    } else if (shortcut.action === 'fillInput') {
      const sel = prompt('Input selector:', existing?.params?.selector || '');
      const val = prompt('Value to fill:', existing?.params?.value || '');
      shortcut.params = { selector: sel, value: val };
    } else if (shortcut.action === 'macro') {
      if (!existing || !Array.isArray(existing.params?.steps)) {
        shortcut.params = { steps: [], loop: 1 };
      }
      // For now we keep existing steps; full editor is available via manager modal.
    }

    const conflicts = findConflicts(shortcut);
    handleConflictsOnSave(shortcut, conflicts);

    if (!existing) {
      state.data.shortcuts.push(shortcut);
    }

    persist();
    showToast('Shortcut saved', 'success', 'Saved');
    refreshManagerList();
    updateToolbarCount();
  }

  function inferCategory(s) {
    if (s.action === 'scroll' || s.action === 'nav') return 'navigation';
    if (s.action === 'macro') return 'macro';
    if (s.action === 'javascript') return 'custom';
    return 'general';
  }

  function handleConflictsOnSave(shortcut, conflicts) {
    if (!conflicts.length) return;
    const strategy = state.data.settings.conflictStrategy || 'warn';
    if (strategy === 'warn') {
      showToast(
        `Conflict: ${shortcut.keys} already used by ${conflicts.map(c => c.name).join(', ')}`,
        'error',
        'Conflict'
      );
    } else if (strategy === 'override') {
      for (const c of conflicts) c.enabled = false;
      showToast(`Existing shortcuts with ${shortcut.keys} disabled`, 'success', 'Override');
    } else if (strategy === 'disable') {
      shortcut.enabled = false;
      showToast('New shortcut disabled due to conflict', 'error', 'Conflict');
    }
  }

  function exportShortcuts() {
    const data = cloneData(state.data);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom-shortcuts-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported shortcuts as JSON', 'success', 'Export');
  }

  function importShortcuts() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.shortcuts) || !data.settings) {
            throw new Error('Invalid format');
          }
          state.data = data;
          persist();
          showToast('Imported shortcuts', 'success', 'Import');
          refreshManagerList();
          updateToolbarCount();
          updateToolbarVisibility();
        } catch (e) {
          console.error(e);
          showToast('Failed to import shortcuts', 'error', 'Error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /************************************************************
   * Key Handling + Shortcut Matching
   ************************************************************/

  function handleKeyDown(e) {
    if (!state.ready || !state.data) return;
    if (shouldIgnoreKeyTarget(e.target)) return;

    const s = state.data.settings;

    // Manager hotkey (inactive-only to not conflict)
    if (matchesHotkey(e, s.managerHotkey)) {
      e.preventDefault();
      openManagerModal();
      return;
    }

    // Record hotkey
    if (matchesHotkey(e, s.recordHotkey)) {
      e.preventDefault();
      toggleRecording();
      return;
    }

    // During recording, events are captured separately
    if (state.recording) return;

    const nowTs = now();

    // Sequence buffer management
    if (nowTs - state.lastKeyTime > (s.sequenceTimeout || 500)) {
      state.sequenceBuffer = [];
    }
    state.lastKeyTime = nowTs;

    const n = normalizeKeyEvent(e);
    state.sequenceBuffer.push(n);
    if (state.sequenceBuffer.length > (s.maxSequenceLength || 4)) {
      state.sequenceBuffer.shift();
    }

    const matched = matchShortcutFromBuffer(e);
    if (matched) {
      e.preventDefault();
      executeShortcut(matched);
    }
  }

  function matchesHotkey(e, def) {
    if (!def) return false;
    const spec = parseKeyPattern(def)[0];
    if (!spec) return false;
    return keySpecMatchesEvent(spec, e);
  }

  function shouldIgnoreKeyTarget(target) {
    if (!target) return false;
    const el = target;
    const tag = (el.tagName || '').toLowerCase();
    const editable = el.isContentEditable;
    if (editable) return true;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return false;
  }

  function matchShortcutFromBuffer(e) {
    const host = getDomainScope();
    const all = state.data.shortcuts.filter(s => s.enabled && matchesScope(s.scope, host));
    let found = null;
    for (const s of all) {
      const specs = parseKeyPattern(s.keys);
      if (!specs.length) continue;
      // If single part chord (e.g. Ctrl+K), check immediate chord match
      if (specs.length === 1) {
        if (keySpecMatchesEvent(specs[0], e)) {
          found = s;
          break;
        }
      } else {
        // sequence: compare buffer
        if (matchSequence(specs, state.sequenceBuffer)) {
          found = s;
          break;
        }
      }
    }
    if (!found) return null;
    const conflicts = findConflicts(found).filter(c => c.enabled);
    if (conflicts.length) {
      showToast(`Multiple shortcuts share ${found.keys}`, 'error', 'Conflict');
      if ((state.data.settings.conflictStrategy || 'warn') === 'override') {
        for (const c of conflicts) c.enabled = false;
        persist();
      }
    }
    return found;
  }

  /************************************************************
   * Action Execution / Library
   ************************************************************/

  function executeShortcut(shortcut) {
    if (!shortcut || !shortcut.action) return;
    const type = shortcut.action;
    const params = shortcut.params || {};
    if (type === 'scroll') {
      execScroll(params);
    } else if (type === 'nav') {
      execNav(params);
    } else if (type === 'clickSelector') {
      execClickSelector(params);
    } else if (type === 'fillInput') {
      execFillInput(params);
    } else if (type === 'macro') {
      execMacro(params);
    } else if (type === 'javascript') {
      execJavaScript(params);
    } else {
      showToast(`Unknown action: ${type}`, 'error', 'Error');
    }
  }

  function execScroll({ direction = 'down', smooth = true } = {}) {
    const behavior = smooth ? 'smooth' : 'auto';
    if (direction === 'top') {
      window.scrollTo({ top: 0, behavior });
    } else if (direction === 'bottom') {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    } else if (direction === 'up') {
      window.scrollBy({ top: -window.innerHeight * 0.75, behavior });
    } else if (direction === 'down') {
      window.scrollBy({ top: window.innerHeight * 0.75, behavior });
    } else if (direction === 'pageUp') {
      window.scrollBy({ top: -window.innerHeight, behavior });
    } else if (direction === 'pageDown') {
      window.scrollBy({ top: window.innerHeight, behavior });
    }
  }

  function execNav({ type = 'back' } = {}) {
    if (type === 'back') window.history.back();
    else if (type === 'forward') window.history.forward();
    else if (type === 'reload') window.location.reload();
  }

  function execClickSelector({ selector }) {
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) {
      showToast(`Element not found: ${selector}`, 'error', 'Click');
      return;
    }
    el.click();
  }

  function execFillInput({ selector, value }) {
    const el = selector ? document.querySelector(selector) : null;
    if (!el) {
      showToast(`Input not found: ${selector}`, 'error', 'Fill');
      return;
    }
    el.value = value != null ? value : '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function execMacro({ steps = [], loop = 1, speed = 1 } = {}) {
    if (!Array.isArray(steps) || !steps.length) return;
    if (state.playing) return;
    state.playing = true;
    const effSpeed = speed > 0 ? speed : 1;

    const runStep = async (step) => {
      const delay = (step.delay || 0) / effSpeed;
      if (delay) {
        await new Promise(r => setTimeout(r, delay));
      }
      if (step.type === 'click') {
        if (step.selector) {
          const el = document.querySelector(step.selector);
          if (el) el.click();
        } else if (typeof step.x === 'number' && typeof step.y === 'number') {
          const el = document.elementFromPoint(step.x, step.y);
          if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      } else if (step.type === 'scroll') {
        execScroll(step);
      } else if (step.type === 'type') {
        const active = document.activeElement;
        if (active && 'value' in active) {
          active.value += step.text || '';
          active.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else if (step.type === 'keypress') {
        const active = document.activeElement || document.body;
        active.dispatchEvent(new KeyboardEvent('keydown', { key: step.key || 'Enter', bubbles: true }));
        active.dispatchEvent(new KeyboardEvent('keyup', { key: step.key || 'Enter', bubbles: true }));
      }
    };

    try {
      for (let i = 0; i < (loop || 1); i++) {
        for (const st of steps) {
          await runStep(st);
        }
      }
    } catch (e) {
      console.error('Macro execution error', e);
      showToast('Macro execution error', 'error', 'Macro');
    } finally {
      state.playing = false;
    }
  }

  function execJavaScript({ code = '' } = {}) {
    try {
      // Sandbox via Function; user is trusted but wrap in try/catch
      const fn = new Function('GM_setClipboard', 'GM_openInTab', 'GM_getValue', 'GM_setValue', `
        try { ${code} } catch (e) { console.error('Custom JS error:', e); alert('Custom JS error: ' + e.message); }
      `);
      fn(GM_setClipboard, GM_openInTab, GM_getValue, GM_setValue);
    } catch (e) {
      console.error(e);
      showToast('Failed to run custom JS', 'error', 'JS');
    }
  }

  /************************************************************
   * Macro Recorder
   ************************************************************/

  function toggleRecording() {
    if (state.recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    if (state.recording) return;
    state.recording = true;
    state.recordStart = now();
    state.lastEventTime = state.recordStart;
    state.recordedSteps = [];
    state.recordExclusionRoot = document.getElementById(IDS.managerModal) || document.getElementById(IDS.toolbar);

    window.addEventListener('click', recordClick, true);
    window.addEventListener('keydown', recordKey, true);
    window.addEventListener('scroll', recordScroll, true);
    window.addEventListener('input', recordInput, true);

    setRecordingIndicator(true);
    const btn = document.getElementById(IDS.recordBtn);
    if (btn) btn.classList.add('csm-recording');
    showToast('Recording macro... press Alt+Shift+R again to stop', 'info', 'Record');
    refreshManagerList();
  }

  function stopRecording() {
    if (!state.recording) return;
    state.recording = false;

    window.removeEventListener('click', recordClick, true);
    window.removeEventListener('keydown', recordKey, true);
    window.removeEventListener('scroll', recordScroll, true);
    window.removeEventListener('input', recordInput, true);

    setRecordingIndicator(false);
    const btn = document.getElementById(IDS.recordBtn);
    if (btn) btn.classList.remove('csm-recording');

    const steps = state.recordedSteps.slice();
    if (!steps.length) {
      showToast('No actions recorded', 'info', 'Record');
      refreshManagerList();
      return;
    }

    showToast(`Recorded ${steps.length} steps`, 'success', 'Record');
    openMacroEditor(steps);
    refreshManagerList();
  }

  function isFromUI(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest(`#${IDS.toolbar}`)) return true;
    if (target.closest(`#${IDS.managerModal}`)) return true;
    if (target.closest(`#${IDS.macroModal}`)) return true;
    if (target.closest(`#${IDS.mask}`)) return true;
    return false;
  }

  function recordDelay() {
    const t = now();
    const delta = t - state.lastEventTime;
    state.lastEventTime = t;
    return delta;
  }

  function recordClick(e) {
    if (!state.recording) return;
    if (isFromUI(e.target)) return;
    const delay = recordDelay();
    const selector = buildRobustSelector(e.target);
    state.recordedSteps.push({
      type: 'click',
      selector,
      x: e.clientX,
      y: e.clientY,
      delay
    });
  }

  function recordKey(e) {
    if (!state.recording) return;
    if (isFromUI(e.target)) return;
    const delay = recordDelay();
    if (e.key === 'Shift' || e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') return;
    if (e.key === 'Enter') {
      state.recordedSteps.push({ type: 'keypress', key: 'Enter', delay });
    } else if (e.key.length === 1) {
      state.recordedSteps.push({ type: 'type', text: e.key, delay });
    }
  }

  function recordScroll() {
    if (!state.recording) return;
    const delay = recordDelay();
    state.recordedSteps.push({
      type: 'scroll',
      direction: 'down',
      delay
    });
  }

  function recordInput(e) {
    if (!state.recording) return;
    if (!(e.target instanceof Element)) return;
    if (isFromUI(e.target)) return;
    const tag = e.target.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') return;
    const delay = recordDelay();
    const selector = buildRobustSelector(e.target);
    state.recordedSteps.push({
      type: 'fill',
      selector,
      value: e.target.value,
      delay
    });
  }

  function buildRobustSelector(el) {
    if (!(el instanceof Element)) return null;
    if (el.id) return `#${cssEscape(el.id)}`;
    const classes = Array.from(el.classList || []).slice(0, 3).map(c => `.${cssEscape(c)}`).join('');
    if (classes) {
      const sel = `${el.tagName.toLowerCase()}${classes}`;
      if (document.querySelectorAll(sel).length === 1) return sel;
    }
    let path = el.tagName.toLowerCase();
    let cur = el;
    while (cur.parentElement) {
      const parent = cur.parentElement;
      const siblings = Array.from(parent.children).filter(x => x.tagName === cur.tagName);
      const idx = siblings.indexOf(cur);
      const part = `${cur.tagName.toLowerCase()}:nth-of-type(${idx + 1})`;
      path = `${part}${path ? '>' + path : ''}`;
      cur = parent;
      if (cur.id) {
        path = `#${cssEscape(cur.id)}>${path}`;
        break;
      }
    }
    return path;
  }

  function cssEscape(str) {
    return (window.CSS && CSS.escape) ? CSS.escape(str) : str.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
  }

  function openMacroEditor(steps) {
    const modal = ensureMacroModal();
    const stepsEl = modal.querySelector('#csm-steps');
    stepsEl.innerHTML = '';
    steps.forEach((s, i) => {
      const row = document.createElement('div');
      row.className = 'csm-step';
      row.dataset.index = String(i);
      row.innerHTML = `
        <div class="csm-step-index">${i + 1}</div>
        <div class="csm-step-type">${s.type}</div>
        <div class="csm-step-info">${describeStep(s)}</div>
        <div class="csm-step-delay">${Math.round(s.delay || 0)}ms</div>
        <button class="csm-step-remove" data-csm-step-remove="${i}">✕</button>
      `;
      stepsEl.appendChild(row);
    });
    modal.dataset.steps = JSON.stringify(steps);
    openMask();
    modal.classList.add('show');
  }

  function describeStep(s) {
    if (s.type === 'click') {
      return s.selector ? `Click ${s.selector}` : `Click @ ${s.x},${s.y}`;
    }
    if (s.type === 'scroll') {
      return `Scroll ${s.direction || ''}`;
    }
    if (s.type === 'type') {
      return `Type "${s.text}"`;
    }
    if (s.type === 'keypress') {
      return `Key "${s.key}"`;
    }
    if (s.type === 'fill') {
      return `Fill ${s.selector}`;
    }
    return s.type;
  }

  function ensureMacroModal() {
    if (state.macroModal) return state.macroModal;
    const modal = document.createElement('div');
    modal.id = IDS.macroModal;
    modal.innerHTML = `
      <div class="csm-modal-header">
        <div>
          <div class="csm-modal-title">
            <span>Macro Editor</span>
            <span class="csm-pill">Recorded Steps</span>
          </div>
          <div class="csm-modal-sub">Adjust steps, delays, loop count, and bind to shortcut.</div>
        </div>
        <button class="csm-close-btn" data-csm-close>✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;">
        <div style="display:flex;gap:6px;font-size:10px;">
          <div style="flex:2;">
            <div>Name</div>
            <input class="csm-input" id="csm-macro-name" placeholder="My macro" />
          </div>
          <div style="flex:2;">
            <div>Shortcut keys</div>
            <input class="csm-input" id="csm-macro-keys" placeholder="Alt+M" />
          </div>
          <div style="flex:1;">
            <div>Scope</div>
            <input class="csm-input" id="csm-macro-scope" placeholder="global or domain pattern" value="global" />
          </div>
          <div style="flex:0.5;">
            <div>Loop</div>
            <input class="csm-input" id="csm-macro-loop" type="number" value="1" min="1" />
          </div>
        </div>
        <div class="csm-steps" id="csm-steps"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;">
          <div style="font-size:9px;color:var(--csm-text-soft);">
            Drag-to-reorder not implemented yet; delete and re-record for complex flows.
          </div>
          <div style="display:flex;gap:6px;">
            <button class="csm-btn-soft" id="csm-macro-preview">▶ Preview</button>
            <button class="csm-btn-soft" id="csm-macro-save">💾 Save macro</button>
          </div>
        </div>
      </div>
    `;
    modal.querySelector('[data-csm-close]').addEventListener('click', closeAllModals);
    modal.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-csm-step-remove]');
      if (removeBtn) {
        const idx = Number(removeBtn.getAttribute('data-csm-step-remove'));
        const steps = JSON.parse(modal.dataset.steps || '[]');
        if (idx >= 0 && idx < steps.length) {
          steps.splice(idx, 1);
          modal.dataset.steps = JSON.stringify(steps);
          openMacroEditor(steps); // rebuild
        }
      }
    });
    modal.querySelector('#csm-macro-preview').addEventListener('click', () => {
      const steps = JSON.parse(modal.dataset.steps || '[]');
      execMacro({ steps, loop: 1 });
    });
    modal.querySelector('#csm-macro-save').addEventListener('click', () => {
      const name = modal.querySelector('#csm-macro-name').value || 'Macro';
      const keys = modal.querySelector('#csm-macro-keys').value || '';
      const scope = modal.querySelector('#csm-macro-scope').value || 'global';
      const loop = Math.max(1, Number(modal.querySelector('#csm-macro-loop').value) || 1);
      const steps = JSON.parse(modal.dataset.steps || '[]');
      if (!keys || !steps.length) {
        showToast('Need keys and at least one step', 'error', 'Macro');
        return;
      }
      const macro = {
        id: `macro-${Date.now()}`,
        name,
        keys,
        action: 'macro',
        params: { steps, loop },
        scope,
        enabled: true,
        category: 'macro'
      };
      const conflicts = findConflicts(macro);
      handleConflictsOnSave(macro, conflicts);
      state.data.shortcuts.push(macro);
      persist();
      closeAllModals();
      showToast('Macro saved', 'success', 'Macro');
      refreshManagerList();
      updateToolbarCount();
    });
    document.documentElement.appendChild(modal);
    state.macroModal = modal;
    return modal;
  }

  /************************************************************
   * Init
   ************************************************************/

  function init() {
    loadAll();
    ensureBaseStyles();
    ensureToolbar();

    window.addEventListener('keydown', handleKeyDown, true);

    GM_registerMenuCommand('Open Shortcuts Manager', () => openManagerModal());
    GM_registerMenuCommand('Toggle Recording', () => toggleRecording());

    updateToolbarCount();
    showToast('Custom Shortcuts Manager loaded', 'info', 'CSM');
  }

  // register with QoL framework
  QoL.registerScript({
    id: SCRIPT_ID,
    name: 'Custom Shortcuts Manager',
    description: 'Full macro system with recording, common actions, custom JS, and per-site shortcuts',
    version: '1.1.0',
    enabled: true,
    
    settings: {
      managerHotkey: { type: 'text', default: 'Alt+K', label: 'Manager Hotkey' },
      recordHotkey: { type: 'text', default: 'Alt+Shift+R', label: 'Record Hotkey' },
      sequenceTimeout: { type: 'text', default: '500', label: 'Sequence Timeout (ms)' },
      maxRecordingLength: { type: 'text', default: '300000', label: 'Max Recording Length (ms)' },
      conflictStrategy: { 
        type: 'select', 
        options: [
          { value: 'warn', label: 'Warn' },
          { value: 'override', label: 'Override existing' },
          { value: 'disable', label: 'Disable new' }
        ],
        default: 'warn',
        label: 'Conflict Strategy'
      },
      showToolbar: { type: 'toggle', default: true, label: 'Show toolbar' }
    },
    
    getSetting(key) {
      return state.data?.settings?.[key] ?? DEFAULT_DATA.settings[key];
    },
    
    setSetting(key, value) {
      if (!state.data) loadAll();
      state.data.settings[key] = value;
      persist();
    },
    
    setSettings(newSettings) {
      if (!state.data) loadAll();
      for (const [key, value] of Object.entries(newSettings)) {
        state.data.settings[key] = value;
      }
      persist();
    },
    
    init() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      return state;
    },
    
    destroy(instance) {
      // cleanup
      if (state.toolbar) {
        state.toolbar.remove();
        state.toolbar = null;
      }
      if (state.managerModal) {
        state.managerModal.remove();
        state.managerModal = null;
      }
      if (state.macroModal) {
        state.macroModal.remove();
        state.macroModal = null;
      }
      if (state.mask) {
        state.mask.remove();
        state.mask = null;
      }
      // remove event listeners
      window.removeEventListener('keydown', handleKeyDown, true);
    }
  });
})();