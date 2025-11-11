// ==UserScript==
// @name         Markdown Selector+Readability (with UI)
// @namespace    md-selector
// @version      0.4.0
// @description  Select DOM, navigate with arrows, convert to Markdown (Turndown+GFM), Readability mode, floating toolbar + settings.
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      tampermonkey.net
// @require      https://cdn.jsdelivr.net/gh/pc-style/qol@main/dist/qol-framework.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/pc-style/qol@main/scripts/markdown-converter.user.js
// @downloadURL  https://cdn.jsdelivr.net/gh/pc-style/qol@main/scripts/markdown-converter.user.js
// ==/UserScript==


(function() {
    'use strict';

    // wait for QoL framework
    if (typeof QoL === 'undefined') {
      console.error('[markdown-converter] QoL framework not loaded');
      return;
    }

    const SCRIPT_ID = 'markdown-converter';
  
    const DEFAULTS = {
      hotkeyToggle: 'Alt+M',
      useGFM: true,
      includeReadability: true,
      showToolbar: false,
      highlightColor: '#6366f1'
    };
  
    const state = {
      active: false,
      current: null,
      settings: null,
      turndown: null,
      turndownGfm: null,
      readability: null
    };
  
    const ids = {
      overlay: 'mdsel-overlay',
      tooltip: 'mdsel-tooltip',
      toolbar: 'mdsel-toolbar',
      settings: 'mdsel-settings',
      mask: 'mdsel-mask'
    };
  
    // Load settings using QoL.store
    const Settings = {
      load() {
        const stored = QoL.store.getAll(SCRIPT_ID);
        state.settings = {
          hotkeyToggle: QoL.store.get(SCRIPT_ID, 'hotkeyToggle', DEFAULTS.hotkeyToggle),
          useGFM: QoL.store.get(SCRIPT_ID, 'useGFM', DEFAULTS.useGFM),
          includeReadability: QoL.store.get(SCRIPT_ID, 'includeReadability', DEFAULTS.includeReadability),
          showToolbar: QoL.store.get(SCRIPT_ID, 'showToolbar', DEFAULTS.showToolbar),
          highlightColor: QoL.store.get(SCRIPT_ID, 'highlightColor', DEFAULTS.highlightColor)
        };
        applyTheme();
        ensureUI();
        registerMenu();
      },
      save() {
        for (const [key, value] of Object.entries(state.settings)) {
          QoL.store.set(SCRIPT_ID, key, value);
        }
        applyTheme();
        QoL.ui.Toast.show('Settings saved');
      },
    };
  
    function applyTheme() {
      const color = state.settings?.highlightColor || DEFAULTS.highlightColor;
      document.documentElement.style.setProperty('--mdsel-color', color);
    }
  
    // Create Overlay + UI roots
    const overlay = document.createElement('div');
    overlay.id = ids.overlay;
    const tooltip = document.createElement('div');
    tooltip.id = ids.tooltip;
    overlay.appendChild(tooltip);
    document.documentElement.appendChild(overlay);
  
    // Toolbar + Settings Modal containers
    let toolbar, settingsModal, settingsMask;
  
    function ensureUI() {
      if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = ids.toolbar;
        toolbar.innerHTML = `
          <button data-act="toggle" title="Toggle selection (Alt+M)">Select</button>
          <button data-act="copy" title="Copy selection to Markdown (Click)">Copy MD</button>
          <button data-act="readability" title="Readability → Markdown (R)">Readability</button>
          <button data-act="settings" title="Settings">⚙</button>
        `;
        document.body.appendChild(toolbar);
        toolbar.addEventListener('click', onToolbarClick);
        updateToolbarVisibility();
        updateReadabilityButton();
      }
      if (!settingsModal) {
        settingsMask = document.createElement('div');
        settingsMask.id = ids.mask;
        settingsMask.addEventListener('click', closeSettings);
  
        settingsModal = document.createElement('div');
        settingsModal.id = ids.settings;
        settingsModal.innerHTML = buildSettingsHTML();
        document.body.appendChild(settingsMask);
        document.body.appendChild(settingsModal);
  
        settingsModal.querySelector('form').addEventListener('submit', onSettingsSubmit);
        settingsModal.querySelector('[data-close]').addEventListener('click', closeSettings);
      }
      hydrateSettingsForm();
    }
  
    function updateToolbarVisibility() {
      if (!toolbar) return;
      toolbar.style.display = state.settings?.showToolbar ? 'flex' : 'none';
    }
  
    function updateReadabilityButton() {
      if (!toolbar) return;
      const btn = toolbar.querySelector('button[data-act="readability"]');
      if (btn) btn.style.display = state.settings?.includeReadability ? '' : 'none';
    }
  
    function buildSettingsHTML() {
      return `
        <div class="header">
          <div class="title">Markdown Selector Settings</div>
          <button type="button" class="close" data-close aria-label="Close">✕</button>
        </div>
        <form>
          <div class="field">
            <label for="hotkeyToggle">Toggle Hotkey</label>
            <input id="hotkeyToggle" name="hotkeyToggle" type="text" placeholder="Alt+M" />
            <small>Format examples: "Alt+M", "Ctrl+Shift+X". Case-insensitive.</small>
          </div>
          <div class="field">
            <label for="highlightColor">Highlight Color</label>
            <input id="highlightColor" name="highlightColor" type="color" />
          </div>
          <div class="field row">
            <label><input id="useGFM" name="useGFM" type="checkbox" /> Use GitHub Flavored Markdown</label>
          </div>
          <div class="field row">
            <label><input id="includeReadability" name="includeReadability" type="checkbox" /> Show Readability button</label>
          </div>
          <div class="field row">
            <label><input id="showToolbar" name="showToolbar" type="checkbox" /> Show floating toolbar</label>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Save</button>
            <button type="button" data-close>Cancel</button>
          </div>
        </form>
      `;
    }
  
    function hydrateSettingsForm() {
      if (!settingsModal) return;
      settingsModal.querySelector('#hotkeyToggle').value = state.settings.hotkeyToggle;
      settingsModal.querySelector('#highlightColor').value = toColorInput(state.settings.highlightColor);
      settingsModal.querySelector('#useGFM').checked = !!state.settings.useGFM;
      settingsModal.querySelector('#includeReadability').checked = !!state.settings.includeReadability;
      settingsModal.querySelector('#showToolbar').checked = !!state.settings.showToolbar;
    }
  
    function toColorInput(val) {
      // Accept #RRGGBB or CSS named colors; simplest: pass through
      return val || '#6366f1';
    }
  
    function openSettings() {
      ensureUI();
      hydrateSettingsForm();
      settingsMask.classList.add('show');
      settingsModal.classList.add('show');
    }
  
    function closeSettings() {
      settingsMask.classList.remove('show');
      settingsModal.classList.remove('show');
    }
  
    async function onSettingsSubmit(e) {
      e.preventDefault();
      const f = e.target;
      state.settings.hotkeyToggle = (f.hotkeyToggle.value || DEFAULTS.hotkeyToggle).trim();
      state.settings.highlightColor = f.highlightColor.value || DEFAULTS.highlightColor;
      state.settings.useGFM = !!f.useGFM.checked;
      state.settings.includeReadability = !!f.includeReadability.checked;
      state.settings.showToolbar = !!f.showToolbar.checked;
      await Settings.save();
      updateToolbarVisibility();
      updateReadabilityButton();
      closeSettings();
    }
  
    function parseHotkey(str) {
      // Returns {ctrl,alt,shift,meta,key}
      const parts = (str || '').toLowerCase().split('+').map(s => s.trim());
      const mod = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
      for (const p of parts) {
        if (p === 'ctrl' || p === 'control') mod.ctrl = true;
        else if (p === 'alt' || p === 'option') mod.alt = true;
        else if (p === 'shift') mod.shift = true;
        else if (p === 'meta' || p === 'cmd' || p === 'command') mod.meta = true;
        else mod.key = p;
      }
      return mod;
    }
  
    function hotkeyMatches(e, hotkeyStr) {
      const h = parseHotkey(hotkeyStr);
      const k = (e.key || '').toLowerCase();
      // Normalize letters to lowercase single char
      const hk = (h.key || '').toLowerCase();
      return !!(
        (!!e.ctrlKey) === h.ctrl &&
        (!!e.altKey) === h.alt &&
        (!!e.shiftKey) === h.shift &&
        (!!e.metaKey) === h.meta &&
        // Accept both literal key name or single char
        (hk === k || (hk.length === 1 && hk === k))
      );
    }
  
    // Styles
    GM_addStyle(`
      :root { --mdsel-color: ${DEFAULTS.highlightColor}; }
      #${ids.overlay} {
        position: absolute;
        pointer-events: none;
        z-index: 2147483647;
        border: 2px solid color-mix(in oklab, var(--mdsel-color) 85%, white);
        border-radius: 6px;
        box-shadow: 0 0 0 2px color-mix(in oklab, var(--mdsel-color) 30%, transparent),
                    0 10px 30px rgba(0,0,0,0.25);
        transition: all 120ms cubic-bezier(.2,.7,.2,1);
        opacity: 0;
      }
      #${ids.tooltip} {
        position: absolute;
        top: -28px;
        left: 0;
        transform: translateY(-4px);
        background: rgba(17,24,39,0.96);
        color: #e5e7eb;
        font: 12px/1.2 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji;
        padding: 6px 8px;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
        white-space: nowrap;
        pointer-events: none;
      }
      .mdsel-toast {
        position: fixed;
        bottom: 18px;
        right: 18px;
        background: rgba(17,24,39,0.98);
        color: #e5e7eb;
        border: 1px solid color-mix(in oklab, var(--mdsel-color) 40%, transparent);
        padding: 10px 12px;
        border-radius: 10px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.35);
        z-index: 2147483647;
        font: 13px/1.3 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji;
        opacity: 0;
        transform: translateY(8px);
        transition: all 150ms ease;
        max-width: min(520px, 80vw);
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mdsel-toast.show { opacity: 1; transform: translateY(0); }
  
      #${ids.toolbar} {
        position: fixed;
        bottom: 16px;
        left: 16px;
        display: flex;
        gap: 8px;
        padding: 8px;
        background: rgba(17,24,39,0.9);
        border: 1px solid color-mix(in oklab, var(--mdsel-color) 30%, transparent);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        z-index: 2147483647;
        backdrop-filter: blur(6px);
      }
      #${ids.toolbar} button {
        appearance: none;
        border: 1px solid rgba(148,163,184,0.25);
        background: rgba(31,41,55,0.85);
        color: #e5e7eb;
        border-radius: 8px;
        padding: 6px 10px;
        font: 12px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        cursor: pointer;
        transition: border-color .15s ease, background .15s ease, transform .05s ease;
      }
      #${ids.toolbar} button:hover { border-color: color-mix(in oklab, var(--mdsel-color) 45%, transparent); }
      #${ids.toolbar} button:active { transform: translateY(1px); }
  
      #${ids.mask} {
        position: fixed; inset: 0; background: rgba(0,0,0,0.35);
        opacity: 0; pointer-events: none; transition: opacity .15s ease;
        z-index: 2147483646;
      }
      #${ids.mask}.show { opacity: 1; pointer-events: auto; }
  
      #${ids.settings} {
        position: fixed; inset: auto; left: 50%; top: 12%;
        transform: translateX(-50%) translateY(-6px);
        width: min(520px, 92vw);
        background: #0b1220;
        color: #e5e7eb;
        border-radius: 12px;
        border: 1px solid color-mix(in oklab, var(--mdsel-color) 35%, transparent);
        box-shadow: 0 30px 80px rgba(0,0,0,0.5);
        padding: 12px 12px 10px;
        z-index: 2147483647;
        opacity: 0; pointer-events: none; transition: all .15s ease;
      }
      #${ids.settings}.show { opacity: 1; transform: translateX(-50%) translateY(0); pointer-events: auto; }
      #${ids.settings} .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
      #${ids.settings} .title { font-weight: 600; }
      #${ids.settings} .close { background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; }
      #${ids.settings} form { display: grid; gap: 10px; }
      #${ids.settings} .field { display: grid; gap: 6px; }
      #${ids.settings} .field.row { grid-auto-flow: column; justify-content: start; align-items: center; gap: 10px; }
      #${ids.settings} label { font-size: 13px; color: #cbd5e1; }
      #${ids.settings} input[type="text"] {
        background: rgba(2,6,23,0.65); color: #e5e7eb; border: 1px solid rgba(148,163,184,0.25);
        border-radius: 8px; padding: 8px 10px; font: 13px/1.2 ui-sans-serif, system-ui;
      }
      #${ids.settings} input[type="color"] {
        width: 44px; height: 28px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.25);
        background: rgba(2,6,23,0.65); padding: 0;
      }
      #${ids.settings} small { color: #94a3b8; }
      #${ids.settings} .actions { display: flex; gap: 8px; justify-content: end; margin-top: 2px; }
      #${ids.settings} .actions .primary {
        background: color-mix(in oklab, var(--mdsel-color) 35%, #1f2937);
        border: 1px solid color-mix(in oklab, var(--mdsel-color) 35%, transparent);
        color: white; border-radius: 8px; padding: 8px 12px; cursor: pointer;
      }
      #${ids.settings} .actions button {
        background: rgba(31,41,55,0.85); border: 1px solid rgba(148,163,184,0.25);
        color: #e5e7eb; border-radius: 8px; padding: 8px 12px; cursor: pointer;
      }
    `);
  
    function registerMenu() {
      GM_registerMenuCommand('Toggle Selection', () => toggle());
      GM_registerMenuCommand('Copy Selection as Markdown', () => convertSelectionToMarkdown(state.current).catch(console.error));
      GM_registerMenuCommand('Readability → Markdown', () => state.settings.includeReadability && convertReadabilityToMarkdown().catch(console.error));
      GM_registerMenuCommand('Open Settings', () => openSettings());
    }
  
    function showToast(text) {
      QoL.ui.Toast.show(text);
    }
  
    function isVisible(el) {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
  
    function updateOverlay(el) {
      if (!state.active || !el || !isVisible(el)) {
        overlay.style.opacity = '0';
        return;
      }
      const r = el.getBoundingClientRect();
      overlay.style.opacity = '1';
      overlay.style.left = `${Math.max(0, r.left + window.scrollX) - 3}px`;
      overlay.style.top = `${Math.max(0, r.top + window.scrollY) - 3}px`;
      overlay.style.width = `${r.width + 6}px`;
      overlay.style.height = `${r.height + 6}px`;
      tooltip.textContent = formatLabel(el);
      tooltip.style.left = '0';
      tooltip.style.top = '-28px';
    }
  
    function formatLabel(el) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).slice(0,3).join('.') : '';
      const children = el.children ? el.children.length : 0;
      const r = el.getBoundingClientRect();
      const dims = `${Math.round(r.width)}×${Math.round(r.height)}`;
      return `${tag}${id}${cls}  ·  ${children} children  ·  ${dims}`;
    }
  
    function setCurrent(el, scroll = true) {
      if (!el || !(el instanceof Element)) return;
      state.current = el;
      if (scroll) el.scrollIntoView({ block: 'nearest' });
      updateOverlay(el);
    }
  
    function firstVisibleChild(el) {
      if (!el) return null;
      for (const c of el.children) {
        if (isVisible(c)) return c;
      }
      return null;
    }
  
    function nextVisibleSibling(el, dir = 1) {
      if (!el) return null;
      let sib = el;
      while (sib) {
        sib = (dir > 0) ? sib.nextElementSibling : sib.previousElementSibling;
        if (sib && isVisible(sib)) return sib;
      }
      return null;
    }
  
    function activate() {
      if (state.active) return;
      state.active = true;
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('scroll', onScroll, true);
      // Initialize with element near center
      const el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
      setCurrent(findSelectable(el) || document.body, false);
      showToast('Selector ON (Click to copy · Arrows navigate · R readability · Esc exit)');
    }
  
    function deactivate() {
      state.active = false;
      state.current = null;
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('scroll', onScroll, true);
      overlay.style.opacity = '0';
      showToast('Selector OFF');
    }
  
    function toggle() { state.active ? deactivate() : activate(); }
  
    function findSelectable(el) {
      let cur = el;
      while (cur && !(cur instanceof Element)) cur = cur.parentElement;
      if (!cur) return null;
      if (cur.tagName && cur.tagName.toLowerCase() === 'html') return document.body;
      return cur;
    }
  
    function onMouseMove(e) {
      if (!state.active) return;
      const el = findSelectable(e.target);
      if (el && el !== state.current) {
        setCurrent(el, false);
      }
    }
  
    function onScroll() {
      if (state.active && state.current) {
        updateOverlay(state.current);
        // Refresh current element under mouse after scroll
        requestAnimationFrame(() => {
          if (state.active) {
            const el = document.elementFromPoint(window.innerWidth/2, window.innerHeight/2);
            const selectable = findSelectable(el);
            if (selectable && selectable !== state.current) {
              setCurrent(selectable, false);
            }
          }
        });
      }
    }
  
    function onClick(e) {
      if (!state.active) return;
      e.preventDefault();
      e.stopPropagation();
      // Copy current selection and close
      convertSelectionToMarkdown(state.current).then(() => deactivate()).catch(console.error);
    }
  
    function onKeyDown(e) {
      if (!state.active) {
        // Global hotkey to toggle
        if (hotkeyMatches(e, state.settings.hotkeyToggle)) {
          e.preventDefault();
          toggle();
        }
        return;
      }
  
      const keys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape','R','r'];
      if (keys.includes(e.key)) e.preventDefault();
  
      const cur = state.current;
  
      switch (e.key) {
        case 'ArrowUp': {
          const parent = cur?.parentElement;
          if (parent && parent.tagName.toLowerCase() !== 'html') setCurrent(parent);
          break;
        }
        case 'ArrowDown': {
          const child = firstVisibleChild(cur);
          if (child) setCurrent(child);
          break;
        }
        case 'ArrowLeft': {
          const prev = nextVisibleSibling(cur, -1);
          if (prev) setCurrent(prev);
          break;
        }
        case 'ArrowRight': {
          const next = nextVisibleSibling(cur, +1);
          if (next) setCurrent(next);
          break;
        }
        case 'r':
        case 'R': {
          if (state.settings.includeReadability) {
            convertReadabilityToMarkdown().then(() => deactivate()).catch(console.error);
          }
          break;
        }
        case 'Escape': {
          deactivate();
          break;
        }
      }
    }
  
    async function getTurndown() {
      // load dependencies via QoL.deps
      if (!state.turndown) {
        const TurndownService = await QoL.deps.load('turndown');
        state.turndown = TurndownService;
      }
      
      if (state.settings.useGFM && !state.turndownGfm) {
        const turndownPluginGfm = await QoL.deps.load('turndown-gfm');
        state.turndownGfm = turndownPluginGfm;
      }
      
      const td = new state.turndown({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined',
        hr: '---'
      });
      if (state.settings.useGFM && state.turndownGfm) {
        td.use(state.turndownGfm.gfm);
      }
      td.keep(['ins', 'mark']);
      td.remove(['script','style','noscript','svg','canvas']);
      return td;
    }
  
    async function convertSelectionToMarkdown(el) {
      if (!el) {
        showToast('No element selected');
        return;
      }
      const clone = el.cloneNode(true);
      cleanClone(clone);
      const td = await getTurndown();
      const md = td.turndown(clone);
      console.log('Generated Markdown (selection):', md);
      copyMarkdown(md, 'Copied selection as Markdown');
    }
  
    async function convertReadabilityToMarkdown() {
      try {
        // load Readability via QoL.deps
        if (!state.readability) {
          const Readability = await QoL.deps.load('readability');
          state.readability = Readability;
        }
        
        const docClone = document.cloneNode(true);
        const reader = new state.readability(docClone);
        const article = reader.parse();
        if (!article || !article.content) {
          showToast('Readability: no article content found');
          return;
        }
        const container = document.createElement('div');
        container.innerHTML = article.content;
        cleanClone(container);
        const td = await getTurndown();
        let md = '';
        if (article.title) md += `# ${article.title}\n\n`;
        if (article.byline) md += `by ${article.byline}\n\n`;
        if (article.excerpt) md += `> ${article.excerpt}\n\n`;
        md += td.turndown(container);
        console.log('Generated Markdown (Readability):', md);
        copyMarkdown(md, 'Copied Readability article as Markdown');
      } catch (err) {
        console.error(err);
        showToast('Readability failed');
      }
    }
  
    function cleanClone(root) {
      const removeSel = [
        'script','style','noscript','iframe','canvas','svg',
        'button','input','select','textarea'
      ];
      root.querySelectorAll(removeSel.join(',')).forEach(n => n.remove());
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
      while (walker.nextNode()) {
        const el = walker.currentNode;
        [...el.attributes].forEach(attr => {
          if (/^on|^data-/i.test(attr.name)) el.removeAttribute(attr.name);
        });
      }
    }
  
    function copyMarkdown(md, okMsg) {
      if (!md || !md.trim()) {
        showToast('Nothing to copy');
        return;
      }
  
      // Always try all methods, show modal as last resort
      let copied = false;
  
      try {
        // Try Tampermonkey API first
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(md, 'text');
          showToast(okMsg);
          return;
        }
      } catch (e) {
        console.error('GM_setClipboard failed:', e);
      }
  
      // Try navigator.clipboard (async)
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(md).then(() => {
          showToast(okMsg);
          copied = true;
        }).catch((err) => {
          console.error('navigator.clipboard failed:', err);
          // Try execCommand fallback
          if (!tryExecCommandCopy(md)) {
            showMarkdownModal(md);
          } else {
            showToast(okMsg);
          }
        });
        return;
      }
  
      // Try execCommand
      if (tryExecCommandCopy(md)) {
        showToast(okMsg);
        return;
      }
  
      // Last resort: show modal
      showMarkdownModal(md);
    }
  
    function tryExecCommandCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const success = document.execCommand('copy');
        ta.remove();
        return success;
      } catch (e) {
        console.error('execCommand failed:', e);
        return false;
      }
    }
  
    function showMarkdownModal(md) {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed; inset: 0; z-index: 2147483647;
        background: rgba(0,0,0,0.5); display: flex;
        align-items: center; justify-content: center;
      `;
      const box = document.createElement('div');
      box.style.cssText = `
        background: #1f2937; color: #e5e7eb; padding: 1.5em;
        border-radius: 12px; max-width: 90vw; max-height: 80vh;
        display: flex; flex-direction: column; gap: 1em;
      `;
      const title = document.createElement('div');
      title.textContent = 'Copy Markdown (clipboard failed)';
      title.style.cssText = 'font-weight: 600; font-size: 1.1em;';
      const ta = document.createElement('textarea');
      ta.value = md;
      ta.style.cssText = `
        width: 600px; max-width: 100%; height: 400px;
        background: #0b1220; color: #e5e7eb; border: 1px solid #374151;
        border-radius: 6px; padding: 0.75em; font-family: ui-monospace, monospace;
        font-size: 13px; resize: vertical;
      `;
      ta.readOnly = true;
      const btn = document.createElement('button');
      btn.textContent = 'Close';
      btn.style.cssText = `
        background: #374151; color: #e5e7eb; border: none;
        padding: 0.5em 1em; border-radius: 6px; cursor: pointer;
        align-self: flex-end;
      `;
      btn.onclick = () => modal.remove();
      box.append(title, ta, btn);
      modal.appendChild(box);
      document.body.appendChild(modal);
      ta.select();
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }
  
    function onToolbarClick(e) {
      const act = e.target?.getAttribute?.('data-act');
      if (!act) return;
      if (act === 'toggle') toggle();
      if (act === 'copy') convertSelectionToMarkdown(state.current).catch(console.error);
      if (act === 'readability' && state.settings.includeReadability) convertReadabilityToMarkdown().catch(console.error);
      if (act === 'settings') openSettings();
    }
  
    // Global hotkey: uses configurable settings
    window.addEventListener('keydown', (e) => {
      // Handled inside onKeyDown when active; here, just allow toggle when inactive
      if (!state.active && hotkeyMatches(e, state.settings?.hotkeyToggle || DEFAULTS.hotkeyToggle)) {
        e.preventDefault();
        toggle();
      }
    }, true);
  
    // register with QoL framework
    QoL.registerScript({
      id: SCRIPT_ID,
      name: 'Markdown Converter',
      description: 'Select DOM, navigate with arrows, convert to Markdown (Turndown+GFM), Readability mode',
      version: '0.4.0',
      enabled: true,
      
      settings: {
        hotkeyToggle: { type: 'text', default: 'Alt+M', label: 'Toggle Hotkey' },
        highlightColor: { type: 'color', default: '#6366f1', label: 'Highlight Color' },
        useGFM: { type: 'toggle', default: true, label: 'Use GitHub Flavored Markdown' },
        includeReadability: { type: 'toggle', default: true, label: 'Show Readability button' },
        showToolbar: { type: 'toggle', default: false, label: 'Show floating toolbar' }
      },
      
      getSetting(key) {
        return state.settings?.[key] ?? DEFAULTS[key];
      },
      
      setSetting(key, value) {
        if (!state.settings) state.settings = { ...DEFAULTS };
        state.settings[key] = value;
        Settings.save();
      },
      
      setSettings(newSettings) {
        if (!state.settings) state.settings = { ...DEFAULTS };
        for (const [key, value] of Object.entries(newSettings)) {
          state.settings[key] = value;
        }
        Settings.save();
      },
      
      init() {
        Settings.load();
        return state;
      },
      
      destroy(instance) {
        // cleanup
        if (state.active) {
          deactivate();
        }
        if (toolbar) {
          toolbar.remove();
          toolbar = null;
        }
        if (settingsModal) {
          settingsModal.remove();
          settingsModal = null;
        }
        if (settingsMask) {
          settingsMask.remove();
          settingsMask = null;
        }
        overlay.remove();
      }
    });
  })();
  