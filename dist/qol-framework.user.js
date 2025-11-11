// ==UserScript==
// @name         QoL Framework
// @namespace    qol-framework
// @version      1.0.1
// @description  Quality of Life userscript framework
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_listValues
// @grant        GM_deleteValue
// @updateURL    https://raw.githubusercontent.com/pc-style/qol/main/dist/qol-framework.user.js
// @downloadURL  https://raw.githubusercontent.com/pc-style/qol/main/dist/qol-framework.user.js
// @run-at       document-start
// ==/UserScript==


var QoLFramework = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var src_exports = {};
  __export(src_exports, {
    default: () => src_default
  });

  // src/core/store.js
  var Store = {
    // get value for a script's key
    get(scriptId, key, defaultValue) {
      const storageKey = `qol:${scriptId}:${key}`;
      const value = GM_getValue(storageKey, defaultValue);
      if (typeof value === "string" && (value.startsWith("{") || value.startsWith("["))) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    },
    // set value for a script's key
    set(scriptId, key, value) {
      const storageKey = `qol:${scriptId}:${key}`;
      const serialized = typeof value === "object" ? JSON.stringify(value) : value;
      GM_setValue(storageKey, serialized);
    },
    // get all settings for a script
    getAll(scriptId) {
      const prefix = `qol:${scriptId}:`;
      const all = GM_listValues();
      const scriptSettings = {};
      for (const key of all) {
        if (key.startsWith(prefix)) {
          const settingKey = key.slice(prefix.length);
          scriptSettings[settingKey] = this.get(scriptId, settingKey);
        }
      }
      return scriptSettings;
    },
    // remove a specific key
    remove(scriptId, key) {
      const storageKey = `qol:${scriptId}:${key}`;
      GM_deleteValue(storageKey);
    },
    // clear all settings for a script
    clear(scriptId) {
      const prefix = `qol:${scriptId}:`;
      const all = GM_listValues();
      for (const key of all) {
        if (key.startsWith(prefix)) {
          GM_deleteValue(key);
        }
      }
    }
  };

  // src/core/utils.js
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  // src/styles.js
  var STYLES = `
:root {
  --qol-bg: rgba(15, 23, 42, 0.9);
  --qol-bg-solid: #0f172a;
  --qol-bg-soft: rgba(15, 23, 42, 0.6);
  --qol-border: rgba(148, 163, 184, 0.35);
  --qol-border-soft: rgba(148, 163, 184, 0.25);
  --qol-text: #e5e7eb;
  --qol-text-soft: rgba(226, 232, 240, 0.75);
  --qol-accent: #6366f1;
  --qol-accent-soft: rgba(99, 102, 241, 0.35);
  --qol-radius-lg: 18px;
  --qol-radius-md: 14px;
  --qol-radius-sm: 10px;
  --qol-z: 2147483647;
}

[data-qol-ui] {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  color: var(--qol-text);
}

/* Toolbar */
#qol-toolbar {
  position: fixed;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--qol-bg);
  border: 1px solid var(--qol-border);
  border-radius: var(--qol-radius-md);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  z-index: var(--qol-z);
  color: inherit;
}

#qol-toolbar button {
  border: 1px solid rgba(148, 163, 184, 0.4);
  background: var(--qol-bg-soft);
  color: inherit;
  padding: 6px 10px;
  font-size: 12px;
  border-radius: var(--qol-radius-sm);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

#qol-toolbar button:hover {
  border-color: var(--qol-accent);
  background: rgba(15, 23, 42, 0.8);
}

#qol-toolbar button.qol-active {
  background: var(--qol-accent);
  border: none;
  color: #0f172a;
  font-weight: 600;
}

#qol-toolbar .qol-empty {
  padding: 4px;
  font-size: 11px;
  color: var(--qol-text-soft);
}

/* Modal */
#qol-mask {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.65);
  backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: calc(var(--qol-z) - 1);
}

#qol-mask.show {
  opacity: 1;
  pointer-events: auto;
}

#qol-modal {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(560px, calc(100% - 32px));
  max-height: min(90vh, 720px);
  background: var(--qol-bg-solid);
  border: 1px solid var(--qol-border);
  border-radius: var(--qol-radius-lg);
  box-shadow: 0 35px 90px rgba(15, 23, 42, 0.7);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: var(--qol-z);
}

#qol-modal.show {
  opacity: 1;
  transform: translateY(0);
}

.qol-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.qol-modal-header h2 {
  margin: 0;
  font-size: 20px;
}

.qol-modal-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--qol-text-soft);
}

.qol-close-btn {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 20px;
  cursor: pointer;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.qol-close-btn:hover {
  background: var(--qol-bg-soft);
}

.qol-modal-body {
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.qol-script-section {
  width: 100%;
}

.qol-script-section h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: var(--qol-accent);
}

.qol-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.qol-form-group label {
  font-size: 13px;
  color: var(--qol-text);
}

.qol-form-group input[type="text"],
.qol-form-group input[type="color"],
.qol-form-group select,
.qol-form-group textarea {
  width: 100%;
  border-radius: var(--qol-radius-sm);
  border: 1px solid var(--qol-border-soft);
  background: var(--qol-bg-soft);
  color: var(--qol-text);
  padding: 8px 10px;
  font-size: 13px;
}

.qol-form-group textarea {
  min-height: 80px;
  resize: vertical;
}

.qol-form-group.row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.qol-form-group.row input {
  width: auto;
}

.qol-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.qol-actions .primary {
  background: var(--qol-accent);
  border: none;
  color: #0f172a;
  font-weight: 600;
}

/* Toast */
#qol-toast {
  position: fixed;
  right: 20px;
  bottom: 20px;
  background: rgba(15, 23, 42, 0.95);
  border-radius: 12px;
  padding: 10px 16px;
  border: 1px solid var(--qol-border);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: var(--qol-z);
  pointer-events: none;
  max-width: min(400px, 80vw);
}

#qol-toast.show {
  opacity: 1;
  transform: translateY(0);
}

/* Ensure UI elements aren't affected by dark mode filters */
#qol-toolbar,
#qol-modal,
#qol-toast {
  filter: none !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

/* Command Palette */
#qol-command-palette {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(600px, calc(100% - 32px));
  max-height: min(500px, calc(100vh - 100px));
  background: var(--qol-bg-solid);
  border: 1px solid var(--qol-border);
  border-radius: var(--qol-radius-lg);
  box-shadow: 0 35px 90px rgba(15, 42, 70, 0.8);
  display: flex;
  flex-direction: column;
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: calc(var(--qol-z) + 1);
  pointer-events: none;
}

#qol-command-palette.show {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

#qol-command-palette-input {
  width: 100%;
  padding: 16px 20px;
  font-size: 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--qol-border-soft);
  color: var(--qol-text);
  outline: none;
  font-family: inherit;
}

#qol-command-palette-input::placeholder {
  color: var(--qol-text-soft);
}

#qol-command-palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: 400px;
}

.qol-command-category {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--qol-text-soft);
  margin-top: 8px;
}

.qol-command-category:first-child {
  margin-top: 0;
}

.qol-command-item {
  padding: 10px 12px;
  border-radius: var(--qol-radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.qol-command-item:hover,
.qol-command-item.selected {
  background: var(--qol-bg-soft);
}

.qol-command-item.selected {
  background: var(--qol-accent-soft);
}

.qol-command-label {
  color: var(--qol-text);
  font-size: 14px;
}

.qol-command-empty {
  padding: 24px;
  text-align: center;
  color: var(--qol-text-soft);
  font-size: 14px;
}

/* Ensure command palette isn't affected by dark mode filters */
#qol-command-palette {
  filter: none !important;
}
`;

  // src/core/ui.js
  var state = {
    toolbar: null,
    modal: null,
    mask: null,
    toast: null,
    toastTimer: null,
    scripts: /* @__PURE__ */ new Map(),
    // scriptId -> config
    currentScriptTab: null,
    commandPalette: null,
    commandPaletteInput: null,
    commandPaletteList: null,
    commandPaletteOpen: false,
    commandPaletteCommands: [],
    commandPaletteFiltered: [],
    commandPaletteSelected: 0
  };
  var styleInjected = false;
  function ensureStyles() {
    if (styleInjected)
      return;
    GM_addStyle(STYLES);
    styleInjected = true;
  }
  var Toolbar = {
    init() {
      ensureStyles();
      ready(() => {
        this.ensure();
        this.update();
      });
    },
    ensure() {
      if (state.toolbar || !document.body)
        return;
      const toolbar = document.createElement("div");
      toolbar.id = "qol-toolbar";
      toolbar.dataset.qolUi = "toolbar";
      document.body.appendChild(toolbar);
      state.toolbar = toolbar;
    },
    update() {
      if (!state.toolbar)
        return;
      const scripts2 = Array.from(state.scripts.values());
      if (scripts2.length === 0) {
        state.toolbar.innerHTML = '<div class="qol-empty">No scripts registered</div>';
        return;
      }
      const buttons = scripts2.map((script) => {
        const enabled = script.enabled !== false;
        return `
        <button 
          type="button" 
          class="${enabled ? "qol-active" : ""}" 
          data-script-id="${escapeHtml(script.id)}"
          title="${escapeHtml(script.name)}: ${escapeHtml(script.description || "")}"
        >
          ${escapeHtml(script.name)}
        </button>
      `;
      }).join("");
      const settingsBtn = '<button type="button" data-act="settings" title="Settings">\u2699</button>';
      state.toolbar.innerHTML = buttons + settingsBtn;
      state.toolbar.addEventListener("click", (e) => {
        const scriptBtn = e.target.closest("button[data-script-id]");
        const settingsBtn2 = e.target.closest('button[data-act="settings"]');
        if (scriptBtn) {
          const scriptId = scriptBtn.dataset.scriptId;
          const script = state.scripts.get(scriptId);
          if (script) {
            script.enabled = !script.enabled;
            script.onToggle?.(script.enabled);
            this.update();
          }
        } else if (settingsBtn2) {
          Modal.open();
        }
      });
    },
    registerScript(script) {
      state.scripts.set(script.id, script);
      this.update();
    },
    unregisterScript(scriptId) {
      state.scripts.delete(scriptId);
      this.update();
    }
  };
  var Modal = {
    init() {
      ensureStyles();
      ready(() => {
        this.ensure();
      });
    },
    ensure() {
      if (state.modal || !document.body)
        return;
      const mask = document.createElement("div");
      mask.id = "qol-mask";
      mask.dataset.qolUi = "mask";
      mask.addEventListener("click", () => this.close());
      const modal = document.createElement("div");
      modal.id = "qol-modal";
      modal.dataset.qolUi = "modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      document.body.appendChild(mask);
      document.body.appendChild(modal);
      state.mask = mask;
      state.modal = modal;
    },
    open(scriptId = null) {
      this.ensure();
      if (!state.modal)
        return;
      if (scriptId) {
        state.currentScriptTab = scriptId;
      } else {
        const scripts2 = Array.from(state.scripts.values());
        state.currentScriptTab = scripts2.length > 0 ? scripts2[0].id : null;
      }
      this.render();
      if (state.mask)
        state.mask.classList.add("show");
      if (state.modal) {
        state.modal.classList.add("show");
        const firstInput = state.modal.querySelector("input, select, textarea");
        if (firstInput)
          firstInput.focus();
      }
    },
    close() {
      if (state.mask)
        state.mask.classList.remove("show");
      if (state.modal)
        state.modal.classList.remove("show");
      state.currentScriptTab = null;
    },
    render() {
      if (!state.modal)
        return;
      const scripts2 = Array.from(state.scripts.values());
      const tabs = scripts2.map((script) => {
        const active = script.id === state.currentScriptTab ? "active" : "";
        return `
        <button 
          type="button" 
          class="qol-tab ${active}" 
          data-tab="${escapeHtml(script.id)}"
        >
          ${escapeHtml(script.name)}
        </button>
      `;
      }).join("");
      let content = "";
      if (state.currentScriptTab) {
        const script = state.scripts.get(state.currentScriptTab);
        if (script) {
          content = this.renderScriptSettings(script);
        }
      }
      state.modal.innerHTML = `
      <div class="qol-modal-header">
        <div>
          <h2>QoL Scripts Settings</h2>
          <p>Configure your quality of life enhancements</p>
        </div>
        <button type="button" class="qol-close-btn" data-close aria-label="Close">&times;</button>
      </div>
      <div class="qol-modal-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--qol-border-soft); padding-bottom: 8px;">
        ${tabs}
      </div>
      <div class="qol-modal-body">
        ${content || '<p style="color: var(--qol-text-soft);">Select a script to configure</p>'}
      </div>
    `;
      state.modal.querySelectorAll(".qol-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
          state.currentScriptTab = tab.dataset.tab;
          this.render();
        });
      });
      state.modal.querySelectorAll("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => this.close());
      });
      const forms = state.modal.querySelectorAll("form");
      forms.forEach((form) => {
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          this.handleFormSubmit(form);
        });
      });
    },
    renderScriptSettings(script) {
      if (!script.settings || Object.keys(script.settings).length === 0) {
        return `
        <div class="qol-script-section">
          <h3>${escapeHtml(script.name)}</h3>
          <p style="color: var(--qol-text-soft);">No settings available for this script.</p>
        </div>
      `;
      }
      const fields = Object.entries(script.settings).map(([key, schema]) => {
        const value = script.getSetting?.(key) ?? schema.default;
        const label = schema.label || key;
        const fieldId = `qol-${script.id}-${key}`;
        if (schema.type === "toggle") {
          return `
          <div class="qol-form-group row">
            <label>
              <input type="checkbox" id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" ${value ? "checked" : ""} />
              <span>${escapeHtml(label)}</span>
            </label>
          </div>
        `;
        } else if (schema.type === "text") {
          return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <input type="text" id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" value="${escapeHtml(String(value || ""))}" placeholder="${escapeHtml(schema.placeholder || "")}" />
          </div>
        `;
        } else if (schema.type === "textarea") {
          return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <textarea id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" placeholder="${escapeHtml(schema.placeholder || "")}">${escapeHtml(String(value || ""))}</textarea>
          </div>
        `;
        } else if (schema.type === "select") {
          const options = (schema.options || []).map((opt) => {
            const optValue = typeof opt === "string" ? opt : opt.value;
            const optLabel = typeof opt === "string" ? opt : opt.label;
            const selected = optValue === value ? "selected" : "";
            return `<option value="${escapeHtml(optValue)}" ${selected}>${escapeHtml(optLabel)}</option>`;
          }).join("");
          return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <select id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}">${options}</select>
          </div>
        `;
        } else if (schema.type === "color") {
          return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <input type="color" id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" value="${escapeHtml(String(value || "#6366f1"))}" />
          </div>
        `;
        }
        return "";
      }).join("");
      return `
      <form data-script-id="${escapeHtml(script.id)}">
        <div class="qol-script-section">
          <h3>${escapeHtml(script.name)}</h3>
          <p style="color: var(--qol-text-soft); margin-bottom: 16px;">${escapeHtml(script.description || "")}</p>
          ${fields}
          <div class="qol-actions">
            <button type="submit" class="primary">Save</button>
            <button type="button" data-close>Cancel</button>
          </div>
        </div>
      </form>
    `;
    },
    handleFormSubmit(form) {
      const scriptId = form.dataset.scriptId;
      const script = state.scripts.get(scriptId);
      if (!script)
        return;
      const formData = new FormData(form);
      const settings = {};
      for (const [key, schema] of Object.entries(script.settings || {})) {
        if (schema.type === "toggle") {
          settings[key] = formData.has(key);
        } else {
          settings[key] = formData.get(key) || schema.default;
        }
      }
      if (script.setSettings) {
        script.setSettings(settings);
      } else {
        for (const [key, value] of Object.entries(settings)) {
          script.setSetting?.(key, value);
        }
      }
      Toast.show("Settings saved");
      this.close();
    }
  };
  var CommandPalette = {
    init() {
      ensureStyles();
      ready(() => {
        this.ensure();
        this.setupHotkey();
      });
    },
    ensure() {
      if (state.commandPalette || !document.body)
        return;
      const palette = document.createElement("div");
      palette.id = "qol-command-palette";
      palette.dataset.qolUi = "command-palette";
      palette.setAttribute("role", "dialog");
      palette.setAttribute("aria-modal", "true");
      palette.setAttribute("aria-label", "Command Palette");
      const input = document.createElement("input");
      input.type = "text";
      input.id = "qol-command-palette-input";
      input.setAttribute("placeholder", "Type to search commands...");
      input.setAttribute("aria-label", "Command search");
      const list = document.createElement("div");
      list.id = "qol-command-palette-list";
      list.setAttribute("role", "listbox");
      palette.appendChild(input);
      palette.appendChild(list);
      document.body.appendChild(palette);
      state.commandPalette = palette;
      state.commandPaletteInput = input;
      state.commandPaletteList = list;
      input.addEventListener("input", () => this.filter());
      input.addEventListener("keydown", (e) => this.handleKeyDown(e));
      palette.addEventListener("click", (e) => {
        if (e.target === palette)
          this.close();
      });
    },
    setupHotkey() {
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "k" && !e.shiftKey) {
          const tag = e.target?.tagName;
          if (tag && ["INPUT", "TEXTAREA"].includes(tag)) {
            if (e.target.type === "text" || e.target.type === "search") {
              return;
            }
          }
          e.preventDefault();
          this.toggle();
        }
        if (e.key === "Escape" && state.commandPaletteOpen) {
          e.preventDefault();
          this.close();
        }
      }, true);
    },
    collectCommands() {
      const commands = [];
      for (const script of state.scripts.values()) {
        commands.push({
          id: `toggle-${script.id}`,
          label: `${script.enabled ? "Disable" : "Enable"} ${script.name}`,
          category: "Scripts",
          action: () => {
            script.enabled = !script.enabled;
            script.onToggle?.(script.enabled);
            Toolbar.update();
            this.close();
          }
        });
        if (script.settings && Object.keys(script.settings).length > 0) {
          commands.push({
            id: `settings-${script.id}`,
            label: `Open ${script.name} Settings`,
            category: "Scripts",
            action: () => {
              Modal.open(script.id);
              this.close();
            }
          });
        }
        if (script.commands && Array.isArray(script.commands)) {
          for (const cmd of script.commands) {
            commands.push({
              ...cmd,
              category: cmd.category || script.name,
              action: () => {
                cmd.action?.();
                this.close();
              }
            });
          }
        }
      }
      commands.push({
        id: "settings-all",
        label: "Open Settings",
        category: "General",
        action: () => {
          Modal.open();
          this.close();
        }
      });
      state.commandPaletteCommands = commands;
      return commands;
    },
    filter() {
      const query = state.commandPaletteInput.value.toLowerCase().trim();
      if (!query) {
        state.commandPaletteFiltered = state.commandPaletteCommands;
      } else {
        state.commandPaletteFiltered = state.commandPaletteCommands.filter((cmd) => {
          const searchText = `${cmd.label} ${cmd.category}`.toLowerCase();
          return searchText.includes(query);
        });
      }
      state.commandPaletteSelected = 0;
      this.render();
    },
    render() {
      if (!state.commandPaletteList)
        return;
      if (state.commandPaletteFiltered.length === 0) {
        state.commandPaletteList.innerHTML = '<div class="qol-command-empty">No commands found</div>';
        return;
      }
      const grouped = {};
      for (const cmd of state.commandPaletteFiltered) {
        if (!grouped[cmd.category]) {
          grouped[cmd.category] = [];
        }
        grouped[cmd.category].push(cmd);
      }
      let html = "";
      for (const [category, cmds] of Object.entries(grouped)) {
        html += `<div class="qol-command-category">${escapeHtml(category)}</div>`;
        for (let i = 0; i < cmds.length; i++) {
          const cmd = cmds[i];
          const globalIndex = state.commandPaletteFiltered.indexOf(cmd);
          const selected = globalIndex === state.commandPaletteSelected ? "selected" : "";
          html += `
          <div class="qol-command-item ${selected}" data-index="${globalIndex}" data-command-id="${escapeHtml(cmd.id)}">
            <span class="qol-command-label">${escapeHtml(cmd.label)}</span>
          </div>
        `;
        }
      }
      state.commandPaletteList.innerHTML = html;
      state.commandPaletteList.querySelectorAll(".qol-command-item").forEach((item) => {
        item.addEventListener("click", () => {
          const index = parseInt(item.dataset.index);
          this.execute(index);
        });
      });
      const selectedEl = state.commandPaletteList.querySelector(".qol-command-item.selected");
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    },
    handleKeyDown(e) {
      if (!state.commandPaletteOpen)
        return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          state.commandPaletteSelected = Math.min(
            state.commandPaletteSelected + 1,
            state.commandPaletteFiltered.length - 1
          );
          this.render();
          break;
        case "ArrowUp":
          e.preventDefault();
          state.commandPaletteSelected = Math.max(state.commandPaletteSelected - 1, 0);
          this.render();
          break;
        case "Enter":
          e.preventDefault();
          this.execute(state.commandPaletteSelected);
          break;
        case "Escape":
          e.preventDefault();
          this.close();
          break;
      }
    },
    execute(index) {
      const cmd = state.commandPaletteFiltered[index];
      if (cmd && cmd.action) {
        cmd.action();
      }
    },
    open() {
      this.ensure();
      if (!state.commandPalette)
        return;
      this.collectCommands();
      state.commandPaletteFiltered = state.commandPaletteCommands;
      state.commandPaletteSelected = 0;
      state.commandPaletteOpen = true;
      this.render();
      state.commandPalette.classList.add("show");
      setTimeout(() => {
        if (state.commandPaletteInput) {
          state.commandPaletteInput.focus();
          state.commandPaletteInput.select();
        }
      }, 50);
    },
    close() {
      if (!state.commandPalette)
        return;
      state.commandPaletteOpen = false;
      state.commandPalette.classList.remove("show");
      if (state.commandPaletteInput) {
        state.commandPaletteInput.value = "";
      }
    },
    toggle() {
      if (state.commandPaletteOpen) {
        this.close();
      } else {
        this.open();
      }
    }
  };
  var Toast = {
    init() {
      ensureStyles();
      ready(() => {
        this.ensure();
      });
    },
    ensure() {
      if (state.toast || !document.body)
        return;
      const toast = document.createElement("div");
      toast.id = "qol-toast";
      toast.dataset.qolUi = "toast";
      document.body.appendChild(toast);
      state.toast = toast;
    },
    show(message, duration = 2400) {
      this.ensure();
      if (!state.toast)
        return;
      state.toast.textContent = message;
      state.toast.classList.add("show");
      clearTimeout(state.toastTimer);
      state.toastTimer = setTimeout(() => {
        if (state.toast) {
          state.toast.classList.remove("show");
        }
      }, duration);
    }
  };
  var UI = {
    Toolbar,
    Modal,
    Toast,
    CommandPalette,
    init() {
      Toolbar.init();
      Modal.init();
      Toast.init();
      CommandPalette.init();
    },
    registerScript(script) {
      Toolbar.registerScript(script);
    },
    unregisterScript(scriptId) {
      Toolbar.unregisterScript(scriptId);
    }
  };

  // src/core/deps.js
  var cache = /* @__PURE__ */ new Map();
  var loading = /* @__PURE__ */ new Map();
  var CDN_URLS = {
    "turndown": "https://unpkg.com/turndown/dist/turndown.js",
    "turndown-gfm": "https://unpkg.com/turndown-plugin-gfm/dist/turndown-plugin-gfm.js",
    "readability": "https://cdn.jsdelivr.net/gh/mozilla/readability@master/Readability.js"
  };
  var Deps = {
    // load a dependency by name or custom URL
    async load(name, url) {
      if (cache.has(name)) {
        return cache.get(name);
      }
      if (loading.has(name)) {
        return loading.get(name);
      }
      const loadPromise = this._loadScript(name, url || CDN_URLS[name]);
      loading.set(name, loadPromise);
      try {
        const result = await loadPromise;
        cache.set(name, result);
        loading.delete(name);
        return result;
      } catch (error) {
        loading.delete(name);
        throw error;
      }
    },
    // internal: load script from URL
    _loadScript(name, url) {
      if (!url) {
        return Promise.reject(new Error(`No URL found for dependency: ${name}`));
      }
      return new Promise((resolve, reject) => {
        if (name === "turndown" && typeof TurndownService !== "undefined") {
          resolve(TurndownService);
          return;
        }
        if (name === "turndown-gfm" && typeof turndownPluginGfm !== "undefined") {
          resolve(turndownPluginGfm);
          return;
        }
        if (name === "readability" && typeof Readability !== "undefined") {
          resolve(Readability);
          return;
        }
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = () => {
          let result;
          if (name === "turndown") {
            result = typeof TurndownService !== "undefined" ? TurndownService : window.TurndownService;
          } else if (name === "turndown-gfm") {
            result = typeof turndownPluginGfm !== "undefined" ? turndownPluginGfm : window.turndownPluginGfm;
          } else if (name === "readability") {
            result = typeof Readability !== "undefined" ? Readability : window.Readability;
          } else {
            result = window[name];
          }
          if (!result) {
            reject(new Error(`Dependency ${name} loaded but not found in global scope`));
          } else {
            resolve(result);
          }
        };
        script.onerror = () => {
          reject(new Error(`Failed to load dependency: ${name} from ${url}`));
        };
        document.head.appendChild(script);
      });
    },
    // check if dependency is cached
    has(name) {
      return cache.has(name);
    },
    // clear cache
    clear() {
      cache.clear();
      loading.clear();
    }
  };

  // src/core/registry.js
  var REGISTRY = [
    {
      "id": "custom-shortcuts-manager",
      "name": "Custom Shortcuts Manager",
      "description": "Full macro system with recording, common actions, custom JS, and per-site shortcuts",
      "version": "1.1.0",
      "enabled": true
    },
    {
      "id": "dark-mode-toggle",
      "name": "Dark Mode Toggle",
      "description": "Hybrid dark mode with smart CSS injection and filter fallback, per-site overrides",
      "version": "1.0.1",
      "enabled": true
    },
    {
      "id": "markdown-converter",
      "name": "Markdown Selector+Readability (with UI)",
      "description": "Select DOM, navigate with arrows, convert to Markdown (Turndown+GFM), Readability mode, floating toolbar + settings.",
      "version": "0.4.0",
      "enabled": true
    }
  ];

  // src/index.js
  var scripts = /* @__PURE__ */ new Map();
  function init() {
    UI.init();
    for (const scriptMeta of REGISTRY) {
    }
  }
  function registerScript(config) {
    const {
      id,
      name,
      description,
      version = "1.0.0",
      enabled = true,
      settings = {},
      commands = [],
      // custom commands for command palette
      init: initFn,
      destroy: destroyFn
    } = config;
    if (!id || !name) {
      console.error("[QoL] Script registration failed: id and name are required");
      return;
    }
    if (scripts.has(id)) {
      console.warn(`[QoL] Script ${id} is already registered, replacing...`);
      const old = scripts.get(id);
      if (old.instance && old.config.destroy) {
        try {
          old.config.destroy(old.instance);
        } catch (e) {
          console.error(`[QoL] Error destroying script ${id}:`, e);
        }
      }
    }
    const scriptInstance = {
      id,
      name,
      description,
      version,
      enabled: Store.get(id, "enabled", enabled),
      settings,
      // store helpers
      getSetting(key) {
        const schema = settings[key];
        if (!schema)
          return void 0;
        return Store.get(id, key, schema.default);
      },
      setSetting(key, value) {
        Store.set(id, key, value);
        if (key === "enabled") {
          this.enabled = value;
        }
      },
      setSettings(newSettings) {
        for (const [key, value] of Object.entries(newSettings)) {
          this.setSetting(key, value);
        }
      },
      // lifecycle
      init: initFn,
      destroy: destroyFn,
      // command palette commands
      commands,
      // toggle handler
      onToggle(enabled2) {
        this.enabled = enabled2;
        Store.set(id, "enabled", enabled2);
        if (enabled2) {
          if (this.init && !this.instance) {
            try {
              this.instance = this.init();
            } catch (e) {
              console.error(`[QoL] Error initializing script ${id}:`, e);
              this.enabled = false;
              Store.set(id, "enabled", false);
            }
          }
        } else {
          if (this.destroy && this.instance) {
            try {
              this.destroy(this.instance);
              this.instance = null;
            } catch (e) {
              console.error(`[QoL] Error destroying script ${id}:`, e);
            }
          }
        }
      }
    };
    scripts.set(id, {
      config: scriptInstance,
      instance: null
    });
    UI.registerScript(scriptInstance);
    if (scriptInstance.enabled && initFn) {
      ready(() => {
        try {
          scriptInstance.instance = initFn();
        } catch (e) {
          console.error(`[QoL] Error initializing script ${id}:`, e);
          scriptInstance.enabled = false;
          Store.set(id, "enabled", false);
          UI.Toolbar.update();
        }
      });
    }
    return scriptInstance;
  }
  function unregisterScript(scriptId) {
    const script = scripts.get(scriptId);
    if (!script)
      return;
    if (script.instance && script.config.destroy) {
      try {
        script.config.destroy(script.instance);
      } catch (e) {
        console.error(`[QoL] Error destroying script ${scriptId}:`, e);
      }
    }
    scripts.delete(scriptId);
    UI.unregisterScript(scriptId);
  }
  function getScript(scriptId) {
    const script = scripts.get(scriptId);
    return script ? script.config : null;
  }
  var QoL = {
    registerScript,
    unregisterScript,
    getScript,
    store: Store,
    ui: UI,
    deps: Deps
  };
  if (typeof window !== "undefined") {
    window.QoL = QoL;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.QoL = QoL;
  }
  if (typeof self !== "undefined") {
    self.QoL = QoL;
  }
  ready(init);
  var src_default = QoL;
  return __toCommonJS(src_exports);
})();
