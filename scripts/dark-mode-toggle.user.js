// ==UserScript==
// @name         Dark Mode Toggle
// @namespace    dark-mode-toggle
// @version      1.0.1
// @description  Hybrid dark mode with smart CSS injection and filter fallback, per-site overrides
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/gh/pc-style/qol@main/dist/qol-framework.user.js
// @updateURL    https://raw.githubusercontent.com/pc-style/qol/main/scripts/dark-mode-toggle.user.js
// @downloadURL  https://raw.githubusercontent.com/pc-style/qol/main/scripts/dark-mode-toggle.user.js
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // wait for framework to load
  function waitForQoL(callback, maxAttempts = 100) {
    // check all possible locations for QoL
    let qol = null;
    
    if (typeof QoL !== 'undefined') {
      qol = QoL;
    } else if (typeof window !== 'undefined' && window.QoL) {
      qol = window.QoL;
    } else if (typeof globalThis !== 'undefined' && globalThis.QoL) {
      qol = globalThis.QoL;
    } else if (typeof self !== 'undefined' && self.QoL) {
      qol = self.QoL;
    }
    
    if (qol && typeof qol.registerScript === 'function') {
      // ensure QoL is available globally for this script
      if (typeof QoL === 'undefined') {
        if (typeof window !== 'undefined') window.QoL = qol;
        if (typeof globalThis !== 'undefined') globalThis.QoL = qol;
        if (typeof self !== 'undefined') self.QoL = qol;
      }
      callback();
      return;
    }
    
    if (maxAttempts <= 0) {
      console.error('[dark-mode-toggle] QoL framework not loaded after timeout. Check that the framework script is installed and @require URL is correct.');
      return;
    }
    
    setTimeout(() => waitForQoL(callback, maxAttempts - 1), 50);
  }
  
  waitForQoL(() => {
    initScript();
  });
  
  function initScript() {

  const SCRIPT_ID = 'dark-mode-toggle';

  // modes
  const MODES = {
    SMART: 'smart',    // smart CSS injection
    FILTER: 'filter',  // CSS filter fallback
    OFF: 'off'         // disabled
  };

  const MODE_SEQUENCE = [MODES.SMART, MODES.FILTER, MODES.OFF];

  // defaults
  const DEFAULTS = {
    enabled: true,
    defaultMode: MODES.SMART,
    hotkey: 'Ctrl+D',
    colors: {
      background: '#0b1220',
      surface: '#1f2937',
      text: '#e5e7eb',
      accent: '#6366f1'
    },
    siteOverrides: {},
    excludePatterns: [],
    respectNativeDark: true
  };

  // state
  const state = {
    settings: null,
    currentMode: MODES.OFF,
    host: normalizeHost(location.hostname),
    hotkeyHandler: null,
    mutationObserver: null,
    shadowStyles: new WeakMap(),
    attachShadowPatched: false,
    autoDisabled: false
  };

  // CSS for smart mode - proper dark theme with CSS variables
  const SMART_CSS = `
:root[data-dmt-mode="smart"] {
  color-scheme: dark;
}
:root[data-dmt-mode="smart"] body,
:root[data-dmt-mode="smart"] html {
  background: linear-gradient(160deg, var(--dmt-bg-primary, #0b1220), var(--dmt-bg-secondary, #1f2937)) !important;
  color: var(--dmt-text-color, #e5e7eb) !important;
  transition: background 0.3s ease, color 0.3s ease;
}
:root[data-dmt-mode="smart"] body {
  background-attachment: fixed;
}
:root[data-dmt-mode="smart"] body ::selection {
  background: rgba(99, 102, 241, 0.35);
  color: var(--dmt-text-color, #e5e7eb);
}
:root[data-dmt-mode="smart"] body,
:root[data-dmt-mode="smart"] body :is(p, span, li, label, strong, em, h1, h2, h3, h4, h5, h6, small, code) {
  color: var(--dmt-text-color, #e5e7eb) !important;
}
:root[data-dmt-mode="smart"] body :is(main, section, article, nav, header, footer, aside, div, table, ul, ol, blockquote, pre, code, details, summary) {
  background-color: var(--dmt-surface-solid, #1f2937) !important;
  border-color: var(--dmt-border-color, #374151) !important;
}
:root[data-dmt-mode="smart"] body :is(input, textarea, select, button) {
  background-color: rgba(31, 41, 55, 0.95) !important;
  border: 1px solid var(--dmt-border-color, #374151) !important;
  color: var(--dmt-text-color, #e5e7eb) !important;
  border-radius: 6px !important;
}
:root[data-dmt-mode="smart"] a {
  color: var(--dmt-accent-color, #6366f1) !important;
}
:root[data-dmt-mode="smart"] pre,
:root[data-dmt-mode="smart"] code {
  background-color: rgba(15, 23, 42, 0.8) !important;
  color: #f8fafc !important;
}
:root[data-dmt-mode="smart"] img,
:root[data-dmt-mode="smart"] video,
:root[data-dmt-mode="smart"] canvas,
:root[data-dmt-mode="smart"] svg,
:root[data-dmt-mode="smart"] picture {
  filter: none !important;
  mix-blend-mode: normal !important;
}
:root[data-dmt-mode="smart"] [class*="dark"],
:root[data-dmt-mode="smart"] [data-theme="dark"],
:root[data-dmt-mode="smart"] [data-theme="night"] {
  background-color: initial !important;
  color: inherit !important;
}
:root[data-dmt-mode="smart"] * {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
`;

  // CSS for filter mode - simple invert fallback
  const FILTER_CSS = `
:root[data-dmt-mode="filter"] {
  color-scheme: dark;
  background-color: #0f172a !important;
}
:root[data-dmt-mode="filter"] body,
:root[data-dmt-mode="filter"] html {
  background-color: #0f172a !important;
  filter: invert(0.92) hue-rotate(180deg);
  transition: filter 0.3s ease;
}
:root[data-dmt-mode="filter"] img,
:root[data-dmt-mode="filter"] video,
:root[data-dmt-mode="filter"] canvas,
:root[data-dmt-mode="filter"] picture,
:root[data-dmt-mode="filter"] svg {
  filter: invert(1) hue-rotate(180deg) !important;
}
:root[data-dmt-mode="filter"] iframe {
  filter: invert(1) hue-rotate(180deg);
}
`;

  // shadow DOM CSS
  const SHADOW_CSS = `
:host-context(:root[data-dmt-mode="smart"]) {
  color: var(--dmt-text-color, #e5e7eb);
}
:host-context(:root[data-dmt-mode="smart"]) * {
  color: var(--dmt-text-color, #e5e7eb);
}
:host-context(:root[data-dmt-mode="smart"]) :is(input, textarea, select, button) {
  background-color: rgba(31, 41, 55, 0.95);
  color: var(--dmt-text-color, #e5e7eb);
}
:host-context(:root[data-dmt-mode="filter"]) {
  filter: invert(0.92) hue-rotate(180deg);
}
:host-context(:root[data-dmt-mode="filter"]) img,
:host-context(:root[data-dmt-mode="filter"]) video,
:host-context(:root[data-dmt-mode="filter"]) canvas {
  filter: invert(1) hue-rotate(180deg);
}
`;

  // settings management
  const Settings = {
    load() {
      const stored = QoL.store.get(SCRIPT_ID, 'settings', null);
      state.settings = mergeSettings(stored || {});
    },

    save() {
      if (!state.settings) return;
      QoL.store.set(SCRIPT_ID, 'settings', state.settings);
    }
  };

  function mergeSettings(stored) {
    const merged = {
      ...DEFAULTS,
      ...stored,
      colors: { ...DEFAULTS.colors, ...(stored.colors || {}) },
      siteOverrides: { ...(stored.siteOverrides || {}) },
      excludePatterns: Array.isArray(stored.excludePatterns) 
        ? stored.excludePatterns.filter(Boolean) 
        : [],
      respectNativeDark: typeof stored.respectNativeDark === 'boolean' 
        ? stored.respectNativeDark 
        : DEFAULTS.respectNativeDark
    };
    
    // auto-enable if system prefers dark
    if (typeof stored.enabled !== 'boolean') {
      merged.enabled = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    // derive surface color if missing
    if (!merged.colors.surface) {
      merged.colors.surface = deriveSurfaceColor(merged.colors.background);
    }
    
    return merged;
  }

  function deriveSurfaceColor(background) {
    // mix background with white to get surface
    return mixColor(background, '#ffffff', 0.12) || '#1f2937';
  }

  function mixColor(sourceHex, targetHex, weight) {
    const source = hexToRgb(sourceHex);
    const target = hexToRgb(targetHex);
    if (!source || !target) return sourceHex;
    
    const w = Math.min(Math.max(weight, 0), 1);
    const r = Math.round(source.r * (1 - w) + target.r * w);
    const g = Math.round(source.g * (1 - w) + target.g * w);
    const b = Math.round(source.b * (1 - w) + target.b * w);
    
    return rgbToHex(r, g, b);
  }

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    const cleaned = hex.replace('#', '');
    if (![3, 6].includes(cleaned.length)) return null;
    
    const normalized = cleaned.length === 3
      ? cleaned.split('').map(char => char + char).join('')
      : cleaned;
    
    const int = parseInt(normalized, 16);
    if (Number.isNaN(int)) return null;
    
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = val => val.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // apply CSS variables to root
  function applyColorVariables(targetDoc = document) {
    if (!state.settings || !targetDoc?.documentElement) return;
    
    const colors = state.settings.colors;
    const bg = sanitizeColor(colors.background, DEFAULTS.colors.background);
    const text = sanitizeColor(colors.text, DEFAULTS.colors.text);
    const accent = sanitizeColor(colors.accent, DEFAULTS.colors.accent);
    const surface = colors.surface || deriveSurfaceColor(bg);
    const border = mixColor(surface, '#ffffff', 0.25) || '#374151';

    const root = targetDoc.documentElement;
    root.style.setProperty('--dmt-bg-primary', bg);
    root.style.setProperty('--dmt-bg-secondary', surface);
    root.style.setProperty('--dmt-text-color', text);
    root.style.setProperty('--dmt-accent-color', accent);
    root.style.setProperty('--dmt-surface-solid', surface);
    root.style.setProperty('--dmt-border-color', border);
  }

  // inject CSS styles
  function ensureStyle(targetDoc, id, css) {
    if (!targetDoc) return null;
    
    let el = targetDoc.getElementById(id);
    if (!el) {
      el = targetDoc.createElement('style');
      el.id = id;
      el.textContent = css;
      (targetDoc.head || targetDoc.documentElement).appendChild(el);
    } else if (el.textContent !== css) {
      el.textContent = css;
    }
    return el;
  }

  function ensureSmartStyle(targetDoc = document) {
    return ensureStyle(targetDoc, 'dmt-smart-style', SMART_CSS);
  }

  function ensureFilterStyle(targetDoc = document) {
    return ensureStyle(targetDoc, 'dmt-filter-style', FILTER_CSS);
  }

  // resolve which mode to use
  function resolveMode() {
    const settings = state.settings;
    if (!settings) {
      console.debug('[dark-mode-toggle] resolveMode: no settings');
      return { mode: MODES.OFF };
    }

    // check site override first
    const override = getSiteOverride(state.host);
    if (override) {
      console.debug('[dark-mode-toggle] resolveMode: using site override', override);
      return { mode: override.mode };
    }

    // check if excluded
    if (isUrlExcluded()) {
      console.debug('[dark-mode-toggle] resolveMode: URL excluded');
      return { mode: MODES.OFF };
    }

    // check if disabled
    if (!settings.enabled) {
      console.debug('[dark-mode-toggle] resolveMode: disabled');
      return { mode: MODES.OFF };
    }

    // check native dark mode detection
    if (settings.respectNativeDark) {
      const detected = detectExistingDarkMode();
      console.debug('[dark-mode-toggle] resolveMode: native dark check', {
        detected,
        hasDataDmt: document.documentElement.hasAttribute('data-dmt-mode')
      });
      if (detected) {
        state.autoDisabled = true;
        console.debug('[dark-mode-toggle] resolveMode: native dark detected, auto-disabling');
        return { mode: MODES.OFF };
      }
    }

    state.autoDisabled = false;
    const mode = settings.defaultMode || MODES.SMART;
    console.debug('[dark-mode-toggle] resolveMode: using default mode', mode);
    return { mode };
  }

  function getSiteOverride(host) {
    if (!state.settings || !host) return null;
    const entry = state.settings.siteOverrides?.[host];
    if (entry && isValidMode(entry.mode)) return entry;
    return null;
  }

  function isValidMode(value) {
    return value === MODES.SMART || value === MODES.FILTER || value === MODES.OFF;
  }

  function isUrlExcluded() {
    const patterns = state.settings?.excludePatterns || [];
    const href = location.href;
    return patterns.some(pattern => safeRegexTest(pattern, href));
  }

  function safeRegexTest(pattern, value) {
    try {
      if (!pattern) return false;
      const regex = new RegExp(pattern, 'i');
      return regex.test(value);
    } catch (err) {
      console.warn('[dark-mode-toggle] invalid regex', pattern, err);
      return false;
    }
  }

  function detectExistingDarkMode(targetDoc = document) {
    const doc = targetDoc;
    const root = doc.documentElement;
    const body = doc.body || root;
    
    if (!body || !root) {
      console.debug('[dark-mode-toggle] detectExistingDarkMode: no body/root');
      return false;
    }
    
    // don't detect if we already applied dark mode
    if (root.hasAttribute('data-dmt-mode')) {
      console.debug('[dark-mode-toggle] detectExistingDarkMode: already has data-dmt-mode, skipping');
      return false;
    }
    
    // check for dark mode hints (only on root, not body)
    const hasDarkClass = root.classList.contains('dark');
    const hasDarkTheme = root.dataset.theme === 'dark';
    if (hasDarkClass || hasDarkTheme) {
      console.debug('[dark-mode-toggle] detectExistingDarkMode: found dark hints', { hasDarkClass, hasDarkTheme });
      return true;
    }
    
    // check computed styles - but only if body has original styling
    // if body background was changed by our script, ignore
    const style = doc.defaultView?.getComputedStyle(body);
    if (!style) {
      console.debug('[dark-mode-toggle] detectExistingDarkMode: no computed style');
      return false;
    }
    
    // check if background color looks like it was set by our script
    const bgColor = style.backgroundColor;
    const bgLum = getLuminanceFromCssColor(bgColor);
    const textLum = getLuminanceFromCssColor(style.color);
    
    if (bgLum === null || textLum === null) {
      console.debug('[dark-mode-toggle] detectExistingDarkMode: invalid luminance', { bgColor, bgLum, textLum });
      return false;
    }
    
    // only detect if body has a very dark background AND it's not from our script
    // be more conservative - only detect if it's clearly a dark theme site
    // (very dark background < 0.2, not just slightly dark)
    const contrast = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);
    
    // more strict: very dark background (< 0.2) with good contrast (> 4)
    // and also check that text is light (textLum > bgLum)
    const detected = bgLum < 0.2 && contrast > 4 && textLum > bgLum;
    
    console.debug('[dark-mode-toggle] detectExistingDarkMode: computed check', {
      bgColor,
      bgLum: bgLum.toFixed(3),
      textLum: textLum.toFixed(3),
      contrast: contrast.toFixed(2),
      detected,
      conditions: {
        bgDark: bgLum < 0.2,
        goodContrast: contrast > 4,
        textLighter: textLum > bgLum
      }
    });
    
    return detected;
  }

  function getLuminanceFromCssColor(value) {
    const rgb = parseCssColor(value);
    if (!rgb) return null;
    return relativeLuminance(rgb.r, rgb.g, rgb.b);
  }

  function parseCssColor(value) {
    if (!value) return null;
    if (value.startsWith('#')) return hexToRgb(value);
    
    const match = value.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    
    const parts = match[1].split(',').map(part => parseFloat(part.trim()));
    if (parts.length < 3) return null;
    
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  function relativeLuminance(r, g, b) {
    const srgb = [r, g, b].map(channel => {
      const c = channel / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  // apply mode to document
  function applyMode(mode) {
    const effective = isValidMode(mode) ? mode : MODES.SMART;
    const final = state.settings?.enabled ? effective : MODES.OFF;
    
    console.debug('[dark-mode-toggle] applyMode:', {
      requested: mode,
      effective,
      final,
      enabled: state.settings?.enabled,
      previous: state.currentMode
    });
    
    setDocumentMode(document, final);
    state.currentMode = final;
    syncEmbeddedDocuments(final);
    
    console.debug('[dark-mode-toggle] applyMode: applied', final, {
      hasAttribute: document.documentElement.hasAttribute('data-dmt-mode'),
      attributeValue: document.documentElement.getAttribute('data-dmt-mode')
    });
  }

  function setDocumentMode(targetDoc, mode) {
    if (!targetDoc?.documentElement) return;
    
    if (mode === MODES.SMART) {
      ensureSmartStyle(targetDoc);
      applyColorVariables(targetDoc);
      targetDoc.documentElement.setAttribute('data-dmt-mode', MODES.SMART);
    } else if (mode === MODES.FILTER) {
      ensureFilterStyle(targetDoc);
      targetDoc.documentElement.setAttribute('data-dmt-mode', MODES.FILTER);
    } else {
      targetDoc.documentElement.removeAttribute('data-dmt-mode');
    }
  }

  function syncEmbeddedDocuments(mode) {
    document.querySelectorAll('iframe').forEach(frame => {
      try {
        const doc = frame.contentDocument;
        if (!doc?.documentElement) return;
        
        ensureSmartStyle(doc);
        ensureFilterStyle(doc);
        applyColorVariables(doc);
        
        if (mode === MODES.OFF) {
          doc.documentElement.removeAttribute('data-dmt-mode');
        } else {
          doc.documentElement.setAttribute('data-dmt-mode', mode);
        }
      } catch (_) {
        // cross-origin iframe, ignore
      }
    });
  }

  // shadow DOM support
  function patchAttachShadow() {
    if (state.attachShadowPatched || !Element.prototype.attachShadow) return;
    
    const original = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(init) {
      const shadowRoot = original.call(this, init);
      queueMicrotask(() => syncShadowRoot(shadowRoot));
      return shadowRoot;
    };
    
    state.attachShadowPatched = true;
  }

  function syncShadowRoot(shadowRoot) {
    if (!shadowRoot || state.shadowStyles.has(shadowRoot)) return;
    
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    shadowRoot.appendChild(style);
    state.shadowStyles.set(shadowRoot, style);
  }

  function scanExistingShadowRoots() {
    if (!document.body) return;
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT
    );
    
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.shadowRoot) {
        syncShadowRoot(node.shadowRoot);
      }
    }
  }

  // mutation observer for native dark mode detection
  function setupMutationObserver() {
    if (state.mutationObserver) return;
    
    const observer = new MutationObserver(debounce(() => {
      if (!state.settings?.respectNativeDark) return;
      if (state.settings.siteOverrides?.[state.host]) return;
      
      // only check if we're not currently applying dark mode
      if (document.documentElement.hasAttribute('data-dmt-mode')) {
        return;
      }
      
      const detected = detectExistingDarkMode();
      if (detected !== state.autoDisabled) {
        state.autoDisabled = detected;
        evaluateAndApplyMode();
      }
    }, 600));
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
      childList: true,
      subtree: true
    });
    
    state.mutationObserver = observer;
  }

  // hotkey handling
  function updateHotkeyBinding() {
    if (state.hotkeyHandler) {
      document.removeEventListener('keydown', state.hotkeyHandler, true);
    }
    
    state.hotkeyHandler = event => {
      if (!state.settings?.hotkey) return;
      if (matchesHotkey(event, state.settings.hotkey)) {
        event.preventDefault();
        toggleGlobal();
      }
    };
    
    document.addEventListener('keydown', state.hotkeyHandler, true);
  }

  function matchesHotkey(event, definition) {
    const parsed = parseShortcut(definition);
    if (!parsed || event.repeat) return false;
    
    const target = event.target;
    const tag = target?.tagName;
    
    // ignore in inputs unless modifier is pressed
    if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
      if (!event.ctrlKey && !event.metaKey && parsed.key.length === 1) {
        return false;
      }
    }
    
    if (target instanceof Element && target.isContentEditable && !event.ctrlKey && !event.metaKey) {
      return false;
    }
    
    const key = event.key.toLowerCase();
    return key === parsed.key &&
      event.ctrlKey === parsed.ctrl &&
      event.shiftKey === parsed.shift &&
      event.altKey === parsed.alt &&
      event.metaKey === parsed.meta;
  }

  function parseShortcut(value) {
    if (!value) return null;
    const parts = value.toLowerCase().split('+').map(part => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    
    const key = parts.pop();
    const mod = { ctrl: false, alt: false, shift: false, meta: false };
    
    parts.forEach(part => {
      if (part === 'ctrl' || part === 'control') mod.ctrl = true;
      if (part === 'alt' || part === 'option') mod.alt = true;
      if (part === 'shift') mod.shift = true;
      if (part === 'meta' || part === 'cmd' || part === 'command') mod.meta = true;
    });
    
    return { key, ...mod };
  }

  // main mode evaluation
  function evaluateAndApplyMode() {
    if (!state.settings) {
      console.debug('[dark-mode-toggle] evaluateAndApplyMode: no settings');
      return;
    }
    const resolved = resolveMode();
    console.debug('[dark-mode-toggle] evaluateAndApplyMode:', {
      resolved: resolved.mode,
      enabled: state.settings.enabled,
      defaultMode: state.settings.defaultMode,
      autoDisabled: state.autoDisabled,
      host: state.host,
      override: state.settings.siteOverrides?.[state.host]
    });
    applyMode(resolved.mode);
  }

  // toggle functions
  async function toggleGlobal(forceValue) {
    if (!state.settings) return;
    
    const next = typeof forceValue === 'boolean' ? forceValue : !state.settings.enabled;
    state.settings.enabled = next;
    await Settings.save();
    
    evaluateAndApplyMode();
    QoL.ui.Toast.show(next ? 'Dark mode enabled' : 'Dark mode disabled');
  }

  async function cycleMode() {
    if (!state.settings) return;
    
    const current = state.currentMode;
    const idx = Math.max(0, MODE_SEQUENCE.indexOf(current));
    const next = MODE_SEQUENCE[(idx + 1) % MODE_SEQUENCE.length];
    
    const host = state.host;
    if (next === state.settings.defaultMode) {
      // remove override if matches default
      delete state.settings.siteOverrides[host];
    } else {
      // set override
      state.settings.siteOverrides[host] = { mode: next, reason: 'toolbar cycle' };
    }
    
    await Settings.save();
    state.autoDisabled = false;
    evaluateAndApplyMode();
    
    QoL.ui.Toast.show(`Mode: ${formatModeLabel(next)}`);
  }

  function formatModeLabel(mode) {
    switch (mode) {
      case MODES.FILTER: return 'Filter';
      case MODES.OFF: return 'Off';
      default: return 'Smart';
    }
  }

  // per-site override management
  async function addSiteOverride(host, mode, reason = '') {
    if (!state.settings) Settings.load();
    if (!host) host = state.host;
    
    host = normalizeHost(host);
    if (!isValidMode(mode)) {
      QoL.ui.Toast.show('Invalid mode');
      return false;
    }
    
    state.settings.siteOverrides[host] = { mode, reason };
    await Settings.save();
    evaluateAndApplyMode();
    
    QoL.ui.Toast.show(`Override set for ${host}: ${formatModeLabel(mode)}`);
    return true;
  }

  async function removeSiteOverride(host) {
    if (!state.settings) Settings.load();
    if (!host) host = state.host;
    
    host = normalizeHost(host);
    if (state.settings.siteOverrides[host]) {
      delete state.settings.siteOverrides[host];
      await Settings.save();
      evaluateAndApplyMode();
      QoL.ui.Toast.show(`Override removed for ${host}`);
      return true;
    }
    return false;
  }

  function getSiteOverrides() {
    if (!state.settings) Settings.load();
    return { ...state.settings.siteOverrides };
  }

  function getCurrentSiteOverride() {
    return getSiteOverride(state.host);
  }

  // override management UI (simple prompt-based for now)
  function openOverrideManager() {
    const overrides = getSiteOverrides();
    const entries = Object.entries(overrides);
    
    let message = 'Per-site Overrides:\n\n';
    if (entries.length === 0) {
      message += 'No overrides set.\n\n';
    } else {
      entries.forEach(([host, config]) => {
        message += `${host}: ${formatModeLabel(config.mode)}`;
        if (config.reason) message += ` (${config.reason})`;
        message += '\n';
      });
      message += '\n';
    }
    
    message += `Current site: ${state.host}\n`;
    message += `Current mode: ${formatModeLabel(state.currentMode)}\n\n`;
    message += 'Commands:\n';
    message += '- Add override: addOverride("example.com", "smart")\n';
    message += '- Remove override: removeOverride("example.com")\n';
    message += '- Remove current: removeOverride()\n';
    message += '\nOr use menu commands.';
    
    // show in console and toast
    console.log(message);
    QoL.ui.Toast.show('Override info logged to console');
  }

  // expose override functions globally for easy access
  window.dmtOverrides = {
    add: addSiteOverride,
    remove: removeSiteOverride,
    list: getSiteOverrides,
    current: getCurrentSiteOverride,
    manager: openOverrideManager
  };

  // menu commands
  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    
    try {
      GM_registerMenuCommand('Dark Mode: Toggle', () => toggleGlobal());
      GM_registerMenuCommand('Dark Mode: Cycle Mode', () => cycleMode());
      GM_registerMenuCommand('Dark Mode: Settings', () => QoL.ui.Modal.open(SCRIPT_ID));
      GM_registerMenuCommand('Dark Mode: Override Manager', () => openOverrideManager());
      GM_registerMenuCommand('Dark Mode: Set Override (Smart)', () => addSiteOverride(null, MODES.SMART, 'menu'));
      GM_registerMenuCommand('Dark Mode: Set Override (Filter)', () => addSiteOverride(null, MODES.FILTER, 'menu'));
      GM_registerMenuCommand('Dark Mode: Set Override (Off)', () => addSiteOverride(null, MODES.OFF, 'menu'));
      GM_registerMenuCommand('Dark Mode: Remove Override', () => removeSiteOverride(null));
    } catch (err) {
      console.warn('[dark-mode-toggle] menu registration failed', err);
    }
  }

  // utility functions
  function debounce(fn, wait = 150) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function normalizeHost(value) {
    if (!value) return '';
    return value.replace(/^www\./i, '').toLowerCase();
  }

  function sanitizeColor(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed;
    return fallback;
  }

  // init
  function init() {
    console.debug('[dark-mode-toggle] init: starting initialization');
    Settings.load();
    console.debug('[dark-mode-toggle] init: settings loaded', {
      enabled: state.settings?.enabled,
      defaultMode: state.settings?.defaultMode,
      respectNativeDark: state.settings?.respectNativeDark,
      host: state.host
    });
    
    applyColorVariables();
    patchAttachShadow();
    ensureSmartStyle();
    ensureFilterStyle();
    evaluateAndApplyMode();
    setupMutationObserver();
    updateHotkeyBinding();
    registerMenuCommands();
    
    ready(() => {
      console.debug('[dark-mode-toggle] init: DOM ready');
      scanExistingShadowRoots();
      evaluateAndApplyMode();
    });
    
    console.debug('[dark-mode-toggle] init: initialization complete');
    return state;
  }

  // cleanup
  function destroy(instance) {
    if (state.hotkeyHandler) {
      document.removeEventListener('keydown', state.hotkeyHandler, true);
      state.hotkeyHandler = null;
    }
    
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }
    
    document.documentElement.removeAttribute('data-dmt-mode');
  }

  // register with framework
  QoL.registerScript({
    id: SCRIPT_ID,
    name: 'Dark Mode Toggle',
    description: 'Hybrid dark mode with smart CSS injection and filter fallback',
    version: '1.0.0',
    enabled: true,
    
    settings: {
      enabled: { 
        type: 'toggle', 
        default: true, 
        label: 'Enable dark mode' 
      },
      defaultMode: { 
        type: 'select', 
        options: [
          { value: 'smart', label: 'Smart (CSS)' },
          { value: 'filter', label: 'Filter' },
          { value: 'off', label: 'Disabled' }
        ], 
        default: MODES.SMART,
        label: 'Default mode'
      },
      hotkey: { 
        type: 'text', 
        default: 'Ctrl+D', 
        label: 'Toggle hotkey',
        placeholder: 'Ctrl+D'
      },
      colorBackground: { 
        type: 'color', 
        default: '#0b1220', 
        label: 'Background color' 
      },
      colorText: { 
        type: 'color', 
        default: '#e5e7eb', 
        label: 'Text color' 
      },
      colorAccent: { 
        type: 'color', 
        default: '#6366f1', 
        label: 'Accent color' 
      },
      respectNativeDark: { 
        type: 'toggle', 
        default: true, 
        label: 'Auto-disable on sites with native dark mode' 
      },
      excludePatterns: { 
        type: 'textarea', 
        default: '', 
        label: 'Exclusion patterns (regex, one per line)',
        placeholder: '^https://mail\\.example\\.com'
      }
    },
    
    getSetting(key) {
      if (!state.settings) Settings.load();
      
      if (key === 'enabled') return state.settings?.enabled ?? true;
      if (key === 'defaultMode') return state.settings?.defaultMode ?? MODES.SMART;
      if (key === 'hotkey') return state.settings?.hotkey ?? 'Ctrl+D';
      if (key === 'colorBackground') return state.settings?.colors?.background ?? '#0b1220';
      if (key === 'colorText') return state.settings?.colors?.text ?? '#e5e7eb';
      if (key === 'colorAccent') return state.settings?.colors?.accent ?? '#6366f1';
      if (key === 'respectNativeDark') return state.settings?.respectNativeDark ?? true;
      if (key === 'excludePatterns') {
        return (state.settings?.excludePatterns || []).join('\n');
      }
      
      return undefined;
    },
    
    setSetting(key, value) {
      if (!state.settings) Settings.load();
      
      if (key === 'enabled') {
        state.settings.enabled = value;
        evaluateAndApplyMode();
      } else if (key === 'defaultMode') {
        state.settings.defaultMode = value;
        evaluateAndApplyMode();
      } else if (key === 'hotkey') {
        state.settings.hotkey = value;
        updateHotkeyBinding();
      } else if (key === 'colorBackground') {
        state.settings.colors.background = sanitizeColor(value, DEFAULTS.colors.background);
        state.settings.colors.surface = deriveSurfaceColor(state.settings.colors.background);
        applyColorVariables();
        evaluateAndApplyMode();
      } else if (key === 'colorText') {
        state.settings.colors.text = sanitizeColor(value, DEFAULTS.colors.text);
        applyColorVariables();
        evaluateAndApplyMode();
      } else if (key === 'colorAccent') {
        state.settings.colors.accent = sanitizeColor(value, DEFAULTS.colors.accent);
        applyColorVariables();
        evaluateAndApplyMode();
      } else if (key === 'respectNativeDark') {
        state.settings.respectNativeDark = value;
        evaluateAndApplyMode();
      } else if (key === 'excludePatterns') {
        state.settings.excludePatterns = value.split('\n')
          .map(line => line.trim())
          .filter(Boolean);
        evaluateAndApplyMode();
      }
      
      Settings.save();
    },
    
    setSettings(newSettings) {
      for (const [key, value] of Object.entries(newSettings)) {
        this.setSetting(key, value);
      }
    },
    
    init,
    destroy,
    
    onToggle(enabled) {
      state.settings.enabled = enabled;
      Settings.save();
      evaluateAndApplyMode();
    }
  });
  
  } // end initScript
})();
