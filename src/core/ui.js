// unified UI components: toolbar, modal, toasts

import { escapeHtml, ready } from './utils.js';
import { STYLES } from '../styles.js';

const state = {
  toolbar: null,
  modal: null,
  mask: null,
  toast: null,
  toastTimer: null,
  scripts: new Map(), // scriptId -> config
  currentScriptTab: null,
  commandPalette: null,
  commandPaletteInput: null,
  commandPaletteList: null,
  commandPaletteOpen: false,
  commandPaletteCommands: [],
  commandPaletteFiltered: [],
  commandPaletteSelected: 0,
  commandPaletteExpanded: new Set(),
  commandPaletteFlatItems: []
};

// inject styles
let styleInjected = false;
function ensureStyles() {
  if (styleInjected) return;
  GM_addStyle(STYLES);
  styleInjected = true;
}

// Toolbar
export const Toolbar = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
      this.update();
    });
  },

  ensure() {
    if (state.toolbar || !document.body) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'qol-toolbar';
    toolbar.dataset.qolUi = 'toolbar';
    document.body.appendChild(toolbar);
    state.toolbar = toolbar;
  },

  update() {
    if (!state.toolbar) return;
    const scripts = Array.from(state.scripts.values());
    
    if (scripts.length === 0) {
      state.toolbar.innerHTML = '<div class="qol-empty">No scripts registered</div>';
      return;
    }

    const buttons = scripts.map(script => {
      const enabled = script.enabled !== false;
      return `
        <button 
          type="button" 
          class="${enabled ? 'qol-active' : ''}" 
          data-script-id="${escapeHtml(script.id)}"
          title="${escapeHtml(script.name)}: ${escapeHtml(script.description || '')}"
        >
          ${escapeHtml(script.name)}
        </button>
      `;
    }).join('');

    const settingsBtn = '<button type="button" data-act="settings" title="Settings">⚙</button>';
    const commandBtn = '<button type="button" data-act="command" title="Command Palette (Ctrl+K)">⌘</button>';
    
    state.toolbar.innerHTML = buttons + commandBtn + settingsBtn;
    
    // attach click handlers
    state.toolbar.addEventListener('click', (e) => {
      const scriptBtn = e.target.closest('button[data-script-id]');
      const settingsBtn = e.target.closest('button[data-act="settings"]');
      const commandBtn = e.target.closest('button[data-act="command"]');
      
      if (scriptBtn) {
        const scriptId = scriptBtn.dataset.scriptId;
        const script = state.scripts.get(scriptId);
        if (script) {
          script.enabled = !script.enabled;
          script.onToggle?.(script.enabled);
          this.update();
        }
      } else if (commandBtn) {
        CommandPalette.open();
      } else if (settingsBtn) {
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

// Modal
export const Modal = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
    });
  },

  ensure() {
    if (state.modal || !document.body) return;
    
    // mask
    const mask = document.createElement('div');
    mask.id = 'qol-mask';
    mask.dataset.qolUi = 'mask';
    mask.addEventListener('click', () => this.close());
    
    // modal
    const modal = document.createElement('div');
    modal.id = 'qol-modal';
    modal.dataset.qolUi = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    
    document.body.appendChild(mask);
    document.body.appendChild(modal);
    
    state.mask = mask;
    state.modal = modal;
  },

  open(scriptId = null) {
    this.ensure();
    if (!state.modal) return;
    
    if (scriptId) {
      state.currentScriptTab = scriptId;
    } else {
      // default to first script or settings
      const scripts = Array.from(state.scripts.values());
      state.currentScriptTab = scripts.length > 0 ? scripts[0].id : null;
    }
    
    this.render();
    
    if (state.mask) state.mask.classList.add('show');
    if (state.modal) {
      state.modal.classList.add('show');
      // focus first input if any
      const firstInput = state.modal.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }
  },

  close() {
    if (state.mask) state.mask.classList.remove('show');
    if (state.modal) state.modal.classList.remove('show');
    state.currentScriptTab = null;
  },

  render() {
    if (!state.modal) return;
    
    const scripts = Array.from(state.scripts.values());
    
    // build tabs
    const tabs = scripts.map(script => {
      const active = script.id === state.currentScriptTab ? 'active' : '';
      return `
        <button 
          type="button" 
          class="qol-tab ${active}" 
          data-tab="${escapeHtml(script.id)}"
        >
          ${escapeHtml(script.name)}
        </button>
      `;
    }).join('');
    
    // build content for current script
    let content = '';
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
    
    // attach handlers
    state.modal.querySelectorAll('.qol-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.currentScriptTab = tab.dataset.tab;
        this.render();
      });
    });
    
    state.modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // attach form submit handlers
    const forms = state.modal.querySelectorAll('form');
    forms.forEach(form => {
      form.addEventListener('submit', (e) => {
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
      
      if (schema.type === 'toggle') {
        return `
          <div class="qol-form-group row">
            <label>
              <input type="checkbox" id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" ${value ? 'checked' : ''} />
              <span>${escapeHtml(label)}</span>
            </label>
          </div>
        `;
      } else if (schema.type === 'text') {
        return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <input type="text" id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" value="${escapeHtml(String(value || ''))}" placeholder="${escapeHtml(schema.placeholder || '')}" />
          </div>
        `;
      } else if (schema.type === 'textarea') {
        return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <textarea id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" placeholder="${escapeHtml(schema.placeholder || '')}">${escapeHtml(String(value || ''))}</textarea>
          </div>
        `;
      } else if (schema.type === 'select') {
        const options = (schema.options || []).map(opt => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          const selected = optValue === value ? 'selected' : '';
          return `<option value="${escapeHtml(optValue)}" ${selected}>${escapeHtml(optLabel)}</option>`;
        }).join('');
        return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <select id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}">${options}</select>
          </div>
        `;
      } else if (schema.type === 'color') {
        return `
          <div class="qol-form-group">
            <label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>
            <input type="color" id="${escapeHtml(fieldId)}" name="${escapeHtml(key)}" value="${escapeHtml(String(value || '#6366f1'))}" />
          </div>
        `;
      }
      return '';
    }).join('');
    
    return `
      <form data-script-id="${escapeHtml(script.id)}">
        <div class="qol-script-section">
          <h3>${escapeHtml(script.name)}</h3>
          <p style="color: var(--qol-text-soft); margin-bottom: 16px;">${escapeHtml(script.description || '')}</p>
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
    if (!script) return;
    
    const formData = new FormData(form);
    const settings = {};
    
    for (const [key, schema] of Object.entries(script.settings || {})) {
      if (schema.type === 'toggle') {
        settings[key] = formData.has(key);
      } else {
        settings[key] = formData.get(key) || schema.default;
      }
    }
    
    // save via script's setSetting if available
    if (script.setSettings) {
      script.setSettings(settings);
    } else {
      // fallback: save each key individually
      for (const [key, value] of Object.entries(settings)) {
        script.setSetting?.(key, value);
      }
    }
    
    Toast.show('Settings saved');
    this.close();
  }
};

// Command Palette
export const CommandPalette = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
      this.setupHotkey();
    });
  },

  ensure() {
    if (state.commandPalette || !document.body) return;
    
    const palette = document.createElement('div');
    palette.id = 'qol-command-palette';
    palette.dataset.qolUi = 'command-palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Command Palette');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'qol-command-palette-input';
    input.setAttribute('placeholder', 'Type to search commands...');
    input.setAttribute('aria-label', 'Command search');
    
    const list = document.createElement('div');
    list.id = 'qol-command-palette-list';
    list.setAttribute('role', 'listbox');
    
    palette.appendChild(input);
    palette.appendChild(list);
    document.body.appendChild(palette);
    
    state.commandPalette = palette;
    state.commandPaletteInput = input;
    state.commandPaletteList = list;
    
    // event handlers
    input.addEventListener('input', () => this.filter());
    input.addEventListener('keydown', (e) => this.handleKeyDown(e));
    palette.addEventListener('click', (e) => {
      if (e.target === palette) this.close();
    });
  },

  setupHotkey() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) {
        // don't trigger if in input/textarea
        const tag = e.target?.tagName;
        if (tag && ['INPUT', 'TEXTAREA'].includes(tag)) {
          // only if not typing in a text input
          if (e.target.type === 'text' || e.target.type === 'search') {
            return;
          }
        }
        e.preventDefault();
        this.toggle();
      }
      // Escape to close
      if (e.key === 'Escape' && state.commandPaletteOpen) {
        e.preventDefault();
        this.close();
      }
    }, true);
  },

  collectCommands() {
    const scripts = [];
    
    // organize by scripts
    for (const script of state.scripts.values()) {
      const scriptCommands = [];
      
      // add script settings command
      if (script.settings && Object.keys(script.settings).length > 0) {
        scriptCommands.push({
          id: `settings-${script.id}`,
          label: `Settings`,
          action: () => {
            Modal.open(script.id);
            this.close();
          }
        });
      }
      
      // add custom commands from script
      if (script.commands && Array.isArray(script.commands)) {
        for (const cmd of script.commands) {
          scriptCommands.push({
            ...cmd,
            action: () => {
              cmd.action?.();
              this.close();
            }
          });
        }
      }
      
      scripts.push({
        id: script.id,
        name: script.name,
        enabled: script.enabled !== false,
        commands: scriptCommands,
        script: script
      });
    }
    
    // add global commands
    const globalCommands = [{
      id: 'settings-all',
      label: 'Open Settings',
      action: () => {
        Modal.open();
        this.close();
      }
    }];
    
    state.commandPaletteCommands = { scripts, globalCommands };
    return state.commandPaletteCommands;
  },

  filter() {
    const query = state.commandPaletteInput.value.toLowerCase().trim();
    
    if (!query) {
      state.commandPaletteFiltered = state.commandPaletteCommands;
    } else {
      // filter scripts and their commands
      const filteredScripts = state.commandPaletteCommands.scripts.filter(script => {
        const nameMatch = script.name.toLowerCase().includes(query);
        const commandMatch = script.commands.some(cmd => 
          cmd.label.toLowerCase().includes(query)
        );
        return nameMatch || commandMatch;
      }).map(script => ({
        ...script,
        commands: script.commands.filter(cmd => 
          cmd.label.toLowerCase().includes(query) || 
          script.name.toLowerCase().includes(query)
        )
      }));
      
      const filteredGlobal = state.commandPaletteCommands.globalCommands.filter(cmd =>
        cmd.label.toLowerCase().includes(query)
      );
      
      state.commandPaletteFiltered = {
        scripts: filteredScripts,
        globalCommands: filteredGlobal
      };
    }
    
    state.commandPaletteSelected = 0;
    this.render();
  },

  render() {
    if (!state.commandPaletteList) return;
    
    const { scripts, globalCommands } = state.commandPaletteFiltered;
    
    if (scripts.length === 0 && globalCommands.length === 0) {
      state.commandPaletteList.innerHTML = '<div class="qol-command-empty">No commands found</div>';
      return;
    }
    
    // build flat list for navigation
    const flatItems = [];
    let html = '';
    
    // render scripts
    for (const script of scripts) {
      const isExpanded = state.commandPaletteExpanded.has(script.id);
      const hasCommands = script.commands.length > 0;
      
      // script header
      const scriptIndex = flatItems.length;
      flatItems.push({ type: 'script', script });
      const scriptSelected = scriptIndex === state.commandPaletteSelected ? 'selected' : '';
      
      html += `
        <div class="qol-command-script ${scriptSelected}" data-index="${scriptIndex}" data-script-id="${escapeHtml(script.id)}">
          <div class="qol-command-script-header">
            <button type="button" class="qol-command-toggle" data-script-id="${escapeHtml(script.id)}" aria-label="Toggle ${escapeHtml(script.name)}">
              <span class="qol-toggle-switch ${script.enabled ? 'enabled' : ''}"></span>
            </button>
            <span class="qol-command-icon">📄</span>
            <span class="qol-command-label">${escapeHtml(script.name)}</span>
            ${hasCommands ? `<span class="qol-command-expand ${isExpanded ? 'expanded' : ''}">▶</span>` : ''}
          </div>
        </div>
      `;
      
      // script commands (if expanded)
      if (isExpanded && hasCommands) {
        for (const cmd of script.commands) {
          const cmdIndex = flatItems.length;
          flatItems.push({ type: 'command', command: cmd, script });
          const cmdSelected = cmdIndex === state.commandPaletteSelected ? 'selected' : '';
          
          html += `
            <div class="qol-command-item qol-command-sub ${cmdSelected}" data-index="${cmdIndex}" data-command-id="${escapeHtml(cmd.id)}">
              <span class="qol-command-icon">⚙</span>
              <span class="qol-command-label">${escapeHtml(script.name)}: ${escapeHtml(cmd.label)}</span>
            </div>
          `;
        }
      }
    }
    
    // render global commands
    if (globalCommands.length > 0) {
      html += `<div class="qol-command-category">General</div>`;
      for (const cmd of globalCommands) {
        const cmdIndex = flatItems.length;
        flatItems.push({ type: 'command', command: cmd });
        const cmdSelected = cmdIndex === state.commandPaletteSelected ? 'selected' : '';
        
        html += `
          <div class="qol-command-item ${cmdSelected}" data-index="${cmdIndex}" data-command-id="${escapeHtml(cmd.id)}">
            <span class="qol-command-label">${escapeHtml(cmd.label)}</span>
          </div>
        `;
      }
    }
    
    state.commandPaletteList.innerHTML = html;
    state.commandPaletteFlatItems = flatItems;
    
    // attach click handlers
    state.commandPaletteList.querySelectorAll('.qol-command-script').forEach(item => {
      const scriptId = item.dataset.scriptId;
      const header = item.querySelector('.qol-command-script-header');
      
      header.addEventListener('click', (e) => {
        if (e.target.closest('.qol-command-toggle')) {
          e.stopPropagation();
          const script = state.scripts.get(scriptId);
          if (script) {
            script.enabled = !script.enabled;
            script.onToggle?.(script.enabled);
            Toolbar.update();
            this.render();
          }
        } else {
          // toggle expand
          if (state.commandPaletteExpanded.has(scriptId)) {
            state.commandPaletteExpanded.delete(scriptId);
          } else {
            state.commandPaletteExpanded.add(scriptId);
          }
          this.render();
        }
      });
    });
    
    state.commandPaletteList.querySelectorAll('.qol-command-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.execute(index);
      });
    });
    
    // scroll selected into view
    const selectedEl = state.commandPaletteList.querySelector('.selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  },

  handleKeyDown(e) {
    if (!state.commandPaletteOpen) return;
    
    const flatItems = state.commandPaletteFlatItems || [];
    const maxIndex = flatItems.length - 1;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        state.commandPaletteSelected = Math.min(
          state.commandPaletteSelected + 1,
          maxIndex
        );
        this.render();
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        state.commandPaletteSelected = Math.max(state.commandPaletteSelected - 1, 0);
        this.render();
        break;
        
      case 'ArrowRight':
        e.preventDefault();
        // expand if on script header
        const currentItem = flatItems[state.commandPaletteSelected];
        if (currentItem?.type === 'script' && !state.commandPaletteExpanded.has(currentItem.script.id)) {
          state.commandPaletteExpanded.add(currentItem.script.id);
          this.render();
        }
        break;
        
      case 'ArrowLeft':
        e.preventDefault();
        // collapse if on script header
        const currentItem2 = flatItems[state.commandPaletteSelected];
        if (currentItem2?.type === 'script' && state.commandPaletteExpanded.has(currentItem2.script.id)) {
          state.commandPaletteExpanded.delete(currentItem2.script.id);
          this.render();
        }
        break;
        
      case 'Enter':
        e.preventDefault();
        this.execute(state.commandPaletteSelected);
        break;
        
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
    }
  },

  execute(index) {
    const flatItems = state.commandPaletteFlatItems || [];
    const item = flatItems[index];
    
    if (!item) return;
    
    if (item.type === 'script') {
      // toggle expand on script
      if (state.commandPaletteExpanded.has(item.script.id)) {
        state.commandPaletteExpanded.delete(item.script.id);
      } else {
        state.commandPaletteExpanded.add(item.script.id);
      }
      this.render();
    } else if (item.type === 'command' && item.command?.action) {
      item.command.action();
    }
  },

  open() {
    this.ensure();
    if (!state.commandPalette) return;
    
    this.collectCommands();
    state.commandPaletteFiltered = state.commandPaletteCommands;
    state.commandPaletteSelected = 0;
    state.commandPaletteOpen = true;
    
    // expand all by default
    state.commandPaletteExpanded.clear();
    for (const script of state.commandPaletteCommands.scripts) {
      if (script.commands.length > 0) {
        state.commandPaletteExpanded.add(script.id);
      }
    }
    
    this.render();
    state.commandPalette.classList.add('show');
    
    // focus input
    setTimeout(() => {
      if (state.commandPaletteInput) {
        state.commandPaletteInput.focus();
        state.commandPaletteInput.select();
      }
    }, 50);
  },

  close() {
    if (!state.commandPalette) return;
    
    state.commandPaletteOpen = false;
    state.commandPalette.classList.remove('show');
    state.commandPaletteExpanded.clear();
    
    if (state.commandPaletteInput) {
      state.commandPaletteInput.value = '';
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

// Toast
export const Toast = {
  init() {
    ensureStyles();
    ready(() => {
      this.ensure();
    });
  },

  ensure() {
    if (state.toast || !document.body) return;
    const toast = document.createElement('div');
    toast.id = 'qol-toast';
    toast.dataset.qolUi = 'toast';
    document.body.appendChild(toast);
    state.toast = toast;
  },

  show(message, duration = 2400) {
    this.ensure();
    if (!state.toast) return;
    
    state.toast.textContent = message;
    state.toast.classList.add('show');
    
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      if (state.toast) {
        state.toast.classList.remove('show');
      }
    }, duration);
  }
};

// export unified UI object
export const UI = {
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

